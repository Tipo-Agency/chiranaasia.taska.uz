"""Mirror 'to everyone' CRM messages into Telegram group chat."""
from __future__ import annotations

import html
import logging

from telegram.ext import ContextTypes

from taska_bot.services.group_broadcast_watermark import (
    load_group_broadcast_watermark,
    save_group_broadcast_watermark,
)

logger = logging.getLogger(__name__)


def _as_chat_id(raw) -> int | str:
    if raw is None:
        return 0
    s = str(raw).strip()
    try:
        return int(s)
    except ValueError:
        return s


def _sender_name(users: list[dict], sender_id: str) -> str:
    for x in users:
        if str(x.get("id") or "") == str(sender_id):
            return str(x.get("name") or x.get("login") or sender_id)
    return sender_id


async def job_group_broadcast_mirror(context: ContextTypes.DEFAULT_TYPE) -> None:
    api = context.application.bot_data["api"]
    prefs = await api.get_notification_prefs("default") or {}
    group_chat_id = prefs.get("telegramGroupChatId")
    if not group_chat_id:
        return

    # Use any existing user_id to query inbox; broadcast messages are those with recipientId == None
    users = [u for u in await api.get_users() if not u.get("isArchived")]
    if not users:
        return
    probe_user_id = str(users[0].get("id") or "")
    if not probe_user_id:
        return

    watermark = load_group_broadcast_watermark()
    msgs = await api.get_messages(folder="inbox", user_id=probe_user_id)
    broadcasts = [m for m in msgs if m.get("recipientId") in (None, "", 0)]
    if not broadcasts and not watermark:
        return

    if not watermark:
        # Initialize watermark without sending old messages
        newest = max((m.get("createdAt") or "" for m in broadcasts), default="")
        if newest:
            save_group_broadcast_watermark(newest)
        return

    start_wm = watermark
    for m in sorted(broadcasts, key=lambda x: x.get("createdAt") or ""):
        ca = m.get("createdAt") or ""
        if ca <= watermark:
            continue
        sender_id = str(m.get("senderId") or "")
        from_name = _sender_name(users, sender_id)
        raw_t = m.get("text") or ""
        body = f"📣 <b>{html.escape(from_name)}</b>\n{html.escape(raw_t[:3500])}"
        try:
            await context.bot.send_message(chat_id=_as_chat_id(group_chat_id), text=body, parse_mode="HTML")
        except Exception as e:
            logger.warning("group_broadcast send: %s", e)
            # don't advance watermark on hard send errors
            continue
        watermark = max(watermark, ca)

    if watermark != start_wm:
        save_group_broadcast_watermark(watermark)

