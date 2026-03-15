"""System endpoints: health, logs for admin."""
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, desc
from app.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.system_log import SystemLog

router = APIRouter(tags=["system"])


class SystemLogEntry(BaseModel):
    id: int
    created_at: str
    level: str
    message: str
    logger_name: Optional[str] = None
    path: Optional[str] = None
    request_id: Optional[str] = None
    payload: Optional[str] = None

    class Config:
        from_attributes = True


@router.get("/system/logs", response_model=List[SystemLogEntry])
async def get_system_logs(
    limit: int = Query(50, ge=1, le=200),
    level: Optional[str] = Query(None, description="Filter by level: ERROR, CRITICAL, WARNING"),
    db: AsyncSession = Depends(get_db),
):
    """Return recent system log entries (errors/audit) for admin UI."""
    q = select(SystemLog).order_by(desc(SystemLog.created_at)).limit(limit)
    if level:
        q = q.where(SystemLog.level == level.upper())
    result = await db.execute(q)
    rows = result.scalars().all()
    return [
        SystemLogEntry(
            id=r.id,
            created_at=r.created_at.isoformat() if r.created_at else "",
            level=r.level,
            message=r.message,
            logger_name=r.logger_name,
            path=r.path,
            request_id=r.request_id,
            payload=r.payload,
        )
        for r in rows
    ]
