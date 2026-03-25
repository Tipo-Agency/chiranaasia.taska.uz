"""Дублирование входящих сообщений чата CRM в Telegram."""
from __future__ import annotations

import html
import logging

from telegram import InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes

from taska_bot.jobs.scheduled import _as_chat_id
from taska_bot.services.inbox_watermark import load_watermarks, save_watermarks

logger = logging.getLogger(__name__)


def _prune(d: dict, max_size: int) -> None:
    if len(d) <= max_size:
        return
    for k in list(d.keys())[: len(d) - max_size + 80]:
        d.pop(k, None)


def _sender_name(users: list[dict], sender_id: str) -> str:
    for x in users:
        if str(x.get("id")) == sender_id:
            return str(x.get("name") or x.get("login") or sender_id)
    return sender_id


async def job_inbox_mirror(context: ContextTypes.DEFAULT_TYPE) -> None:
    api = context.application.bot_data["api"]
    wm = load_watermarks()
    users_list = await api.get_users()
    changed = False

    for u in users_list:
        if u.get("isArchived") or not u.get("telegramUserId"):
            continue
        uid = str(u["id"])
        tid = _as_chat_id(u["telegramUserId"])
        msgs = await api.get_messages(folder="inbox", user_id=uid)

        if uid not in wm:
            wm[uid] = max((m.get("createdAt") or "") for m in msgs) if msgs else ""
            changed = True
            continue

        start_wm = wm[uid]
        watermark = start_wm
        for m in sorted(msgs, key=lambda x: x.get("createdAt") or ""):
            ca = m.get("createdAt") or ""
            if ca <= watermark:
                continue
            sender_id = str(m.get("senderId") or "")
            if sender_id == uid:
                watermark = max(watermark, ca)
                continue

            from_name = _sender_name(users_list, sender_id)
            raw_t = m.get("text") or ""
            body = f"💬 <b>{html.escape(from_name)}</b>\n{html.escape(raw_t[:3500])}"
            mid = str(m.get("id") or "")
            try:
                sent = await context.bot.send_message(
                    chat_id=tid,
                    text=body,
                    parse_mode="HTML",
                    reply_markup=InlineKeyboardMarkup(
                        [[
                            InlineKeyboardButton("Ответить", callback_data=f"c:rp:{mid}"),
                            InlineKeyboardButton("Прочитано", callback_data=f"c:rd:{mid}"),
                        ]]
                    ),
                )
                meta = context.application.bot_data.setdefault("chat_msg_meta", {})
                meta[mid] = sender_id
                _prune(meta, 500)
                rmap = context.application.bot_data.setdefault("chat_reply_map", {})
                rmap[str(sent.message_id)] = sender_id
                _prune(rmap, 500)
            except Exception as e:
                logger.warning("inbox_mirror send to %s: %s", uid, e)

            watermark = max(watermark, ca)

        if watermark != start_wm:
            wm[uid] = watermark
            changed = True

    if changed:
        save_watermarks(wm)
