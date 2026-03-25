"""Helpers to emit canonical domain events from business routers."""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import NotificationEvent
from app.services.event_bus import publish_domain_event
from app.services.notification_hub import process_domain_event

DEFAULT_ORG_ID = "default"


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
    published, stream_id = await publish_domain_event(raw)
    row.published_to_stream = published
    row.stream_id = stream_id
    await db.flush()

    await process_domain_event(db, raw)
    await db.flush()
    return eid
