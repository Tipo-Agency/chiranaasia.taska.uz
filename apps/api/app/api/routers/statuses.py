"""Statuses router."""
from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.json_http_cache import json_304_or_response
from app.db import get_db
from app.models.settings import StatusOption
from app.schemas.common_responses import OkResponse
from app.schemas.settings import StatusOptionItem
from app.services.domain_events import log_entity_mutation
from app.core.mappers import row_to_status
from app.core.auth import get_current_user

router = APIRouter(prefix="/statuses", tags=["statuses"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[StatusOptionItem])
async def get_statuses(request: Request, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(StatusOption).order_by(StatusOption.id))
    data = [row_to_status(s) for s in result.scalars().all()]
    return json_304_or_response(request, data=data, max_age=3600)


@router.put("", response_model=OkResponse)
async def update_statuses(statuses: list[StatusOptionItem], db: AsyncSession = Depends(get_db)):
    for s in statuses:
        sid = s.id
        existing = await db.get(StatusOption, sid)
        is_new = existing is None
        if existing:
            existing.name = s.name
            existing.color = s.color
            existing.is_archived = s.isArchived
        else:
            db.add(StatusOption(
                id=sid,
                name=s.name,
                color=s.color,
                is_archived=s.isArchived,
            ))
        await db.flush()
        await log_entity_mutation(
            db,
            event_type="settings.status.created" if is_new else "settings.status.updated",
            entity_type="status_option",
            entity_id=sid,
            source="statuses-router",
            payload={"name": s.name},
        )
    await db.commit()
    return {"ok": True}
