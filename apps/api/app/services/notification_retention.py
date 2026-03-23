"""Retention jobs for notification-related data."""
from __future__ import annotations

from datetime import datetime, timezone, timedelta

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import (
    Notification,
    NotificationArchive,
    NotificationEvent,
    NotificationDelivery,
)


async def run_notification_retention(db: AsyncSession, days: int = 90, batch_size: int = 500) -> dict[str, int]:
    """
    Retention policy:
    - Technical logs (`notification_events`, `notification_deliveries`) are deleted after N days.
    - User notifications are moved to `notifications_archive` then deleted from hot table.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    old_notifications = (
        await db.execute(
            select(Notification)
            .where(Notification.created_at < cutoff)
            .order_by(Notification.created_at.asc())
            .limit(batch_size)
        )
    ).scalars().all()

    archived = 0
    for n in old_notifications:
        db.add(
            NotificationArchive(
                id=n.id,
                event_id=n.event_id,
                recipient_id=n.recipient_id,
                type=n.type,
                title=n.title,
                body=n.body,
                priority=n.priority,
                entity_type=n.entity_type,
                entity_id=n.entity_id,
                payload=n.payload or {},
                is_read=bool(n.is_read),
                read_at=n.read_at,
                created_at=n.created_at,
            )
        )
        await db.delete(n)
        archived += 1

    deleted_events = (
        await db.execute(delete(NotificationEvent).where(NotificationEvent.created_at < cutoff))
    ).rowcount or 0
    deleted_deliveries = (
        await db.execute(delete(NotificationDelivery).where(NotificationDelivery.created_at < cutoff))
    ).rowcount or 0

    await db.flush()
    return {
        "archived_notifications": int(archived),
        "deleted_events": int(deleted_events),
        "deleted_deliveries": int(deleted_deliveries),
    }
