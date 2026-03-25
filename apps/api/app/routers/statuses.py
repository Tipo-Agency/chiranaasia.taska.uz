"""Statuses router."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.settings import StatusOption
from app.utils import row_to_status
from app.services.domain_events import log_entity_mutation

router = APIRouter(prefix="/statuses", tags=["statuses"])


@router.get("")
async def get_statuses(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(StatusOption))
    return [row_to_status(s) for s in result.scalars().all()]


@router.put("")
async def update_statuses(statuses: list[dict], db: AsyncSession = Depends(get_db)):
    for s in statuses:
        sid = s.get("id")
        if not sid:
            continue
        existing = await db.get(StatusOption, sid)
        is_new = existing is None
        if existing:
            existing.name = s.get("name", existing.name)
            existing.color = s.get("color", existing.color)
            existing.is_archived = bool(s.get("isArchived", False))
        else:
            db.add(StatusOption(
                id=sid,
                name=s.get("name", ""),
                color=s.get("color", ""),
                is_archived=bool(s.get("isArchived", False)),
            ))
        await db.flush()
        await log_entity_mutation(
            db,
            event_type="settings.status.created" if is_new else "settings.status.updated",
            entity_type="status_option",
            entity_id=sid,
            source="statuses-router",
            payload={"name": s.get("name")},
        )
    await db.commit()
    return {"ok": True}
