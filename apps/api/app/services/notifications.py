"""Создание сущностей уведомлений и внешних доставок (telegram / email).

Правило: одна запись `Notification` на логическое уведомление; строки `NotificationDelivery`
создаются отдельно после `flush`, когда известен `notification_id`.
"""
from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification, NotificationDelivery, NotificationPreferences
from app.models.user import User


def create_notification(
    *,
    user_id: str,
    notification_type: str,
    title: str,
    body: str,
    entity_type: str | None = None,
    entity_id: str | None = None,
    notification_id: str | None = None,
) -> Notification:
    """Новая строка `notifications` (ещё не в сессии). Один вызов — одно in-app уведомление."""
    return Notification(
        id=notification_id or str(uuid.uuid4()),
        user_id=user_id,
        type=notification_type,
        title=title,
        body=body,
        entity_type=entity_type,
        entity_id=entity_id,
        is_read=False,
    )


def create_notification_delivery(
    *,
    notification_id: str,
    channel: str,
    recipient: str,
    delivery_id: str | None = None,
) -> NotificationDelivery:
    """Новая строка `notification_deliveries` (pending). Не смешивать с созданием Notification."""
    return NotificationDelivery(
        id=delivery_id or str(uuid.uuid4()),
        notification_id=notification_id,
        channel=channel,
        recipient=recipient,
        status="pending",
        attempts=0,
        last_error=None,
        next_retry_at=None,
        sent_at=None,
    )


async def load_user_and_notification_pref_row(
    db: AsyncSession, user_id: str
) -> tuple[User | None, NotificationPreferences | None]:
    """Один проход: пользователь и строка prefs (user → default)."""
    user = await db.get(User, user_id)
    row = (
        await db.execute(select(NotificationPreferences).where(NotificationPreferences.id == user_id).limit(1))
    ).scalar_one_or_none()
    if not row:
        row = (
            await db.execute(select(NotificationPreferences).where(NotificationPreferences.id == "default").limit(1))
        ).scalar_one_or_none()
    return user, row


def prefs_dict_from_pref_row(pref_row: NotificationPreferences | None) -> dict[str, Any]:
    raw = pref_row.prefs if pref_row and pref_row.prefs else {}
    return raw if isinstance(raw, dict) else {}


async def get_notification_prefs_for_user(db: AsyncSession, user_id: str) -> dict[str, Any]:
    """Слитые prefs пользователя (или default-строка из `notification_prefs`)."""
    _, row = await load_user_and_notification_pref_row(db, user_id)
    return prefs_dict_from_pref_row(row)


def channel_flags_from_prefs(prefs: dict[str, Any]) -> dict[str, bool]:
    """Флаги каналов из prefs.channels."""
    ch = prefs.get("channels", {}) if isinstance(prefs, dict) else {}
    if not isinstance(ch, dict):
        ch = {}
    return {
        "in_app": bool(ch.get("in_app", True)),
        "chat": bool(ch.get("chat", True)),
        "telegram": bool(ch.get("telegram", False)),
        "email": bool(ch.get("email", False)),
    }


def telegram_recipient_from(user: User | None, pref_row: NotificationPreferences | None) -> str | None:
    """chat_id для Telegram из prefs + пользователя (без запросов к БД)."""
    prefs = pref_row.prefs if pref_row and pref_row.prefs else {}
    if not isinstance(prefs, dict):
        prefs = {}
    chat_id = (
        prefs.get("telegramChatId")
        or (user.telegram_user_id if user else None)
        or (pref_row.telegram_group_chat_id if pref_row else None)
    )
    return str(chat_id).strip() if chat_id else None


def email_recipient_from(user: User | None) -> str | None:
    if not user or not (user.email or "").strip():
        return None
    return user.email.strip()


async def resolve_telegram_recipient(db: AsyncSession, user_id: str) -> str | None:
    """Удобство для вызовов вне hot-path (один round-trip к БД)."""
    user, row = await load_user_and_notification_pref_row(db, user_id)
    return telegram_recipient_from(user, row)


async def resolve_email_recipient(db: AsyncSession, user_id: str) -> str | None:
    user, _ = await load_user_and_notification_pref_row(db, user_id)
    return email_recipient_from(user)
