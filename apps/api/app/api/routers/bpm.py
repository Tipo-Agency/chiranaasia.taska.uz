"""BPM router - positions, processes (шаги, экземпляры bp_instances)."""
from __future__ import annotations

import json
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.auth import get_current_user
from app.db import get_db
from app.models.bpm import (
    BpInstance,
    BusinessProcess,
    BusinessProcessStep,
    BusinessProcessStepBranch,
    OrgPosition,
)
from app.schemas.bpm_api import (
    BpInstanceRead,
    BpmStepBranchRead,
    BpmStepRead,
    BusinessProcessRead,
    OrgPositionRead,
)
from app.schemas.bpm_bulk import (
    BpInstanceIncoming,
    BpmStepBulkItem,
    BusinessProcessBulkItem,
    OrgPositionItem,
)
from app.schemas.common_responses import OkResponse
from app.services.domain_events import log_entity_mutation

router = APIRouter(prefix="/bpm", tags=["bpm"], dependencies=[Depends(get_current_user)])


def row_to_position(row: OrgPosition) -> OrgPositionRead:
    ov = row.order_val
    if ov is not None and str(ov).isdigit():
        order_out: int | str | None = int(ov)
    else:
        order_out = ov
    return OrgPositionRead(
        id=row.id,
        title=row.title or "",
        departmentId=row.department_id,
        managerPositionId=row.manager_position_id,
        holderUserId=row.holder_user_id,
        order=order_out,
        isArchived=bool(getattr(row, "is_archived", False)),
        taskAssigneeMode=getattr(row, "task_assignee_mode", None) or "round_robin",
        lastTaskAssigneeUserId=getattr(row, "last_task_assignee_user_id", None),
    )


def _step_to_api(step: BusinessProcessStep) -> BpmStepRead:
    branches = list(step.branches_rel)
    return BpmStepRead(
        id=step.id,
        title=step.title or "",
        description=step.description,
        assigneeType=step.role or "",
        assigneeId=step.assignee_id,
        order=int(step.position or 0),
        stepType=step.step_type or "",
        nextStepId=step.next_step_id,
        branches=[
            BpmStepBranchRead(id=b.id, label=b.label or "", nextStepId=b.next_step_id) for b in branches
        ],
    )


_INSTANCE_CONTEXT_KEYS = frozenset({
    "processVersion",
    "startedAt",
    "completedAt",
    "taskIds",
    "dealId",
    "dynamicSteps",
    "pendingBranchSelection",
    "completedStepIds",
    "branchHistory",
})


def _str_id(v, *, max_len: int = 36) -> str | None:
    if v is None:
        return None
    s = str(v).strip()
    if not s:
        return None
    return s[:max_len]


def _instance_cur_status(raw: dict[str, Any]) -> tuple[str | None, str]:
    cur_raw = raw.get("currentStepId")
    if cur_raw is None or (isinstance(cur_raw, str) and not str(cur_raw).strip()):
        cur = None
    else:
        cur = _str_id(cur_raw)
    status = (str(raw.get("status") or "active").strip()[:30] or "active")
    return cur, status


def _instance_merge_context(base: dict[str, Any], raw: dict[str, Any]) -> dict[str, Any]:
    """Сливает поля контекста из payload с base (не затирает ключи, отсутствующие в raw)."""
    merged = dict(base or {})
    for k in _INSTANCE_CONTEXT_KEYS:
        if k in raw:
            merged[k] = raw[k]
    if "taskIds" not in merged:
        merged["taskIds"] = []
    if "processVersion" not in merged:
        merged["processVersion"] = 1
    return merged


def _canon_context(ctx: dict[str, Any]) -> str:
    return json.dumps(ctx or {}, sort_keys=True, default=str)


def _bp_instance_payload_dict(inst: BpInstanceIncoming) -> dict:
    """Плоский dict для сравнения/слияния (только переданные поля)."""
    return inst.model_dump(exclude_unset=True, mode="python")


def _instance_completed_payload_allows(existing: BpInstance, incoming: BpInstanceIncoming) -> bool:
    """True, если для завершённого экземпляра payload не меняет сохранённый снимок."""
    raw = _bp_instance_payload_dict(incoming)
    cur, status = _instance_cur_status(raw)
    merged_ctx = _instance_merge_context(dict(existing.context or {}), raw)
    if cur != existing.current_step_id:
        return False
    if status != existing.status:
        return False
    return _canon_context(merged_ctx) == _canon_context(dict(existing.context or {}))


