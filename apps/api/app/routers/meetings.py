"""Meetings router."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.content import Meeting
from app.services.domain_events import emit_domain_event

router = APIRouter(prefix="/meetings", tags=["meetings"])


def row_to_meeting(row):
    return {
        "id": row.id,
        "tableId": row.table_id,
        "title": row.title,
        "date": row.date,
        "time": row.time,
        "participantIds": row.participant_ids or [],
        "summary": row.summary,
        "type": row.type,
        "dealId": row.deal_id,
        "clientId": row.client_id,
        "recurrence": row.recurrence,
        "isArchived": row.is_archived or False,
    }


@router.get("")
async def get_meetings(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Meeting).where(Meeting.is_archived == False))
    return [row_to_meeting(m) for m in result.scalars().all()]


@router.put("")
async def update_meetings(meetings: list[dict], db: AsyncSession = Depends(get_db)):
    for m in meetings:
        mid = m.get("id")
        if not mid:
            continue
        existing = await db.get(Meeting, mid)
        if existing:
            existing.table_id = m.get("tableId")
            existing.title = m.get("title", existing.title)
            existing.date = m.get("date", existing.date)
            existing.time = m.get("time", existing.time)
            existing.participant_ids = m.get("participantIds", existing.participant_ids or [])
            existing.summary = m.get("summary")
            existing.type = m.get("type", existing.type)
            existing.deal_id = m.get("dealId")
            existing.client_id = m.get("clientId")
            existing.recurrence = m.get("recurrence", "none")
            existing.is_archived = m.get("isArchived", False)
        else:
            db.add(Meeting(
                id=mid,
                table_id=m.get("tableId"),
                title=m.get("title", ""),
                date=m.get("date", ""),
                time=m.get("time", ""),
                participant_ids=m.get("participantIds", []),
                summary=m.get("summary"),
                type=m.get("type", "work"),
                deal_id=m.get("dealId"),
                client_id=m.get("clientId"),
                recurrence=m.get("recurrence", "none"),
                is_archived=m.get("isArchived", False),
            ))
            await db.flush()
            await emit_domain_event(
                db,
                event_type="meeting.created",
                org_id="default",
                entity_type="meeting",
                entity_id=mid,
                source="meetings-router",
                actor_id=m.get("createdByUserId"),
                payload={
                    "meetingId": mid,
                    "title": m.get("title", ""),
                    "date": m.get("date"),
                    "time": m.get("time"),
                    "participantIds": m.get("participantIds", []),
                },
            )
    await db.commit()
    return {"ok": True}
