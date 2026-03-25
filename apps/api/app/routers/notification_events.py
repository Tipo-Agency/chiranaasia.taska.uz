"""Domain notification events router (Phase 1 foundation)."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.notification import NotificationEvent
from app.schemas.notification_events import DomainEventIn, DomainEventOut
from app.services.domain_events import emit_domain_event

router = APIRouter(prefix="/notification-events", tags=["notification-events"])


@router.post("/publish", response_model=DomainEventOut)
async def publish_event(payload: DomainEventIn, db: AsyncSession = Depends(get_db)):
    """Create event log row and publish to Redis stream."""
    existing = await db.get(NotificationEvent, payload.id)
    if existing:
        return DomainEventOut(
            id=existing.id,
            published=bool(existing.published_to_stream),
            streamId=existing.stream_id,
        )

    eid = await emit_domain_event(
        db,
        event_type=payload.type,
        org_id=payload.orgId,
        entity_type=payload.entityType,
        entity_id=payload.entityId,
        source=payload.source,
        payload=payload.payload,
        actor_id=payload.actorId,
        correlation_id=payload.correlationId,
        event_id=payload.id,
        occurred_at=payload.occurredAt,
    )
    saved = await db.get(NotificationEvent, eid)
    return DomainEventOut(
        id=eid,
        published=bool(saved.published_to_stream) if saved else False,
        streamId=saved.stream_id if saved else None,
    )


@router.get("/recent")
async def recent_events(
    limit: int = Query(default=50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    """Debug endpoint: recent domain events."""
    result = await db.execute(
        select(NotificationEvent).order_by(desc(NotificationEvent.created_at)).limit(limit)
    )
    rows = result.scalars().all()
    return [
        {
            "id": r.id,
            "type": r.event_type,
            "occurredAt": r.occurred_at.isoformat() if r.occurred_at else None,
            "orgId": r.org_id,
            "entityType": r.entity_type,
            "entityId": r.entity_id,
            "source": r.source,
            "published": bool(r.published_to_stream),
            "streamId": r.stream_id,
            "createdAt": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]
