"""Запись audit_logs в текущей AsyncSession (тот же commit, что и у мутации)."""
from __future__ import annotations

import json
import uuid
from typing import Any, Literal

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.request_context import get_request_id
from app.models.audit_log import AuditLog

AuditAction = Literal["create", "update", "delete"]
EntityType = Literal["task", "deal", "user", "finance_request", "client"]

_MAX_PAYLOAD_JSON = 48_000


def _safe_payload(payload: dict[str, Any] | None) -> dict[str, Any]:
    if not payload:
        return {}
    try:
        raw = json.dumps(payload, ensure_ascii=False, default=str)
    except (TypeError, ValueError):
        return {"_error": "payload_not_serializable"}
    if len(raw) > _MAX_PAYLOAD_JSON:
        return {"_truncated": True, "preview": raw[:_MAX_PAYLOAD_JSON]}
    return payload


async def log_mutation(
    db: AsyncSession,
    action: AuditAction,
    entity_type: EntityType,
    entity_id: str,
    *,
    actor_id: str | None = None,
    source: str | None = None,
    request_id: str | None = None,
    payload: dict[str, Any] | None = None,
) -> str:
    """
    Добавляет строку в audit_logs и делает flush в текущей транзакции.
    Вызывать после изменения сущности (и flush ORM при необходимости), до commit.
    """
    effective_request_id = request_id if request_id else get_request_id()
    row = AuditLog(
        id=str(uuid.uuid4()),
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        actor_id=actor_id,
        source=source,
        request_id=effective_request_id,
        payload=_safe_payload(payload),
    )
    db.add(row)
    await db.flush()
    return row.id
