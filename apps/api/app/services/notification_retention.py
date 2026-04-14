"""Retention jobs for notification-related data."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, exists, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import (
    Notification,
    NotificationArchive,
    NotificationDelivery,
    NotificationEvent,
)


async def run_notification_retention(db: AsyncSession, days: int = 90, batch_size: int = 500) -> dict[str, int]:
    """
    Retention policy:
    - `notification_events` старше cutoff удаляются.
    - Доставки, привязанные к старым уведомлениям или «сироты», удаляются.
    - User notifications переносятся в `notifications_archive`, затем удаляются из hot-таблицы.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    deleted_deliveries = (
        await db.execute(
            delete(NotificationDelivery).where(
                NotificationDelivery.notification_id.in_(select(Notification.id).where(Notification.created_at < cutoff))
            )
        )
    ).rowcount or 0

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
                user_id=n.user_id,
                type=n.type,
                title=n.title,
                body=n.body,
                entity_type=n.entity_type,
                entity_id=n.entity_id,
                is_read=bool(n.is_read),
                created_at=n.created_at,
            )
        )
        await db.delete(n)
        archived += 1

    deleted_events = (
        await db.execute(delete(NotificationEvent).where(NotificationEvent.created_at < cutoff))
    ).rowcount or 0
    deleted_orphan_deliveries = (
        await db.execute(
            delete(NotificationDelivery).where(
                ~exists(select(1).where(Notification.id == NotificationDelivery.notification_id))
            )
        )
    ).rowcount or 0

    await db.flush()
    return {
        "archived_notifications": int(archived),
        "deleted_events": int(deleted_events),
        "deleted_deliveries": int(deleted_deliveries) + int(deleted_orphan_deliveries),
    }