def _instance_row_to_api(row: BpInstance) -> BpInstanceRead:
    ctx = dict(row.context) if isinstance(row.context, dict) else {}
    tids = ctx.get("taskIds")
    if not isinstance(tids, list):
        tids = []
    pv_raw = ctx.get("processVersion", 1)
    try:
        pv_int = int(pv_raw) if pv_raw is not None else 1
    except (TypeError, ValueError):
        pv_int = 1
    extra: dict = {}
    for k in (
        "completedAt",
        "dealId",
        "dynamicSteps",
        "pendingBranchSelection",
        "completedStepIds",
        "branchHistory",
    ):
        if k in ctx:
            extra[k] = ctx[k]
    return BpInstanceRead(
        id=row.id,
        processId=row.bp_id,
        currentStepId=row.current_step_id,
        status=row.status or "active",
        processVersion=pv_int,
        startedAt=str(ctx.get("startedAt") or ""),
        taskIds=[str(x) for x in tids],
        **extra,
    )


def _instance_sort_key(inst: BpInstance):
    ctx = inst.context or {}
    return (ctx.get("startedAt") or "", inst.id)


def row_to_process(row: BusinessProcess) -> BusinessProcessRead:
    steps_rows = sorted(row.steps_rel, key=lambda s: (s.position, s.id))
    steps = [_step_to_api(s) for s in steps_rows]
    inst_rows = sorted(row.instances_rel, key=_instance_sort_key)
    instances = [_instance_row_to_api(i) for i in inst_rows]
    ver = int(row.version) if row.version and str(row.version).isdigit() else 1
    return BusinessProcessRead(
        id=row.id,
        version=ver,
        title=row.title or "",
        description=row.description,
        steps=steps,
        instances=instances,
        isArchived=bool(row.is_archived),
        createdAt=row.created_at,
        updatedAt=row.updated_at,
    )


async def _sync_instances(db: AsyncSession, bp_id: str, incoming: list[BpInstanceIncoming]) -> None:
    res = await db.execute(select(BpInstance).where(BpInstance.bp_id == bp_id))
    by_id: dict[str, BpInstance] = {r.id: r for r in res.scalars().all()}
    incoming_ids: set[str] = set()
    for inst in incoming:
        raw = _bp_instance_payload_dict(inst)
        iid = _str_id(raw.get("id"))
        if not iid:
            continue
        iid = iid[:36]
        incoming_ids.add(iid)
        existing = by_id.get(iid)
        if existing is not None and existing.status == "completed":
            if not _instance_completed_payload_allows(existing, inst):
                raise HTTPException(
                    status_code=409,
                    detail="Экземпляр процесса завершён; изменение данных запрещено",
                )
            continue
        cur, status = _instance_cur_status(raw)
        if existing is not None:
            merged_ctx = _instance_merge_context(dict(existing.context or {}), raw)
            existing.current_step_id = cur
            existing.status = status
            existing.context = merged_ctx
        else:
            ctx = _instance_merge_context({}, raw)
            db.add(BpInstance(id=iid, bp_id=bp_id, current_step_id=cur, status=status, context=ctx))
    await db.flush()
    for rid, row in list(by_id.items()):
        if rid in incoming_ids:
            continue
        if row.status == "completed":
            continue
        await db.delete(row)
    await db.flush()


async def _replace_steps(db: AsyncSession, bp_id: str, steps_list: list[BpmStepBulkItem]) -> None:
    await db.execute(delete(BusinessProcessStep).where(BusinessProcessStep.bp_id == bp_id))
    await db.flush()
    for s in steps_list:
        sid = (_str_id(s.id) or str(uuid.uuid4()))[:36]
        position = int(s.order)
        role = (s.assigneeType or "user")[:50]
        assignee_id = _str_id(s.assigneeId)
        title = (s.title or "")[:255]
        desc = s.description
        description = (str(desc).strip()[:500] if desc is not None and str(desc).strip() else None)
        step_type = (s.stepType or "normal")[:20]
        next_step_id = _str_id(s.nextStepId)
        db.add(
            BusinessProcessStep(
                id=sid,
                bp_id=bp_id,
                position=position,
                role=role,
                assignee_id=assignee_id,
                title=title,
                description=description,
                step_type=step_type,
                next_step_id=next_step_id,
            )
        )
        for br in s.branches:
            brid = (_str_id(br.id) or str(uuid.uuid4()))[:36]
            label = (br.label or "")[:255]
            nxt = _str_id(br.nextStepId)
            if not nxt:
                raise HTTPException(
                    status_code=422,
                    detail=f"Ветка '{label or brid}' шага '{title}' не имеет целевого шага (nextStepId обязателен)",
                )
            db.add(
                BusinessProcessStepBranch(
                    id=brid,
                    step_id=sid,
                    label=label,
                    next_step_id=nxt[:36],
                )
            )
    await db.flush()


