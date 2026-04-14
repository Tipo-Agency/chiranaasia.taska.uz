"""Планы съёмки (контент-план) + синхронизация с календарём (meetings.type=shoot)."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.db import get_db
from app.models.content import Meeting, ShootPlan
from app.schemas.common_responses import OkResponse
from app.schemas.shoot_plans import ShootCalendarParticipant, ShootPlanItem, ShootPlanRead
from app.services.domain_events import log_entity_mutation

router = APIRouter(prefix="/shoot-plans", tags=["shoot-plans"], dependencies=[Depends(get_current_user)])

MEETINGS_TABLE_ID = "meetings-system"


def _row_to_read(row: ShootPlan) -> ShootPlanRead:
    raw_items = row.items or []
    items: list[dict[str, object]] = [x for x in raw_items if isinstance(x, dict)]
    pids = row.participant_ids or []
    pid_list = [str(x) for x in pids] if isinstance(pids, list) else []
    return ShootPlanRead(
        id=row.id,
        tableId=row.table_id or "",
        title=row.title or "",
        date=row.date or "",
        time=row.time or "",
        participantIds=pid_list,
        items=items,
        meetingId=row.meeting_id,
        isArchived=bool(row.is_archived),
    )


def _summary_preview(items: object) -> str:
    if not isinstance(items, list):
        return ""
    n = len(items)
    return f"План съёмки: {n} ед." if n else ""


async def _sync_meeting(db: AsyncSession, sp: ShootPlan) -> None:
    """Создаёт/обновляет запись в календаре для плана съёмки."""
    mid = sp.meeting_id
    meeting = await db.get(Meeting, mid) if mid else None
    if not meeting:
        meeting = Meeting(id=str(uuid.uuid4()))
        db.add(meeting)
    meeting.table_id = MEETINGS_TABLE_ID
    meeting.title = sp.title or "Съёмка"
    meeting.date = sp.date or meeting.date
    meeting.time = sp.time or "10:00"
    pids = sp.participant_ids or []
    meeting.participant_ids = pids
    meeting.participants = [
        ShootCalendarParticipant(userId=str(uid).strip()[:36]).model_dump(mode="python")
        for uid in pids
        if str(uid).strip()
    ]
    meeting.summary = _summary_preview(sp.items)
    meeting.type = "shoot"
    meeting.deal_id = None
    meeting.client_id = None
    meeting.project_id = None
    meeting.shoot_plan_id = sp.id
    meeting.recurrence = "none"
    meeting.is_archived = bool(sp.is_archived)
    await db.flush()
    sp.meeting_id = meeting.id


@router.get("", response_model=list[ShootPlanRead])
async def list_shoot_plans(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ShootPlan).where(ShootPlan.is_archived.is_(False)))
    return [_row_to_read(r) for r in result.scalars().all()]


@router.put("", response_model=OkResponse)
async def update_shoot_plans(plans: list[ShootPlanItem], db: AsyncSession = Depends(get_db)):
    for p in plans:
        pid = p.id
        existing = await db.get(ShootPlan, pid)
        is_new = existing is None
        if existing:
            existing.table_id = p.tableId or existing.table_id
            existing.title = p.title or existing.title
            existing.date = p.date or existing.date
            existing.time = p.time or existing.time
            existing.participant_ids = p.participantIds
            existing.items = p.items
            existing.is_archived = p.isArchived
            await db.flush()
            if not existing.is_archived:
                await _sync_meeting(db, existing)
            else:
                if existing.meeting_id:
                    m = await db.get(Meeting, existing.meeting_id)
                    if m:
                        m.is_archived = True
                        await db.flush()
        else:
            sp = ShootPlan(
                id=pid,
                table_id=p.tableId,
                title=p.title,
                date=p.date,
                time=p.time,
                participant_ids=p.participantIds,
                items=p.items,
                meeting_id=None,
                is_archived=p.isArchived,
            )
            db.add(sp)
            await db.flush()
            if not sp.is_archived:
                await _sync_meeting(db, sp)
        await log_entity_mutation(
            db,
            event_type="shoot_plan.created" if is_new else "shoot_plan.updated",
            entity_type="shoot_plan",
            entity_id=pid,
            source="shoot-plans-router",
            payload={"title": p.title},
        )
    await db.commit()
    return {"ok": True}
