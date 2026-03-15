"""Activity router."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.settings import ActivityLog
from app.utils import row_to_activity

router = APIRouter(prefix="/activity", tags=["activity"])


@router.get("")
async def get_activity(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ActivityLog))
    return [row_to_activity(a) for a in result.scalars().all()]


@router.put("")
async def update_activity(logs: list[dict], db: AsyncSession = Depends(get_db)):
    for lg in logs:
        lid = lg.get("id")
        if not lid:
            continue
        existing = await db.get(ActivityLog, lid)
        if existing:
            existing.user_id = lg.get("userId", existing.user_id)
            existing.user_name = lg.get("userName", existing.user_name)
            existing.user_avatar = lg.get("userAvatar")
            existing.action = lg.get("action", existing.action)
            existing.details = lg.get("details")
            existing.timestamp = lg.get("timestamp", existing.timestamp)
            existing.read = lg.get("read", False)
        else:
            db.add(ActivityLog(
                id=lid,
                user_id=lg.get("userId", ""),
                user_name=lg.get("userName", ""),
                user_avatar=lg.get("userAvatar"),
                action=lg.get("action", ""),
                details=lg.get("details"),
                timestamp=lg.get("timestamp", ""),
                read=lg.get("read", False),
            ))
    await db.commit()
    return {"ok": True}


@router.post("")
async def add_activity(log: dict, db: AsyncSession = Depends(get_db)):
    import uuid
    lid = log.get("id") or str(uuid.uuid4())
    db.add(ActivityLog(
        id=lid,
        user_id=log.get("userId", ""),
        user_name=log.get("userName", ""),
        user_avatar=log.get("userAvatar"),
        action=log.get("action", ""),
        details=log.get("details"),
        timestamp=log.get("timestamp", ""),
        read=log.get("read", False),
    ))
    await db.commit()
    return {"ok": True}