@router.get("/positions", response_model=list[OrgPositionRead])
async def get_positions(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(OrgPosition))
    return [row_to_position(p) for p in result.scalars().all()]


@router.put("/positions", response_model=OkResponse)
async def update_positions(positions: list[OrgPositionItem], db: AsyncSession = Depends(get_db)):
    for p in positions:
        pid = p.id
        if not pid:
            continue
        existing = await db.get(OrgPosition, pid)
        is_new = existing is None
        fs = p.model_fields_set
        if existing:
            if "title" in fs:
                existing.title = p.title or existing.title
            if "departmentId" in fs:
                existing.department_id = p.departmentId
            if "managerPositionId" in fs:
                existing.manager_position_id = p.managerPositionId
            if "holderUserId" in fs:
                existing.holder_user_id = p.holderUserId
            if "order" in fs:
                existing.order_val = str(p.order)
            if "isArchived" in fs:
                existing.is_archived = p.isArchived
            if "taskAssigneeMode" in fs:
                existing.task_assignee_mode = p.taskAssigneeMode or "round_robin"
            if "lastTaskAssigneeUserId" in fs:
                existing.last_task_assignee_user_id = p.lastTaskAssigneeUserId
        else:
            db.add(OrgPosition(
                id=pid,
                title=p.title or "",
                department_id=p.departmentId,
                manager_position_id=p.managerPositionId,
                holder_user_id=p.holderUserId,
                order_val=str(p.order),
                is_archived=p.isArchived,
                task_assignee_mode=p.taskAssigneeMode or "round_robin",
                last_task_assignee_user_id=p.lastTaskAssigneeUserId,
            ))
        await db.flush()
        await log_entity_mutation(
            db,
            event_type="bpm.position.created" if is_new else "bpm.position.updated",
            entity_type="org_position",
            entity_id=pid,
            source="bpm-router",
            payload={"title": p.title},
        )
    return OkResponse()


@router.get("/processes", response_model=list[BusinessProcessRead])
async def get_processes(db: AsyncSession = Depends(get_db)):
    stmt = select(BusinessProcess).options(
        selectinload(BusinessProcess.instances_rel),
        selectinload(BusinessProcess.steps_rel).selectinload(BusinessProcessStep.branches_rel),
    )
    result = await db.execute(stmt)
    return [row_to_process(p) for p in result.scalars().unique().all()]


@router.put("/processes", response_model=OkResponse)
async def update_processes(processes: list[BusinessProcessBulkItem], db: AsyncSession = Depends(get_db)):
    for p in processes:
        pid = p.id
        if not pid:
            continue
        pid = str(pid).strip()[:36]
        existing = await db.get(BusinessProcess, pid)
        is_new = existing is None
        fs = p.model_fields_set
        steps_payload = list(p.steps)
        instances_payload = list(p.instances)
        if existing:
            if "version" in fs:
                existing.version = str(p.version)
            if "title" in fs:
                existing.title = p.title or existing.title
            if "description" in fs:
                existing.description = p.description
            if "isArchived" in fs:
                existing.is_archived = bool(p.isArchived)
            if "createdAt" in fs:
                existing.created_at = p.createdAt
            if "updatedAt" in fs:
                existing.updated_at = p.updatedAt
        else:
            db.add(BusinessProcess(
                id=pid,
                version=str(p.version) if p.version is not None else "1",
                title=p.title or "",
                description=p.description,
                is_archived=bool(p.isArchived),
                created_at=p.createdAt,
                updated_at=p.updatedAt,
            ))
        await db.flush()
        await _replace_steps(db, pid, steps_payload)
        await _sync_instances(db, pid, instances_payload)
        await log_entity_mutation(
            db,
            event_type="bpm.process.created" if is_new else "bpm.process.updated",
            entity_type="business_process",
            entity_id=pid,
            source="bpm-router",
            payload={"title": p.title, "version": p.version},
        )
    await db.commit()
    return OkResponse()
