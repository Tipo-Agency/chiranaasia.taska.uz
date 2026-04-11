"""System endpoints: health, logs for admin."""

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user_admin
from app.database import get_db
from app.models.system_log import SystemLog
from app.models.user import User

router = APIRouter(tags=["system"])


class SystemLogEntry(BaseModel):
    id: int
    created_at: str
    level: str
    message: str
    logger_name: str | None = None
    path: str | None = None
    request_id: str | None = None
    payload: str | None = None

    class Config:
        from_attributes = True


async def fetch_system_log_entries(
    db: AsyncSession,
    limit: int,
    level: str | None,
) -> list[SystemLogEntry]:
    """Чтение system_logs для админ-UI (общая логика для /admin/logs и legacy /system/logs)."""
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


@router.get(
    "/system/logs",
    response_model=list[SystemLogEntry],
    deprecated=True,
    summary="Системные логи (legacy)",
)
async def get_system_logs_legacy(
    limit: int = Query(50, ge=1, le=200),
    level: str | None = Query(None, description="Filter by level: ERROR, CRITICAL, WARNING"),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user_admin),
):
    """Используйте `GET /api/admin/logs`. Требует право системной админки (`admin.system`)."""
    return await fetch_system_log_entries(db, limit, level)
