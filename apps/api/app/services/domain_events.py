"""Helpers to emit canonical domain events from business routers."""
from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.redis import get_redis_client
from app.models.notification import NotificationEvent
from app.services.event_bus import publish_domain_event
from app.services.notification_hub import process_domain_event

DEFAULT_ORG_ID = "default"
_LOG = logging.getLogger(__name__)

# Ключ session.info для отложенного XADD (см. flush_pending_domain_stream_publish, get_db).
DOMAIN_EVENTS_POST_COMMIT_QUEUE_KEY = "_post_commit_domain_publish"
POST_COMMIT_NOTIFICATION_JOBS_KEY = "_post_commit_notification_jobs"


async def log_entity_mutation(
    db: AsyncSession,
    *,
    event_type: str,
    entity_type: str,
    entity_id: str,
    source: str,
    payload: dict[str, Any] | None = None,
    actor_id: str | None = None,
) -> str:
    """
    Persist notification_event + publish to Redis Stream + run notification hub.
    Используйте для любых CRUD-операций; hub создаст пользовательские уведомления
    только для известных типов в notification_hub._route_event.
    """
    return await emit_domain_event(
        db,
        event_type=event_type,
        org_id=DEFAULT_ORG_ID,
        entity_type=entity_type,
        entity_id=entity_id,
        source=source,
        payload=payload or {},
        actor_id=actor_id,
    )


async def emit_domain_event(
    db: AsyncSession,
    *,
    event_type: str,
    org_id: str,
    entity_type: str,
    entity_id: str,
    source: str,
    payload: dict[str, Any],
    actor_id: str | None = None,
    correlation_id: str | None = None,
    event_id: str | None = None,
    occurred_at: datetime | None = None,
) -> str:
    """Persist, publish to Redis stream and process in notification hub."""
    eid = event_id or str(uuid4())
    ts = occurred_at or datetime.now(UTC)

    # idempotency safeguard
    existing = await db.get(NotificationEvent, eid)
    if existing:
        return existing.id

    row = NotificationEvent(
        id=eid,
        event_type=event_type,
        occurred_at=ts,
        actor_id=actor_id,
        org_id=org_id,
        entity_type=entity_type,
        entity_id=entity_id,
        source=source,
        correlation_id=correlation_id,
        payload=payload,
    )
    db.add(row)
    await db.flush()

    raw = {
        "id": eid,
        "type": event_type,
        "occurredAt": ts,
        "actorId": actor_id,
        "orgId": org_id,
        "entityType": entity_type,
        "entityId": entity_id,
        "source": source,
        "correlationId": correlation_id,
        "payload": payload,
    }
    settings = get_settings()
    redis = await get_redis_client()
    # Иначе воркер читает XADD до commit HTTP-транзакции и не видит строку в БД → PEL без XACK.
    if settings.DOMAIN_EVENTS_HUB_ASYNC and redis is not None:
        db.info.setdefault(DOMAIN_EVENTS_POST_COMMIT_QUEUE_KEY, []).append({"eid": eid, "raw": raw})
        await db.flush()
        return eid

    published, stream_id = await publish_domain_event(raw)
    row.published_to_stream = bool(published)
    row.stream_id = stream_id
    await db.flush()

    queued_notifications = await process_domain_event(db, raw)
    if queued_notifications:
        db.info.setdefault(POST_COMMIT_NOTIFICATION_JOBS_KEY, []).extend(queued_notifications)
    row.hub_processed_at = datetime.now(UTC)
    await db.flush()
    return eid


async def flush_post_commit_notification_jobs(session: AsyncSession) -> None:
    """После commit HTTP-сессии: XADD в queue.notifications (доставки уже в БД)."""
    ids = session.info.pop(POST_COMMIT_NOTIFICATION_JOBS_KEY, None)
    if not ids:
        return
    try:
        from app.services.notifications_stream import enqueue_notification_delivery_jobs

        await enqueue_notification_delivery_jobs([str(x) for x in ids if x])
    except Exception as exc:
        _LOG.exception("flush_post_commit_notification_jobs: %s", exc)


async def flush_pending_domain_stream_publish(session: AsyncSession) -> None:
    """Вызвать после успешного commit сессии из get_db: XADD в Redis для отложенных async-событий."""
    pending = session.info.pop(DOMAIN_EVENTS_POST_COMMIT_QUEUE_KEY, None)
    if not pending:
        return
    for item in pending:
        eid = str(item.get("eid") or "")
        raw = item.get("raw")
        if not eid or not isinstance(raw, dict):
            continue
        try:
            published, stream_id = await publish_domain_event(raw)
        except Exception as exc:
            _LOG.exception("flush_pending_domain_stream_publish: XADD failed eid=%s: %s", eid, exc)
            continue
        row = await session.get(NotificationEvent, eid)
        if row is None:
            _LOG.error("flush_pending_domain_stream_publish: row missing after commit eid=%s", eid)
            continue
        row.published_to_stream = bool(published)
        row.stream_id = stream_id
        await session.flush()
