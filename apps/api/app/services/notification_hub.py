"""Notification hub: route domain events to user notifications/channels."""
from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification, NotificationDelivery, NotificationPreferences
from app.models.settings import InboxMessage
from app.services.notifications_realtime import realtime_hub

SYSTEM_SENDER_ID = "system"


def _mk_notification(
    *,
    event_id: str,
    recipient_id: str,
    event_type: str,
    title: str,
    body: str,
    priority: str = "normal",
    entity_type: str | None = None,
    entity_id: str | None = None,
    payload: dict[str, Any] | None = None,
) -> Notification:
    return Notification(
        id=str(uuid.uuid4()),
        event_id=event_id,
        recipient_id=recipient_id,
        type=event_type,
        title=title,
        body=body,
        priority=priority,
        entity_type=entity_type,
        entity_id=entity_id,
        payload=payload or {},
        is_read=False,
    )


def _delivery(notification_id: str, channel: str, status: str = "pending", attempts: int = 0, error: str | None = None) -> NotificationDelivery:
    now = datetime.now(UTC)
    return NotificationDelivery(
        id=str(uuid.uuid4()),
        notification_id=notification_id,
        channel=channel,
        status=status,
        attempts=str(attempts),
        last_error=error,
        delivered_at=now if status == "sent" else None,
        updated_at=now,
    )


def _route_event(event: dict[str, Any]) -> list[dict[str, Any]]:
    """
    Return recipient notifications.
    Event shape follows DomainEventIn.
    """
    et = event.get("type")
    payload = event.get("payload") or {}
    actor_name = payload.get("actorName") or "Система"
    routes: list[dict[str, Any]] = []

    if et == "task.assigned":
        uid = payload.get("assigneeId")
        if uid:
            routes.append(
                {
                    "recipient_id": uid,
                    "title": "Новая задача",
                    "body": f'{actor_name} поставил вам задачу: "{payload.get("title") or "Без названия"}"',
                    "priority": payload.get("priority") or "high",
                }
            )
    elif et == "task.status.changed":
        for uid in [payload.get("assigneeId"), payload.get("createdByUserId")]:
            if uid:
                routes.append(
                    {
                        "recipient_id": uid,
                        "title": "Статус задачи изменен",
                        "body": f'Задача "{payload.get("title") or "Без названия"}" -> {payload.get("status") or "Новый статус"}',
                        "priority": "normal",
                    }
                )
    elif et == "deal.assigned":
        uid = payload.get("assigneeId")
        if uid:
            routes.append(
                {
                    "recipient_id": uid,
                    "title": "Новая сделка",
                    "body": f'{actor_name} назначил вам сделку: "{payload.get("title") or "Без названия"}"',
                    "priority": "high",
                }
            )
    elif et == "meeting.created":
        for uid in payload.get("participantIds") or []:
            routes.append(
                {
                    "recipient_id": uid,
                    "title": "Новая встреча",
                    "body": f'Запланирована встреча: "{payload.get("title") or "Без названия"}" {payload.get("date") or ""} {payload.get("time") or ""}'.strip(),
                    "priority": "normal",
                }
            )
    elif et == "document.shared":
        for uid in payload.get("recipientIds") or []:
            routes.append(
                {
                    "recipient_id": uid,
                    "title": "Документ открыт вам",
                    "body": f'Документ "{payload.get("title") or "Без названия"}" доступен для просмотра',
                    "priority": "normal",
                }
            )

    # dedupe recipient per event
    uniq: dict[str, dict[str, Any]] = {}
    for r in routes:
        uniq[r["recipient_id"]] = r
    return list(uniq.values())


async def process_domain_event(db: AsyncSession, event: dict[str, Any]) -> int:
    """
    Build and persist notifications + deliveries for event.
    Also emits realtime and writes chat mirror message.
    Returns created notifications count.
    """
    routes = _route_event(event)
    created = 0
    for r in routes:
        prefs_row = (
            await db.execute(
                select(NotificationPreferences).where(NotificationPreferences.id == r["recipient_id"]).limit(1)
            )
        ).scalar_one_or_none()
        if not prefs_row:
            prefs_row = (
                await db.execute(
                    select(NotificationPreferences).where(NotificationPreferences.id == "default").limit(1)
                )
            ).scalar_one_or_none()
        prefs = (prefs_row.prefs if prefs_row and prefs_row.prefs else {}) if prefs_row else {}

        channels_cfg = prefs.get("channels", {}) if isinstance(prefs, dict) else {}
        in_app_enabled = channels_cfg.get("in_app", True)
        chat_enabled = channels_cfg.get("chat", True)
        telegram_enabled = channels_cfg.get("telegram", False)
        email_enabled = channels_cfg.get("email", False)

        n = _mk_notification(
            event_id=event["id"],
            recipient_id=r["recipient_id"],
            event_type=event["type"],
            title=r["title"],
            body=r["body"],
            priority=r.get("priority", "normal"),
            entity_type=event.get("entityType"),
            entity_id=event.get("entityId"),
            payload=event.get("payload") or {},
        )
        db.add(n)
        await db.flush()

        if in_app_enabled:
            # in-app delivery is considered sent on persist
            db.add(_delivery(n.id, "in_app", status="sent"))

        if chat_enabled:
            # mirror to chat (internal inbox_messages)
            msg = InboxMessage(
                id=str(uuid.uuid4()),
                sender_id=SYSTEM_SENDER_ID,
                recipient_id=r["recipient_id"],
                text=r["body"],
                attachments=[
                    {
                        "entityType": event.get("entityType"),
                        "entityId": event.get("entityId"),
                        "label": r["title"],
                    }
                ],
                created_at=datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z",
                read=False,
            )
            db.add(msg)
            db.add(_delivery(n.id, "chat", status="sent"))

        # placeholders for future channel workers
        if telegram_enabled:
            db.add(_delivery(n.id, "telegram", status="pending"))
        if email_enabled:
            db.add(_delivery(n.id, "email", status="pending"))

        if in_app_enabled:
            await realtime_hub.emit(
                r["recipient_id"],
                {
                    "type": "notification.created",
                    "notification": {
                        "id": n.id,
                        "title": n.title,
                        "body": n.body,
                        "priority": n.priority,
                        "entityType": n.entity_type,
                        "entityId": n.entity_id,
                    },
                },
            )
        created += 1
    return created
