"""Ответы в чат CRM: реплай на зеркало, кнопка «Ответить», /cancel_reply."""
from __future__ import annotations

import html
import uuid
from datetime import datetime, timezone

from telegram import Update
from telegram.ext import ApplicationHandlerStop, ContextTypes, MessageHandler, filters

from taska_bot.handlers.crm_context import resolve_crm_user
from taska_bot.ui.keyboards import (
    BTN_CHAT,
    BTN_CLIENTS,
    BTN_DEALS,
    BTN_FINANCE,
    BTN_HELP,
    BTN_MEETINGS,
    BTN_PROFILE,
    BTN_TASKS,
    BTN_WEBAPP,
)

_MENU_TEXTS = {
    BTN_TASKS,
    BTN_DEALS,
    BTN_MEETINGS,
    BTN_CHAT,
    BTN_FINANCE,
    BTN_CLIENTS,
    BTN_PROFILE,
    BTN_HELP,
    BTN_WEBAPP,
    # aliases without emojis (some clients/old keyboards)
    "Задачи",
    "Сделки",
    "Встречи",
    "Чат",
    "Заявки",
    "Клиенты",
    "Профиль",
    "Помощь",
    "Система",
}

_MENU_KEYWORDS = ("задач", "сделк", "встреч", "чат", "заявк", "клиент", "профил", "помощ", "систем")


async def handle_chat_text_extras(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message or not update.effective_chat or update.effective_chat.type != "private":
        return
    text = (update.message.text or "").strip()
    # Важно: reply-меню в личке — это тоже TEXT.
    # Если у нас "завис" какой-то сценарий ожидания текста (поиск/ответ/комментарий),
    # то нажатие кнопок меню должно проходить в menu.py, а не потребляться здесь.
    low = text.lower()
    if text in _MENU_TEXTS or any(k in low for k in _MENU_KEYWORDS):
        return

    if text == "/cancel_reply":
        if context.user_data.get("pending_reply_sender_id"):
            context.user_data.pop("pending_reply_sender_id", None)
            await update.message.reply_text("Ок, ответ отменён.")
            raise ApplicationHandlerStop
        return

    if text == "/cancel_comment":
        if context.user_data.get("deal_comment_pick_idx") is not None:
            context.user_data.pop("deal_comment_pick_idx", None)
            await update.message.reply_text("Ок, комментарий отменён.")
            raise ApplicationHandlerStop
        return

    api = context.application.bot_data["api"]

    if context.user_data.get("pending_reply_sender_id"):
        crm = await resolve_crm_user(update, context)
        if not crm:
            return
        tgt = context.user_data.pop("pending_reply_sender_id")
        body = (update.message.text or "").strip()
        ok = await api.post_message(
            {"senderId": str(crm.get("id")), "recipientId": str(tgt), "text": body}
        )
        if ok:
            await update.message.reply_text("Отправлено в чат CRM.")
        else:
            await update.message.reply_text("Не удалось отправить.")
        raise ApplicationHandlerStop

    if context.user_data.get("deal_comment_pick_idx") is not None:
        idx = context.user_data.pop("deal_comment_pick_idx")
        crm = await resolve_crm_user(update, context)
        if not crm:
            raise ApplicationHandlerStop
        pick = context.user_data.get("deal_pick_list") or []
        if idx < 0 or idx >= len(pick):
            await update.message.reply_text("Список сделок устарел — откройте сделки снова.")
            raise ApplicationHandlerStop
        did = pick[idx]
        deals = await api.get_deals()
        deal = next((d for d in deals if str(d.get("id")) == str(did)), None)
        if not deal:
            await update.message.reply_text("Сделка не найдена.")
            raise ApplicationHandlerStop
        body = (update.message.text or "").strip()
        if not body:
            context.user_data["deal_comment_pick_idx"] = idx
            await update.message.reply_text("Пустой текст. Напишите комментарий или /cancel_comment.")
            raise ApplicationHandlerStop
        comments = list(deal.get("comments") or [])
        comments.append(
            {
                "id": str(uuid.uuid4()),
                "text": body,
                "authorId": str(crm.get("id") or ""),
                "createdAt": datetime.now(timezone.utc).isoformat(),
                "type": "internal",
            }
        )
        merged = dict(deal)
        merged["comments"] = comments
        merged["updatedAt"] = datetime.now(timezone.utc).isoformat()
        ok = await api.put_deals([merged])
        if ok:
            await update.message.reply_text("✅ Комментарий добавлен.")
        else:
            await update.message.reply_text("Не удалось сохранить.")
        raise ApplicationHandlerStop

    if context.user_data.get("client_search_pending"):
        crm = await resolve_crm_user(update, context)
        if not crm:
            context.user_data.pop("client_search_pending", None)
            return
        fragment = (update.message.text or "").strip().lower()
        clients = await api.get_clients()
        matches = [
            c
            for c in clients
            if not c.get("isArchived")
            and fragment in str(c.get("name") or "").lower()
        ][:15]
        context.user_data.pop("client_search_pending", None)
        if not matches:
            await update.message.reply_text("Никого не нашёл — попробуйте другой запрос.")
        else:
            lines = ["👥 <b>Клиенты</b>\n"]
            for c in matches:
                lines.append(f"• {html.escape(str(c.get('name') or '—'))}")
            await update.message.reply_text("\n".join(lines), parse_mode="HTML")
        raise ApplicationHandlerStop

    if update.message.reply_to_message:
        rmid = str(update.message.reply_to_message.message_id)
        rmap = context.application.bot_data.get("chat_reply_map") or {}
        tgt = rmap.get(rmid)
        if tgt:
            crm = await resolve_crm_user(update, context)
            if not crm:
                return
            body = (update.message.text or "").strip()
            ok = await api.post_message(
                {"senderId": str(crm.get("id")), "recipientId": str(tgt), "text": body}
            )
            if ok:
                await update.message.reply_text("Отправлено в чат CRM.")
            else:
                await update.message.reply_text("Не удалось отправить.")
            raise ApplicationHandlerStop


def register(application) -> None:
    application.add_handler(
        MessageHandler(
            filters.TEXT & filters.ChatType.PRIVATE,
            handle_chat_text_extras,
            # Важно: этот хендлер должен "пропускать" сообщения, которые он не обрабатывает.
            # Иначе он блокирует reply-меню (menu.py) и "по кнопкам ничего не происходит".
            block=False,
        ),
        group=0,
    )
