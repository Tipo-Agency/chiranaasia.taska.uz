"""Activity router."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.mappers import row_to_activity
from app.db import get_db
from app.models.settings import ActivityLog
from app.schemas.common_responses import OkResponse
from app.schemas.content import ActivityLogCreate, ActivityLogItem, ActivityLogRead
from app.services.domain_events import log_entity_mutation

router = APIRouter(prefix="/activity", tags=["activity"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[ActivityLogRead])
async def get_activity(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ActivityLog))
    return [row_to_activity(a) for a in result.scalars().all()]


@router.put("", response_model=OkResponse)
async def update_activity(logs: list[ActivityLogItem], db: AsyncSession = Depends(get_db)):
    import uuid

    batch_id = str(uuid.uuid4())
    row_count = 0
    for lg in logs:
        lid = lg.id
        row_count += 1
        existing = await db.get(ActivityLog, lid)
        if existing:
            existing.user_id = lg.userId or existing.user_id
            existing.user_name = lg.userName or existing.user_name
            existing.user_avatar = lg.userAvatar
            existing.action = lg.action or existing.action
            existing.details = lg.details
            existing.timestamp = lg.timestamp or existing.timestamp
            existing.read = lg.read
        else:
            db.add(ActivityLog(
                id=lid,
                user_id=lg.userId,
                user_name=lg.userName,
                user_avatar=lg.userAvatar,
                action=lg.action,
                details=lg.details,
                timestamp=lg.timestamp,
                read=lg.read,
            ))
    await db.flush()
    await log_entity_mutation(
        db,
        event_type="activity_log.bulk_synced",
        entity_type="activity_log",
        entity_id=batch_id,
        source="activity-router",
        payload={"rowCount": row_count},
    )
    await db.commit()
    return {"ok": True}


@router.post("", response_model=OkResponse)
async def add_activity(log: ActivityLogCreate, db: AsyncSession = Depends(get_db)):
    import uuid
    lid = log.id or str(uuid.uuid4())
    db.add(ActivityLog(
        id=lid,
        user_id=log.userId,
        user_name=log.userName,
        user_avatar=log.userAvatar,
        action=log.action,
        details=log.details,
        timestamp=log.timestamp,
        read=log.read,
    ))
    await db.flush()
    await log_entity_mutation(
        db,
        event_type="activity_log.created",
        entity_type="activity_log",
        entity_id=lid,
        source="activity-router",
        actor_id=log.userId or None,
        payload={"action": log.action},
    )
    await db.commit()
    return {"ok": True}
