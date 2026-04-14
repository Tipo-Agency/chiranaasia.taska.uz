"""
Доставка уведомлений в telegram / email.

- ``process_deliveries_for_notification`` — **только** из ``workers.notifications_worker`` (после XREADGROUP).
- HTTP API вызывает лишь ``enqueue_due_notification_delivery_jobs`` (XADD в stream); отправку в каналы из Uvicorn не выполняет.
- Telegram: ``telegram_sender`` (токен воронки из prefs, затем env), учёт 429 / ``retry_after``.
"""
from __future__ import annotations

import html
import smtplib
import uuid
from datetime import UTC, datetime, timedelta
from email.message import EmailMessage
from typing import Any

from sqlalchemy import and_, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.dead_letter_queue import DeadLetterQueue
from app.models.notification import Notification, NotificationDelivery
from app.services.telegram_sender import (
    resolve_notification_telegram_bot_token,
    send_telegram_message,
)

# Сколько раз разрешено получить ошибку отправки; на MAX_ATTEMPTS-й — только dead (без retry).
MAX_ATTEMPTS = 5

# После ошибки: attempts += 1; next_retry_at = now + пауза (пока attempts < MAX_ATTEMPTS).
# Индекс = (attempts после инкремента): 1→1 мин, 2→5 мин, 3→15 мин, 4→1 ч; при attempts == 5 → dead.
_BACKOFF_SECONDS_AFTER_ERROR: tuple[int, ...] = (
    60,  # 1 мин
    300,  # 5 мин
    900,  # 15 мин
    3600,  # 1 час
)


def _backoff_seconds_for_retry(attempts_after_error: int) -> int:
    """Пауза перед следующей попыткой; ``attempts_after_error`` — уже увеличенный счётчик (1..MAX_ATTEMPTS-1)."""
    idx = attempts_after_error - 1
    if 0 <= idx < len(_BACKOFF_SECONDS_AFTER_ERROR):
        return _BACKOFF_SECONDS_AFTER_ERROR[idx]
    return _BACKOFF_SECONDS_AFTER_ERROR[-1]


def _mark_delivery_dead(d: NotificationDelivery, last_error: str) -> None:
    d.status = "dead"
    d.last_error = last_error
    d.next_retry_at = None


async def _dead_letter_notification_delivery(
    db: AsyncSession,
    d: NotificationDelivery,
    *,
    reason: str,
    notification_id: str | None = None,
    extra: dict[str, Any] | None = None,
) -> None:
    """Фиксируем переход доставки в dead в DLQ (сообщение не теряется для разбора)."""
    settings = get_settings()
    err_text = (d.last_error or reason or "")[:8000]
    payload: dict[str, Any] = {
        "kind": "notification_delivery",
        "reason": reason,
        "notification_id": notification_id or d.notification_id,
        "delivery_id": d.id,
        "channel": d.channel,
        "attempts": int(d.attempts or 0),
    }
    if d.recipient:
        payload["recipient_hint"] = (d.recipient or "")[:256]
    if extra:
        payload.update(extra)
    db.add(
        DeadLetterQueue(
            id=str(uuid.uuid4()),
            queue_name=settings.REDIS_NOTIFICATIONS_STREAM,
            payload=payload,
            error=err_text,
            resolved=False,
        )
    )


def _telegram_html_from_notification(n: Notification) -> tuple[str, str]:
    """HTML для Telegram (parse_mode) из сохранённых title + body."""
    safe_title = html.escape(n.title or "")
    body = n.body or ""
    safe_body = html.escape(body).replace("\n", "<br/>")
    text_out = f"<b>{safe_title}</b><br/><br/>{safe_body}"
    if len(text_out) > 4000:
        text_out = text_out[:3997] + "..."
    return text_out, "HTML"


def _send_email(
    *,
    host: str,
    port: int,
    user: str,
    password: str,
    sender: str,
    to_email: str,
    subject: str,
    body: str,
    use_tls: bool,
) -> tuple[bool, str | None]:
    try:
        msg = EmailMessage()
        msg["From"] = sender
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.set_content(body)

        with smtplib.SMTP(host, port, timeout=12) as smtp:
            if use_tls:
                smtp.starttls()
            if user:
                smtp.login(user, password)
            smtp.send_message(msg)
        return True, None
    except Exception as exc:
        return False, str(exc)


def _should_ack_stream_for_deliveries(rows: list[NotificationDelivery]) -> bool:
    """
    XACK, если по уведомлению нечего делать сейчас: всё terminal или только retry в будущем.
    Иначе сообщение остаётся в PEL → XAUTOCLAIM после idle (в т.ч. ожидание backoff).
    """
    und = [d for d in rows if d.status not in ("sent", "dead")]
    if not und:
        return True
    now = datetime.now(UTC)
    if any(d.status == "sending" for d in und):
        return False
    if any(d.status == "pending" for d in und):
        return False
    for d in und:
        if d.status == "retry":
            if d.next_retry_at is None or d.next_retry_at <= now:
                return False
    return True


