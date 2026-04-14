"""Операции с таблицей ``dead_letter_queue`` (админка, requeue)."""
from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.dead_letter_queue import DeadLetterQueue
from app.models.notification import NotificationDelivery
from app.services.notifications_stream import ensure_notifications_stream, xadd_notification_job


async def list_dlq_rows(
    db: AsyncSession,
    *,
    unresolved_only: bool = True,
    limit: int = 50,
) -> list[DeadLetterQueue]:
    stmt = select(DeadLetterQueue).order_by(DeadLetterQueue.created_at.desc()).limit(limit)
    if unresolved_only:
        stmt = stmt.where(DeadLetterQueue.resolved.is_(False))
    return list((await db.execute(stmt)).scalars().all())


async def resolve_dlq_row(db: AsyncSession, row_id: str) -> bool:
    row = await db.get(DeadLetterQueue, row_id)
    if not row:
        return False
    row.resolved = True
    await db.flush()
    return True


async def requeue_dlq_row(db: AsyncSession, redis: Any, row_id: str) -> tuple[bool, str]:
    """
    Повторная постановка в stream для известных видов payload.
    Сейчас: ``kind=notification_delivery`` → pending доставка + XADD ``notification_id``.
    """
    row = await db.get(DeadLetterQueue, row_id)
    if not row:
        return False, "not_found"
    if row.resolved:
        return False, "already_resolved"
    payload = row.payload if isinstance(row.payload, dict) else {}
    kind = str(payload.get("kind") or "")

    if kind == "notification_delivery":
        nid = str(payload.get("notification_id") or "").strip()
        did = str(payload.get("delivery_id") or "").strip()
        if not nid:
            return False, "missing_notification_id"
        d = await db.get(NotificationDelivery, did) if did else None
        if d:
            d.status = "pending"
            d.attempts = 0
            d.last_error = None
            d.next_retry_at = None
        await ensure_notifications_stream(redis)
        await xadd_notification_job(redis, nid)
        row.resolved = True
        await db.flush()
        return True, "requeued_notification_delivery"

    return False, f"unsupported_kind:{kind or 'empty'}"
