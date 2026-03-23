"""Best-effort delivery worker helpers (telegram/email placeholders)."""
from __future__ import annotations

from datetime import datetime, timezone, timedelta
import json
import smtplib
from email.message import EmailMessage

from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.notification import NotificationDelivery, Notification, NotificationPreferences
from app.models.user import User


def _to_int(value: str | None) -> int:
    try:
        return int(value or "0")
    except Exception:
        return 0


def _next_backoff_seconds(attempt: int) -> int:
    # 10s, 30s, 120s, 600s, 1800s, 3600s...
    plan = [10, 30, 120, 600, 1800]
    if attempt <= len(plan):
        return plan[attempt - 1]
    return 3600


def _send_telegram(token: str, chat_id: str, text: str) -> tuple[bool, str | None]:
    try:
        import urllib.request
        import urllib.parse

        payload = urllib.parse.urlencode({"chat_id": chat_id, "text": text}).encode()
        req = urllib.request.Request(
            f"https://api.telegram.org/bot{token}/sendMessage",
            data=payload,
            method="POST",
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        with urllib.request.urlopen(req, timeout=10) as resp:  # nosec B310
            raw = resp.read().decode("utf-8")
            parsed = json.loads(raw) if raw else {"ok": False}
            if parsed.get("ok"):
                return True, None
            return False, str(parsed.get("description") or "telegram_send_failed")
    except Exception as exc:
        return False, str(exc)


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


async def run_pending_deliveries(db: AsyncSession, limit: int = 100) -> dict:
    now = datetime.now(timezone.utc)
    rows = (
        await db.execute(
            select(NotificationDelivery)
            .where(NotificationDelivery.status == "pending")
            .where(
                or_(
                    NotificationDelivery.next_attempt_at.is_(None),
                    NotificationDelivery.next_attempt_at <= now,
                )
            )
            .order_by(NotificationDelivery.created_at.asc())
            .limit(limit)
        )
    ).scalars().all()

    sent = 0
    failed = 0
    skipped = 0
    settings = get_settings()

    for d in rows:
        n = await db.get(Notification, d.notification_id)
        if not n:
            d.status = "failed"
            d.last_error = "notification_not_found"
            d.attempts = str(int(d.attempts or "0") + 1)
            d.next_attempt_at = None
            d.updated_at = now
            failed += 1
            continue

        attempts = _to_int(d.attempts) + 1
        d.attempts = str(attempts)

        if d.channel == "telegram":
            user = await db.get(User, n.recipient_id)
            pref_row = (
                await db.execute(select(NotificationPreferences).where(NotificationPreferences.id == n.recipient_id).limit(1))
            ).scalar_one_or_none()
            if not pref_row:
                pref_row = (
                    await db.execute(select(NotificationPreferences).where(NotificationPreferences.id == "default").limit(1))
                ).scalar_one_or_none()

            prefs = pref_row.prefs if pref_row and pref_row.prefs else {}
            chat_id = (
                (prefs or {}).get("telegramChatId")
                or (user.telegram_user_id if user else None)
                or (pref_row.telegram_group_chat_id if pref_row else None)
            )

            if not settings.TELEGRAM_BOT_TOKEN:
                d.status = "failed"
                d.last_error = "telegram_not_configured"
                failed += 1
            elif not chat_id:
                d.status = "failed"
                d.last_error = "telegram_chat_id_missing"
                failed += 1
            else:
                ok, err = _send_telegram(
                    settings.TELEGRAM_BOT_TOKEN,
                    str(chat_id),
                    f"{n.title}\n\n{n.body}",
                )
                if ok:
                    d.status = "sent"
                    d.delivered_at = now
                    d.next_attempt_at = None
                    d.last_error = None
                    sent += 1
                else:
                    if attempts >= 10:
                        d.status = "failed"
                        d.next_attempt_at = None
                    else:
                        d.next_attempt_at = now + timedelta(seconds=_next_backoff_seconds(attempts))
                    d.last_error = err or "telegram_send_failed"
                    failed += 1
        elif d.channel == "email":
            user = await db.get(User, n.recipient_id)
            if not settings.SMTP_HOST:
                d.status = "failed"
                d.last_error = "smtp_not_configured"
                failed += 1
            elif not user or not user.email:
                d.status = "failed"
                d.last_error = "recipient_email_missing"
                failed += 1
            else:
                ok, err = _send_email(
                    host=settings.SMTP_HOST,
                    port=settings.SMTP_PORT,
                    user=settings.SMTP_USER,
                    password=settings.SMTP_PASSWORD,
                    sender=settings.SMTP_FROM,
                    to_email=user.email,
                    subject=n.title,
                    body=n.body,
                    use_tls=settings.SMTP_USE_TLS,
                )
                if ok:
                    d.status = "sent"
                    d.delivered_at = now
                    d.next_attempt_at = None
                    d.last_error = None
                    sent += 1
                else:
                    if attempts >= 10:
                        d.status = "failed"
                        d.next_attempt_at = None
                    else:
                        d.next_attempt_at = now + timedelta(seconds=_next_backoff_seconds(attempts))
                    d.last_error = err or "email_send_failed"
                    failed += 1
        else:
            skipped += 1

        d.updated_at = now

    await db.flush()
    return {
        "processed": len(rows),
        "sent": sent,
        "failed": failed,
        "skipped": skipped,
    }
