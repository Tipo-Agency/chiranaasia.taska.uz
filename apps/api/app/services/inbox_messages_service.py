"""Запись в inbox_messages с дедупликацией по (channel, external_msg_id)."""
from __future__ import annotations

import logging
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.settings import InboxMessage

log = logging.getLogger("uvicorn.error")

# Совпадает с inbox_messages.external_msg_id VARCHAR(512)
MAX_EXTERNAL_MSG_ID_LEN = 512


def normalize_external_msg_id(raw: Any) -> str | None:
    """
    Пустое / пробелы → None (без участия в UNIQUE, вставка без ON CONFLICT по паре).
    Слишком длинное → обрезка до MAX_EXTERNAL_MSG_ID_LEN с предупреждением в лог.
    """
    if raw is None:
        return None
    s = str(raw).strip()
    if not s:
        return None
    if len(s) > MAX_EXTERNAL_MSG_ID_LEN:
        log.warning(
            "inbox_messages: external_msg_id truncated from %s to %s chars",
            len(s),
            MAX_EXTERNAL_MSG_ID_LEN,
        )
        s = s[:MAX_EXTERNAL_MSG_ID_LEN]
    return s


async def add_inbox_message(
    db: AsyncSession,
    *,
    id: str | None = None,
    deal_id: str | None = None,
    funnel_id: str | None = None,
    direction: str = "internal",
    channel: str = "internal",
    sender_id: str = "",
    body: str = "",
    media_url: str | None = None,
    external_msg_id: str | None = None,
    recipient_id: str | None = None,
    attachments: list | None = None,
    created_at: str,
    is_read: bool = False,
) -> tuple[str, bool]:
    """
    Возвращает (id, inserted).
    При непустом external_msg_id: INSERT ... ON CONFLICT (channel, external_msg_id) DO NOTHING;
    при конфликте — существующий id и inserted=False (дубликат логируется).
    """
    mid = id or str(uuid.uuid4())
    ext = normalize_external_msg_id(external_msg_id)
    ch = (channel or "").strip() or "internal"
    att: list[Any] = list(attachments) if attachments is not None else []
    values: dict[str, Any] = {
        "id": mid,
        "deal_id": deal_id,
        "funnel_id": funnel_id,
        "direction": direction,
        "channel": ch,
        "sender_id": sender_id or "",
        "body": body or "",
        "media_url": media_url,
        "external_msg_id": ext,
        "recipient_id": recipient_id,
        "attachments": att,
        "created_at": created_at,
        "is_read": is_read,
    }

    if ext is None:
        db.add(InboxMessage(**values))
        await db.flush()
        return mid, True

    stmt = (
        pg_insert(InboxMessage)
        .values(**values)
        .on_conflict_do_nothing(constraint="uq_inbox_messages_channel_external_msg_id")
        .returning(InboxMessage.id)
    )
    res = await db.execute(stmt)
    new_id = res.scalar_one_or_none()
    if new_id is not None:
        return str(new_id), True

    existing = (
        await db.execute(
            select(InboxMessage.id).where(
                InboxMessage.channel == ch,
                InboxMessage.external_msg_id == ext,
            ).limit(1)
        )
    ).scalar_one_or_none()
    if existing is not None:
        log.info(
            "inbox_messages: duplicate skipped (ON CONFLICT) channel=%r external_msg_id=%r existing_id=%s",
            ch,
            ext,
            existing,
        )
        return str(existing), False

    log.error(
        "inbox_messages: ON CONFLICT but row not found channel=%r external_msg_id=%r",
        ch,
        ext,
    )
    raise RuntimeError("inbox_messages deduplication invariant violated")
