"""Weekly plans and protocols router."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.weekly_plan import Protocol, WeeklyPlan
from app.services.domain_events import log_entity_mutation

router = APIRouter(prefix="/weekly-plans", tags=["weekly-plans"])


def _row_to_plan(row):
    return {
        "id": row.id,
        "userId": row.user_id,
        "weekStart": row.week_start,
        "taskIds": row.task_ids or [],
        "notes": row.notes,
        "createdAt": row.created_at,
        "updatedAt": row.updated_at,
    }


def _row_to_protocol(row):
    return {
        "id": row.id,
        "title": row.title,
        "weekStart": row.week_start,
        "weekEnd": row.week_end,
        "departmentId": row.department_id,
        "participantIds": row.participant_ids or [],
        "plannedIncome": float(row.planned_income) if row.planned_income is not None else None,
        "actualIncome": float(row.actual_income) if row.actual_income is not None else None,
        "createdAt": row.created_at,
        "updatedAt": row.updated_at,
    }


@router.get("")
async def get_weekly_plans(
    user_id: str | None = Query(None),
    week_start: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Список недельных планов. Можно фильтровать по user_id и week_start."""
    q = select(WeeklyPlan)
    if user_id:
        q = q.where(WeeklyPlan.user_id == user_id)
    if week_start:
        q = q.where(WeeklyPlan.week_start == week_start)
    q = q.order_by(WeeklyPlan.week_start.desc())
    result = await db.execute(q)
    return [_row_to_plan(r) for r in result.scalars().all()]


@router.put("")
async def update_weekly_plans(payload: list[dict], db: AsyncSession = Depends(get_db)):
    for p in payload:
        pid = p.get("id")
        if not pid:
            continue
        existing = await db.get(WeeklyPlan, pid)
        is_new = existing is None
        if existing:
            existing.user_id = p.get("userId", existing.user_id)
            existing.week_start = p.get("weekStart", existing.week_start)
            existing.task_ids = p.get("taskIds", existing.task_ids or [])
            existing.notes = p.get("notes")
            existing.created_at = p.get("createdAt", existing.created_at)
            existing.updated_at = p.get("updatedAt")
        else:
            db.add(WeeklyPlan(
                id=pid,
                user_id=p.get("userId", ""),
                week_start=p.get("weekStart", ""),
                task_ids=p.get("taskIds", []),
                notes=p.get("notes"),
                created_at=p.get("createdAt", ""),
                updated_at=p.get("updatedAt"),
            ))
        await db.flush()
        await log_entity_mutation(
            db,
            event_type="weekly_plan.created" if is_new else "weekly_plan.updated",
            entity_type="weekly_plan",
            entity_id=pid,
            source="weekly-plans-router",
            actor_id=p.get("userId"),
            payload={"weekStart": p.get("weekStart"), "taskCount": len(p.get("taskIds") or [])},
        )
    await db.commit()
    return {"ok": True}


@router.get("/mine/latest")
async def get_my_latest_plan(
    user_id: str = Query(..., description="ID текущего пользователя"),
    db: AsyncSession = Depends(get_db),
):
    """Последний недельный план текущего пользователя (для рабочего стола)."""
    q = (
        select(WeeklyPlan)
        .where(WeeklyPlan.user_id == user_id)
        .order_by(WeeklyPlan.week_start.desc())
        .limit(1)
    )
    result = await db.execute(q)
    row = result.scalar_one_or_none()
    return _row_to_plan(row) if row else None


@router.get("/protocols")
async def get_protocols(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Protocol).order_by(Protocol.week_start.desc()))
    return [_row_to_protocol(r) for r in result.scalars().all()]


@router.put("/protocols")
async def update_protocols(payload: list[dict], db: AsyncSession = Depends(get_db)):
    for p in payload:
        pid = p.get("id")
        if not pid:
            continue
        existing = await db.get(Protocol, pid)
        if existing:
            existing.title = p.get("title", existing.title)
            existing.week_start = p.get("weekStart", existing.week_start)
            existing.week_end = p.get("weekEnd", existing.week_end)
            existing.department_id = p.get("departmentId", existing.department_id)
            existing.participant_ids = p.get("participantIds", existing.participant_ids or [])
            existing.planned_income = p.get("plannedIncome", existing.planned_income)
            existing.actual_income = p.get("actualIncome", existing.actual_income)
            existing.created_at = p.get("createdAt", existing.created_at)
            existing.updated_at = p.get("updatedAt")
        else:
            db.add(Protocol(
                id=pid,
                title=p.get("title", ""),
                week_start=p.get("weekStart", ""),
                week_end=p.get("weekEnd"),
                department_id=p.get("departmentId"),
                participant_ids=p.get("participantIds", []),
                planned_income=p.get("plannedIncome"),
                actual_income=p.get("actualIncome"),
                created_at=p.get("createdAt", ""),
                updated_at=p.get("updatedAt"),
            ))
    await db.commit()
    return {"ok": True}


@router.get("/protocols/{protocol_id}/aggregated")
async def get_protocol_aggregated(
    protocol_id: str,
    db: AsyncSession = Depends(get_db),
):
    """По протоколу вернуть сводку: задачи из недельных планов участников (для отображения в UI)."""
    protocol = await db.get(Protocol, protocol_id)
    if not protocol:
        return {"protocol": None, "plans": [], "taskIdsByUser": {}}
    participant_ids = protocol.participant_ids or []
    week_start = protocol.week_start
    week_end = protocol.week_end or protocol.week_start
    q = select(WeeklyPlan).where(
        WeeklyPlan.user_id.in_(participant_ids),
        WeeklyPlan.week_start >= week_start,
        WeeklyPlan.week_start <= week_end,
    )
    result = await db.execute(q)
    plans = result.scalars().all()
    task_ids_by_user = {p.user_id: (p.task_ids or []) for p in plans}
    return {
        "protocol": _row_to_protocol(protocol),
        "plans": [_row_to_plan(p) for p in plans],
        "taskIdsByUser": task_ids_by_user,
    }


@router.delete("/{plan_id}")
async def delete_weekly_plan(plan_id: str, db: AsyncSession = Depends(get_db)):
    plan = await db.get(WeeklyPlan, plan_id)
    if plan:
        await db.delete(plan)
        await db.flush()
        await log_entity_mutation(
            db,
            event_type="weekly_plan.deleted",
            entity_type="weekly_plan",
            entity_id=plan_id,
            source="weekly-plans-router",
            payload={},
        )
    await db.commit()
    return {"ok": True}


@router.delete("/protocols/{protocol_id}")
async def delete_protocol(protocol_id: str, db: AsyncSession = Depends(get_db)):
    protocol = await db.get(Protocol, protocol_id)
    if protocol:
        await db.delete(protocol)
        await db.flush()
        await log_entity_mutation(
            db,
            event_type="protocol.deleted",
            entity_type="protocol",
            entity_id=protocol_id,
            source="weekly-plans-router",
            payload={},
        )
    await db.commit()
    return {"ok": True}
