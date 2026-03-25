"""Мастер создания встречи: название, дата, время, участники (inline)."""
from __future__ import annotations

import uuid

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import (
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    ConversationHandler,
    MessageHandler,
    filters,
)

from taska_bot.handlers.crm_context import resolve_crm_user

(MEET_TITLE, MEET_DATE, MEET_TIME, MEET_PICK) = range(4)


def _pick_kb(context: ContextTypes.DEFAULT_TYPE) -> InlineKeyboardMarkup:
    users = context.user_data.get("meet_pick_users") or []
    sel = context.user_data.get("meet_pick_selected") or set()
    kb: list[list[InlineKeyboardButton]] = []
    row: list[InlineKeyboardButton] = []
    for idx, u in enumerate(users[:24]):
        uid = str(u.get("id"))
        mark = "✓ " if uid in sel else ""
        name = str(u.get("name") or u.get("login") or "?")[:16]
        row.append(InlineKeyboardButton(f"{mark}{name}", callback_data=f"mp:{idx:02d}"))
        if len(row) == 3:
            kb.append(row)
            row = []
    if row:
        kb.append(row)
    kb.append([InlineKeyboardButton("✅ Создать встречу", callback_data="mp:go")])
    return InlineKeyboardMarkup(kb)


async def meet_cancel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    for k in (
        "meet_pick_users",
        "meet_pick_selected",
        "meet_title",
        "meet_date",
        "meet_time",
    ):
        context.user_data.pop(k, None)
    if update.message:
        await update.message.reply_text("Создание встречи отменено.")
    return ConversationHandler.END


async def meet_entry(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    if not query:
        return ConversationHandler.END
    await query.answer()
    api = context.application.bot_data["api"]
    nu = [u for u in await api.get_users() if not u.get("isArchived")]
    context.user_data["meet_pick_users"] = nu[:40]
    context.user_data["meet_pick_selected"] = set()
    await query.message.reply_text("Название встречи:")
    return MEET_TITLE


async def meet_title(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    context.user_data["meet_title"] = (update.message.text or "").strip()
    await update.message.reply_text("Дата: ГГГГ-ММ-ДД")
    return MEET_DATE


async def meet_date(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    context.user_data["meet_date"] = (update.message.text or "").strip()
    await update.message.reply_text("Время: ЧЧ:ММ (например 10:30)")
    return MEET_TIME


async def meet_time(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    context.user_data["meet_time"] = (update.message.text or "").strip()
    await update.message.reply_text(
        "Выберите участников (нажимайте по имени). Затем «Создать встречу».",
        reply_markup=_pick_kb(context),
    )
    return MEET_PICK


async def meet_pick_cb(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    if not query or not query.data:
        return MEET_PICK
    data = query.data
    await query.answer()
    if data == "mp:go":
        return await _meet_create(update, context)
    if not data.startswith("mp:"):
        return MEET_PICK
    try:
        idx = int(data[3:], 10)
    except ValueError:
        return MEET_PICK
    users = context.user_data.get("meet_pick_users") or []
    if idx < 0 or idx >= len(users):
        return MEET_PICK
    uid = str(users[idx].get("id"))
    sel = context.user_data.setdefault("meet_pick_selected", set())
    if uid in sel:
        sel.remove(uid)
    else:
        sel.add(uid)
    await query.edit_message_reply_markup(reply_markup=_pick_kb(context))
    return MEET_PICK


async def _meet_create(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    if not query or not query.message:
        return ConversationHandler.END
    crm = await resolve_crm_user(update, context)
    if not crm:
        await query.message.reply_text("Нет пользователя CRM.")
        return ConversationHandler.END
    uid = str(crm.get("id") or "")
    title = context.user_data.get("meet_title") or ""
    date_s = context.user_data.get("meet_date") or ""
    time_s = context.user_data.get("meet_time") or ""
    sel = set(context.user_data.get("meet_pick_selected") or [])
    sel.add(uid)
    api = context.application.bot_data["api"]
    mid = str(uuid.uuid4())
    ok = await api.put_meetings(
        [
            {
                "id": mid,
                "title": title,
                "date": date_s,
                "time": time_s,
                "participantIds": list(sel),
                "type": "work",
                "recurrence": "none",
                "isArchived": False,
            }
        ]
    )
    for k in (
        "meet_pick_users",
        "meet_pick_selected",
        "meet_title",
        "meet_date",
        "meet_time",
    ):
        context.user_data.pop(k, None)
    if ok:
        await query.message.reply_text("✅ Встреча создана.")
    else:
        await query.message.reply_text("Не удалось сохранить встречу.")
    return ConversationHandler.END


def build_meeting_conversation() -> ConversationHandler:
    return ConversationHandler(
        entry_points=[CallbackQueryHandler(meet_entry, pattern=r"^meet:n$")],
        states={
            MEET_TITLE: [MessageHandler(filters.TEXT & ~filters.COMMAND, meet_title)],
            MEET_DATE: [MessageHandler(filters.TEXT & ~filters.COMMAND, meet_date)],
            MEET_TIME: [MessageHandler(filters.TEXT & ~filters.COMMAND, meet_time)],
            MEET_PICK: [CallbackQueryHandler(meet_pick_cb, pattern=r"^mp:")],
        },
        fallbacks=[CommandHandler("cancel", meet_cancel)],
        name="meet_wizard",
        allow_reentry=False,
    )
