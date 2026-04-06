"""Планы съёмки (контент-план) + синхронизация с календарём (meetings.type=shoot)."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.content import Meeting, ShootPlan
from app.services.domain_events import log_entity_mutation

router = APIRouter(prefix="/shoot-plans", tags=["shoot-plans"])

MEETINGS_TABLE_ID = "meetings-system"


def _row_to_dict(row: ShootPlan) -> dict:
    return {
        "id": row.id,
        "tableId": row.table_id,
        "title": row.title,
        "date": row.date,
        "time": row.time,
        "participantIds": row.participant_ids or [],
        "items": row.items or [],
        "meetingId": row.meeting_id,
        "isArchived": row.is_archived or False,
    }


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
    meeting.participant_ids = sp.participant_ids or []
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


@router.get("")
async def list_shoot_plans(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ShootPlan).where(ShootPlan.is_archived.is_(False)))
    return [_row_to_dict(r) for r in result.scalars().all()]


@router.put("")
async def update_shoot_plans(plans: list[dict], db: AsyncSession = Depends(get_db)):
    for p in plans:
        pid = p.get("id")
        if not pid:
            continue
        existing = await db.get(ShootPlan, pid)
        is_new = existing is None
        if existing:
            existing.table_id = p.get("tableId", existing.table_id)
            existing.title = p.get("title", existing.title)
            existing.date = p.get("date", existing.date)
            existing.time = p.get("time", existing.time)
            existing.participant_ids = p.get("participantIds", existing.participant_ids or [])
            existing.items = p.get("items", existing.items or [])
            existing.is_archived = p.get("isArchived", False)
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
                table_id=p.get("tableId", ""),
                title=p.get("title", ""),
                date=p.get("date", ""),
                time=p.get("time", "10:00"),
                participant_ids=p.get("participantIds", []),
                items=p.get("items", []),
                meeting_id=None,
                is_archived=p.get("isArchived", False),
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
            payload={"title": p.get("title")},
        )
    await db.commit()
    return {"ok": True}
