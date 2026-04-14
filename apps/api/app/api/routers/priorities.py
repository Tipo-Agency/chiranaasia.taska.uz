"""Priorities router."""
from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.json_http_cache import json_304_or_response
from app.core.mappers import row_to_priority
from app.db import get_db
from app.models.settings import PriorityOption
from app.schemas.common_responses import OkResponse
from app.schemas.settings import PriorityOptionItem
from app.services.domain_events import log_entity_mutation

router = APIRouter(prefix="/priorities", tags=["priorities"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[PriorityOptionItem])
async def get_priorities(request: Request, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PriorityOption).order_by(PriorityOption.id))
    data = [row_to_priority(p) for p in result.scalars().all()]
    return json_304_or_response(request, data=data, max_age=3600)


@router.put("", response_model=OkResponse)
async def update_priorities(priorities: list[PriorityOptionItem], db: AsyncSession = Depends(get_db)):
    for p in priorities:
        pid = p.id
        existing = await db.get(PriorityOption, pid)
        is_new = existing is None
        if existing:
            existing.name = p.name
            existing.color = p.color
            existing.is_archived = p.isArchived
        else:
            db.add(PriorityOption(
                id=pid,
                name=p.name,
                color=p.color,
                is_archived=p.isArchived,
            ))
        await db.flush()
        await log_entity_mutation(
            db,
            event_type="settings.priority.created" if is_new else "settings.priority.updated",
            entity_type="priority_option",
            entity_id=pid,
            source="priorities-router",
            payload={"name": p.name},
        )
    await db.commit()
    return {"ok": True}
