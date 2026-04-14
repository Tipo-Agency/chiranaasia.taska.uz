"""System endpoints: legacy logs (deprecated); чтение audit_logs. Только ``get_current_user_admin`` (admin.system).

Публичный ``GET …/system/health`` — в ``public_router`` (без JWT), см. ``main.py``.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Response
from pydantic import BaseModel
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user_admin
from app.core.config import get_settings
from app.db import get_db
from app.models.audit_log import AuditLog
from app.models.system_log import SystemLog
from app.schemas.common_responses import SystemPublicHealthResponse

router = APIRouter(tags=["system"], dependencies=[Depends(get_current_user_admin)])

public_router = APIRouter(tags=["system"])


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


class AuditLogEntry(BaseModel):
    id: str
    created_at: str
    action: str
    entity_type: str
    entity_id: str
    actor_id: str | None = None
    source: str | None = None
    request_id: str | None = None
    payload: dict

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


async def fetch_audit_log_entries(
    db: AsyncSession,
    limit: int,
    entity_type: str | None,
    entity_id: str | None,
) -> list[AuditLogEntry]:
    q = select(AuditLog).order_by(desc(AuditLog.created_at)).limit(limit)
    if entity_type:
        q = q.where(AuditLog.entity_type == entity_type)
    if entity_id:
        q = q.where(AuditLog.entity_id == entity_id)
    result = await db.execute(q)
    rows = result.scalars().all()
    return [
        AuditLogEntry(
            id=r.id,
            created_at=r.created_at.isoformat() if r.created_at else "",
            action=r.action,
            entity_type=r.entity_type,
            entity_id=r.entity_id,
            actor_id=r.actor_id,
            source=r.source,
            request_id=r.request_id,
            payload=dict(r.payload) if isinstance(r.payload, dict) else {},
        )
        for r in rows
    ]


@router.get(
    "/system/logs",
    response_model=list[SystemLogEntry],
    deprecated=True,
    summary="Системные логи (legacy, deprecated)",
    description=(
        "**Deprecated.** Используйте канонический `GET /api/admin/logs` (с префиксом из настроек API). "
        "Те же требования: JWT + право `admin.system` (``Depends(get_current_user_admin)``). В ответе — те же данные; добавлены заголовки `Deprecation` и `Link`."
    ),
    responses={
        401: {"description": "Нет или просрочен JWT"},
        403: {"description": "Нет права `admin.system`"},
    },
)
async def get_system_logs_legacy(
    response: Response,
    limit: int = Query(50, ge=1, le=200),
    level: str | None = Query(None, description="Filter by level: ERROR, CRITICAL, WARNING"),
    db: AsyncSession = Depends(get_db),
):
    """Без JWT — 401; без `admin.system` — 403. Канон: `GET /api/admin/logs` (см. заголовок Link)."""
    prefix = (get_settings().API_PREFIX or "/api").rstrip("/") or "/api"
    response.headers["Deprecation"] = "true"
    response.headers["Link"] = f'<{prefix}/admin/logs>; rel="alternate"'
    return await fetch_system_log_entries(db, limit, level)


@router.get(
    "/system/audit",
    response_model=list[AuditLogEntry],
    summary="Журнал audit_logs (admin)",
    description=(
        "Чтение таблицы ``audit_logs``. Только ``Depends(get_current_user_admin)`` → право ``admin.system``. "
        "Без валидной сессии — 401, без права — 403."
    ),
    responses={
        401: {"description": "Нет или просрочен JWT"},
        403: {"description": "Нет права `admin.system`"},
    },
)
async def get_system_audit(
    limit: int = Query(50, ge=1, le=500),
    entity_type: str | None = Query(None, description="Фильтр по entity_type (например task, deal)"),
    entity_id: str | None = Query(None, description="Фильтр по entity_id (UUID сущности)"),
    db: AsyncSession = Depends(get_db),
):
    return await fetch_audit_log_entries(db, limit, entity_type, entity_id)


@public_router.get(
    "/system/health",
    response_model=SystemPublicHealthResponse,
    summary="Публичный health (под префиксом API)",
    description=(
        "Не требует аутентификации. Стабильный JSON для мониторинга за прокси `/api/`. "
        "Проверка БД не выполняется — для readiness см. корневой `GET /health`."
    ),
)
async def system_health_public():
    return SystemPublicHealthResponse()
