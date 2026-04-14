"""API запуска процесса и перехода по шагам (только вперёд, без отката)."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.routers.bpm import _instance_row_to_api
from app.core.auth import get_current_user
from app.db import get_db
from app.models.bpm import BpInstance, BusinessProcess, BusinessProcessStep
from app.schemas.bp_api import BpInstanceResponse
from app.services.domain_events import log_entity_mutation

router = APIRouter(prefix="/bp", tags=["bp"], dependencies=[Depends(get_current_user)])


def _step_sort_key(s: BusinessProcessStep) -> tuple[int, str]:
    return (s.position, s.id)


def _ordered_steps(steps: list[BusinessProcessStep]) -> list[BusinessProcessStep]:
    return sorted(steps, key=_step_sort_key)


def _is_strictly_forward(
    current: BusinessProcessStep,
    target: BusinessProcessStep,
) -> bool:
    """Строго «вперёд» по порядку (position, id), без возврата и без оставания на месте."""
    return _step_sort_key(target) > _step_sort_key(current)


def _linear_successor(
    current: BusinessProcessStep,
    ordered: list[BusinessProcessStep],
) -> BusinessProcessStep | None:
    ids = [s.id for s in ordered]
    try:
        idx = ids.index(current.id)
    except ValueError:
        return None
    if idx + 1 < len(ordered):
        return ordered[idx + 1]
    return None


def _edge_allowed(
    current: BusinessProcessStep,
    target: BusinessProcessStep,
    ordered: list[BusinessProcessStep],
) -> bool:
    """Целевой шаг достижим одним шагом по шаблону (явная ссылка, линейный следующий или ветка)."""
    branches = list(current.branches_rel)
    if branches:
        allowed = {b.next_step_id for b in branches}
        return target.id in allowed
    if current.next_step_id:
        return current.next_step_id == target.id
    succ = _linear_successor(current, ordered)
    return succ is not None and succ.id == target.id


class StartProcessBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    instance_id: str | None = Field(default=None, alias="instanceId")
    deal_id: str | None = Field(default=None, alias="dealId")


class AdvanceBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    next_step_id: str | None = Field(default=None, alias="nextStepId")


async def _load_process_steps(db: AsyncSession, process_id: str) -> BusinessProcess | None:
    stmt = (
        select(BusinessProcess)
        .where(BusinessProcess.id == process_id)
        .options(
            selectinload(BusinessProcess.steps_rel).selectinload(BusinessProcessStep.branches_rel),
        )
    )
    res = await db.execute(stmt)
    return res.scalars().unique().one_or_none()


async def _load_instance(db: AsyncSession, instance_id: str) -> BpInstance | None:
    return await db.get(BpInstance, instance_id)


@router.post("/processes/{process_id}/start", response_model=BpInstanceResponse)
async def start_process(
    process_id: str,
    body: StartProcessBody = Body(default_factory=StartProcessBody),
    db: AsyncSession = Depends(get_db),
):
    """
    Запуск нового экземпляра: первый шаг по порядку (position, id).
    """
    pid = str(process_id).strip()[:36]
    proc = await _load_process_steps(db, pid)
    if proc is None:
        raise HTTPException(status_code=404, detail="Процесс не найден")
    if str(proc.is_archived).lower() == "true":
        raise HTTPException(status_code=400, detail="Процесс в архиве")

    steps = list(proc.steps_rel)
    if not steps:
        raise HTTPException(status_code=400, detail="У процесса нет шагов")

    ordered = _ordered_steps(steps)
    first = ordered[0]
    iid = (body.instance_id or "").strip()[:36] or str(uuid.uuid4())
    if await db.get(BpInstance, iid):
        raise HTTPException(status_code=409, detail="Экземпляр с таким id уже существует")

    ver = int(proc.version) if proc.version and str(proc.version).isdigit() else 1
    now = datetime.now(timezone.utc).isoformat()
    ctx: dict = {
        "processVersion": ver,
        "startedAt": now,
        "taskIds": [],
        "completedStepIds": [],
    }
    if body.deal_id:
        ctx["dealId"] = str(body.deal_id).strip()[:36]

    row = BpInstance(
        id=iid[:36],
        bp_id=pid,
        current_step_id=first.id,
        status="active",
        context=ctx,
    )
    db.add(row)
    await db.flush()
    await log_entity_mutation(
        db,
        event_type="bp.instance.started",
        entity_type="bp_instance",
        entity_id=iid,
        source="bp-router",
        payload={"processId": pid, "currentStepId": first.id},
    )
    await db.commit()
    await db.refresh(row)
    return _instance_row_to_api(row)


@router.post("/instances/{instance_id}/advance", response_model=BpInstanceResponse)
async def advance_instance(
    instance_id: str,
    body: AdvanceBody = Body(default_factory=AdvanceBody),
    db: AsyncSession = Depends(get_db),
):
    """
    Переход на следующий шаг **только вперёд** (строго больший порядок шага).
    Для шага с ветками (variant) нужен ``nextStepId`` из допустимой ветки.
    """
    iid = str(instance_id).strip()[:36]
    inst = await _load_instance(db, iid)
    if inst is None:
        raise HTTPException(status_code=404, detail="Экземпляр не найден")

    if inst.status == "completed":
        raise HTTPException(status_code=409, detail="Экземпляр завершён; переходы недоступны")
    if inst.status == "paused":
        raise HTTPException(status_code=409, detail="Экземпляр на паузе; сначала возобновите процесс")

    proc = await _load_process_steps(db, inst.bp_id)
    if proc is None:
        raise HTTPException(status_code=404, detail="Процесс не найден")

    steps = list(proc.steps_rel)
    by_id: dict[str, BusinessProcessStep] = {s.id: s for s in steps}
    ordered = _ordered_steps(steps)
    next_from_body = (body.next_step_id or "").strip()[:36] or None

    ctx = dict(inst.context) if isinstance(inst.context, dict) else {}
    pending = ctx.get("pendingBranchSelection")

    if pending and isinstance(pending, dict):
        psid = str(pending.get("stepId") or "").strip()[:36]
        if not psid:
            raise HTTPException(status_code=400, detail="Некорректное состояние pendingBranchSelection")
        if not next_from_body:
            raise HTTPException(status_code=400, detail="Укажите nextStepId для выбора ветки")
        step_p = by_id.get(psid)
        if step_p is None:
            raise HTTPException(status_code=400, detail="Шаг ожидания ветки не найден в шаблоне")
        target = by_id.get(next_from_body)
        if target is None:
            raise HTTPException(status_code=404, detail="Целевой шаг не найден")
        branches = list(step_p.branches_rel)
        allowed = {b.next_step_id for b in branches}
        if target.id not in allowed:
            raise HTTPException(status_code=400, detail="nextStepId не соответствует ни одной ветке")
        if not _is_strictly_forward(step_p, target):
            raise HTTPException(status_code=400, detail="Запрещён переход назад или на тот же шаг")

        completed = list(ctx.get("completedStepIds") or [])
        if psid not in completed:
            completed.append(psid)
        chosen = next((b for b in branches if b.next_step_id == target.id), None)
        history = list(ctx.get("branchHistory") or [])
        history.append(
            {
                "stepId": psid,
                "branchId": chosen.id if chosen else None,
                "nextStepId": target.id,
            }
        )
        ctx["completedStepIds"] = completed
        ctx["branchHistory"] = history
        ctx.pop("pendingBranchSelection", None)
        inst.current_step_id = target.id
        inst.context = ctx
        await db.flush()
        await log_entity_mutation(
            db,
            event_type="bp.instance.advanced",
            entity_type="bp_instance",
            entity_id=iid,
            source="bp-router",
            payload={"currentStepId": target.id, "via": "branch"},
        )
        await db.commit()
        await db.refresh(inst)
        return _instance_row_to_api(inst)

    cur_id = inst.current_step_id
    if not cur_id:
        raise HTTPException(status_code=400, detail="Нет текущего шага; ожидается выбор ветки")

    current = by_id.get(cur_id)
    if current is None:
        raise HTTPException(status_code=400, detail="Текущий шаг не найден в шаблоне процесса")

    branches = list(current.branches_rel)
    if branches:
        if not next_from_body:
            raise HTTPException(
                status_code=400,
                detail="Для шага с вариантами укажите nextStepId (допустим только переход по ветке вперёд)",
            )
        target = by_id.get(next_from_body)
        if target is None:
            raise HTTPException(status_code=404, detail="Целевой шаг не найден")
        allowed = {b.next_step_id for b in branches}
        if target.id not in allowed:
            raise HTTPException(status_code=400, detail="nextStepId не соответствует ветке")
        if not _is_strictly_forward(current, target):
            raise HTTPException(status_code=400, detail="Запрещён переход назад или на тот же шаг")
    else:
        if next_from_body:
            target = by_id.get(next_from_body)
            if target is None:
                raise HTTPException(status_code=404, detail="Целевой шаг не найден")
        elif current.next_step_id:
            target = by_id.get(current.next_step_id)
            if target is None:
                raise HTTPException(status_code=400, detail="next_step_id шаблона указывает на несуществующий шаг")
        else:
            target = _linear_successor(current, ordered)

        if target is not None:
            if not _is_strictly_forward(current, target):
                raise HTTPException(status_code=400, detail="Запрещён переход назад или на тот же шаг")
            if not _edge_allowed(current, target, ordered):
                raise HTTPException(
                    status_code=400,
                    detail="Переход на указанный шаг не разрешён шаблоном процесса",
                )

    completed = list(ctx.get("completedStepIds") or [])
    if current.id not in completed:
        completed.append(current.id)

    if target is None:
        ctx["completedStepIds"] = completed
        ctx["completedAt"] = datetime.now(timezone.utc).isoformat()
        inst.status = "completed"
        inst.current_step_id = None
        inst.context = ctx
        await db.flush()
        await log_entity_mutation(
            db,
            event_type="bp.instance.completed",
            entity_type="bp_instance",
            entity_id=iid,
            source="bp-router",
            payload={},
        )
        await db.commit()
        await db.refresh(inst)
        return _instance_row_to_api(inst)

    ctx["completedStepIds"] = completed
    inst.current_step_id = target.id
    inst.context = ctx
    await db.flush()
    await log_entity_mutation(
        db,
        event_type="bp.instance.advanced",
        entity_type="bp_instance",
        entity_id=iid,
        source="bp-router",
        payload={"currentStepId": target.id, "via": "forward"},
    )
    await db.commit()
    await db.refresh(inst)
    return _instance_row_to_api(inst)