async def process_deliveries_for_notification(db: AsyncSession, notification_id: str) -> dict[str, Any]:
    """
    Обработать все «готовые» telegram/email доставки для одного уведомления.
    Не делает commit — вызывающий коммитит после успеха.
    """
    now = datetime.now(UTC)
    settings = get_settings()

    await db.execute(
        update(NotificationDelivery)
        .where(
            NotificationDelivery.notification_id == notification_id,
            NotificationDelivery.status == "sending",
        )
        .values(status="pending")
    )
    await db.flush()

    all_rows = (
        (
            await db.execute(
                select(NotificationDelivery).where(
                    NotificationDelivery.notification_id == notification_id,
                    NotificationDelivery.channel.in_(("telegram", "email")),
                )
            )
        )
        .scalars()
        .all()
    )

    if not all_rows:
        return {"processed": 0, "sent": 0, "failed": 0, "should_ack_stream": True}

    due = [
        d
        for d in all_rows
        if d.status in ("pending", "retry")
        and (d.next_retry_at is None or d.next_retry_at <= now)
    ]

    if not due:
        return {
            "processed": 0,
            "sent": 0,
            "failed": 0,
            "should_ack_stream": _should_ack_stream_for_deliveries(list(all_rows)),
        }

    sent = 0
    dead = 0

    for d in due:
        d.status = "sending"
    await db.flush()

    for d in due:
        n = await db.get(Notification, d.notification_id)
        if not n:
            _mark_delivery_dead(d, "notification_not_found")
            await _dead_letter_notification_delivery(db, d, reason="notification_not_found")
            dead += 1
            continue

        rcpt = (d.recipient or "").strip()
        if not rcpt:
            _mark_delivery_dead(d, "recipient_empty")
            await _dead_letter_notification_delivery(db, d, reason="recipient_empty")
            dead += 1
            continue

        ok = False
        err: str | None = None

        if d.channel == "telegram":
            bot_token = await resolve_notification_telegram_bot_token(db, n.user_id)
            if not bot_token:
                _mark_delivery_dead(d, "telegram_not_configured")
                await _dead_letter_notification_delivery(db, d, reason="telegram_not_configured")
                dead += 1
                continue
            tg_text, tg_mode = _telegram_html_from_notification(n)
            tg_out = await send_telegram_message(bot_token, rcpt, tg_text, parse_mode=tg_mode)
            ok = tg_out.ok
            err = tg_out.error
            if tg_out.rate_limited:
                sec = int(tg_out.retry_after_seconds or 60)
                d.status = "retry"
                d.last_error = err or "telegram_429"
                d.next_retry_at = now + timedelta(seconds=sec)
                continue
        elif d.channel == "email":
            if not settings.SMTP_HOST:
                _mark_delivery_dead(d, "smtp_not_configured")
                await _dead_letter_notification_delivery(db, d, reason="smtp_not_configured")
                dead += 1
                continue
            ok, err = _send_email(
                host=settings.SMTP_HOST,
                port=settings.SMTP_PORT,
                user=settings.SMTP_USER,
                password=settings.SMTP_PASSWORD,
                sender=settings.SMTP_FROM,
                to_email=rcpt,
                subject=n.title,
                body=n.body or "",
                use_tls=settings.SMTP_USE_TLS,
            )
        else:
            _mark_delivery_dead(d, "unknown_channel")
            await _dead_letter_notification_delivery(db, d, reason="unknown_channel")
            dead += 1
            continue

        if ok:
            d.status = "sent"
            d.sent_at = now
            d.next_retry_at = None
            d.last_error = None
            sent += 1
            continue

        d.attempts = int(d.attempts or 0) + 1
        d.last_error = err or "send_failed"
        if d.attempts >= MAX_ATTEMPTS:
            _mark_delivery_dead(d, d.last_error or "send_failed")
            await _dead_letter_notification_delivery(
                db,
                d,
                reason="max_attempts_exhausted",
                extra={"transport_error": (err or "")[:2000]},
            )
            dead += 1
        else:
            d.status = "retry"
            d.next_retry_at = now + timedelta(seconds=_backoff_seconds_for_retry(d.attempts))

    await db.flush()

    refreshed = (
        (
            await db.execute(
                select(NotificationDelivery).where(
                    NotificationDelivery.notification_id == notification_id,
                    NotificationDelivery.channel.in_(("telegram", "email")),
                )
            )
        )
        .scalars()
        .all()
    )

    return {
        "processed": len(due),
        "sent": sent,
        "failed": dead,
        "should_ack_stream": _should_ack_stream_for_deliveries(list(refreshed)),
    }


async def enqueue_due_notification_delivery_jobs(
    db: AsyncSession, redis: Any, *, limit: int = 500
) -> dict[str, int]:
    """
    Для ручного дренажа: XADD по каждому notification_id, у которого есть работа в БД.
    Сама отправка выполняется только воркером stream.
    """
    from app.services.notifications_stream import ensure_notifications_stream, xadd_notification_job

    await ensure_notifications_stream(redis)
    now = datetime.now(UTC)
    ids = (
        (
            await db.execute(
                select(NotificationDelivery.notification_id)
                .distinct()
                .where(
                    NotificationDelivery.channel.in_(("telegram", "email")),
                    or_(
                        NotificationDelivery.status == "sending",
                        and_(
                            NotificationDelivery.status.in_(("pending", "retry")),
                            or_(
                                NotificationDelivery.next_retry_at.is_(None),
                                NotificationDelivery.next_retry_at <= now,
                            ),
                        ),
                    ),
                )
                .limit(limit)
            )
        )
        .scalars()
        .all()
    )
    for nid in ids:
        await xadd_notification_job(redis, str(nid))
    return {"queued": len(ids)}
