"""Priorities router."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.settings import PriorityOption
from app.utils import row_to_priority
from app.services.domain_events import log_entity_mutation

router = APIRouter(prefix="/priorities", tags=["priorities"])


@router.get("")
async def get_priorities(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PriorityOption))
    return [row_to_priority(p) for p in result.scalars().all()]


@router.put("")
async def update_priorities(priorities: list[dict], db: AsyncSession = Depends(get_db)):
    for p in priorities:
        pid = p.get("id")
        if not pid:
            continue
        existing = await db.get(PriorityOption, pid)
        is_new = existing is None
        if existing:
            existing.name = p.get("name", existing.name)
            existing.color = p.get("color", existing.color)
        else:
            db.add(PriorityOption(
                id=pid,
                name=p.get("name", ""),
                color=p.get("color", ""),
            ))
        await db.flush()
        await log_entity_mutation(
            db,
            event_type="settings.priority.created" if is_new else "settings.priority.updated",
            entity_type="priority_option",
            entity_id=pid,
            source="priorities-router",
            payload={"name": p.get("name")},
        )
    await db.commit()
    return {"ok": True}
