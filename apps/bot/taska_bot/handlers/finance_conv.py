"""Создание заявки на закупку из бота."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation

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

(FIN_AMOUNT, FIN_CATEGORY, FIN_DEPARTMENT, FIN_DESC) = range(4)


def _pick_kb(prefix: str, items: list[dict], key: str = "name") -> InlineKeyboardMarkup:
    rows: list[list[InlineKeyboardButton]] = []
    row: list[InlineKeyboardButton] = []
    for i, item in enumerate(items[:18]):
        label = str(item.get(key) or item.get("id") or "?")[:22]
        row.append(InlineKeyboardButton(label, callback_data=f"{prefix}:{i:02d}"))
        if len(row) == 2:
            rows.append(row)
            row = []
    if row:
        rows.append(row)
    return InlineKeyboardMarkup(rows)


async def fin_cancel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    context.user_data.pop("fin_new_amount", None)
    context.user_data.pop("fin_pick_categories", None)
    context.user_data.pop("fin_pick_departments", None)
    context.user_data.pop("fin_category_id", None)
    context.user_data.pop("fin_department_id", None)
    if update.message:
        await update.message.reply_text("Создание заявки отменено.")
    return ConversationHandler.END


async def fin_entry(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    q = update.callback_query
    if not q:
        return ConversationHandler.END
    await q.answer()
    await q.message.reply_text("Сумма заявки (число, например 150000):")
    return FIN_AMOUNT


async def fin_amount(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    raw = (update.message.text or "").strip().replace(" ", "").replace(",", ".")
    try:
        amt = Decimal(raw).quantize(Decimal("0.01"))
    except InvalidOperation:
        await update.message.reply_text("Нужно число. Пример: 250000")
        return FIN_AMOUNT
    if amt <= 0:
        await update.message.reply_text("Сумма должна быть больше нуля.")
        return FIN_AMOUNT
    context.user_data["fin_new_amount"] = amt
    api = context.application.bot_data["api"]
    cats = await api.get_finance_categories()
    if not cats:
        await update.message.reply_text(
            "В CRM нет категорий. Добавьте категории в веб-приложении и повторите."
        )
        return ConversationHandler.END
    context.user_data["fin_pick_categories"] = cats
    await update.message.reply_text(
        "Выберите категорию заявки:", reply_markup=_pick_kb("fc", cats)
    )
    return FIN_CATEGORY


async def fin_pick_category(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    q = update.callback_query
    if not q or not q.data:
        return FIN_CATEGORY
    await q.answer()
    data = q.data
    if not data.startswith("fc:"):
        return FIN_CATEGORY
    try:
        idx = int(data[3:], 10)
    except ValueError:
        return FIN_CATEGORY
    cats = context.user_data.get("fin_pick_categories") or []
    if idx < 0 or idx >= len(cats):
        await q.message.reply_text("Список устарел. Нажмите «Новая заявка» ещё раз.")
        return ConversationHandler.END
    context.user_data["fin_category_id"] = str(cats[idx].get("id") or "")
    api = context.application.bot_data["api"]
    depts = await api.get_departments()
    if not depts:
        await q.message.reply_text(
            "В CRM нет отделов. Добавьте отделы в веб-приложении и повторите."
        )
        return ConversationHandler.END
    context.user_data["fin_pick_departments"] = depts
    await q.message.reply_text(
        "Выберите отдел:", reply_markup=_pick_kb("fd", depts)
    )
    return FIN_DEPARTMENT


async def fin_pick_department(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    q = update.callback_query
    if not q or not q.data:
        return FIN_DEPARTMENT
    await q.answer()
    data = q.data
    if not data.startswith("fd:"):
        return FIN_DEPARTMENT
    try:
        idx = int(data[3:], 10)
    except ValueError:
        return FIN_DEPARTMENT
    depts = context.user_data.get("fin_pick_departments") or []
    if idx < 0 or idx >= len(depts):
        await q.message.reply_text("Список устарел. Нажмите «Новая заявка» ещё раз.")
        return ConversationHandler.END
    context.user_data["fin_department_id"] = str(depts[idx].get("id") or "")
    await q.message.reply_text("Кратко опишите заявку:")
    return FIN_DESC


async def fin_desc(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    crm = await resolve_crm_user(update, context)
    if not crm:
        await update.message.reply_text("Нет пользователя CRM.")
        return ConversationHandler.END
    uid = str(crm.get("id") or "")
    desc = (update.message.text or "").strip()
    amt = context.user_data.get("fin_new_amount")
    api = context.application.bot_data["api"]
    cid = str(context.user_data.get("fin_category_id") or "")
    did = str(context.user_data.get("fin_department_id") or "")
    if not cid or not did:
        await update.message.reply_text("Категория/отдел не выбраны. Начните снова.")
        return ConversationHandler.END
    rid = str(uuid.uuid4())
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    title = (desc[:500] if desc else "Заявка") or "Заявка"
    amt_str = format(amt, "f") if amt is not None else "0"
    ok = await api.post_finance_request(
        {
            "id": rid,
            "requesterId": uid,
            "requestedBy": uid,
            "departmentId": did,
            "categoryId": cid,
            "category": cid,
            "amount": amt_str,
            "currency": "UZS",
            "title": title,
            "comment": desc,
            "status": "pending",
            "isArchived": False,
        }
    )
    context.user_data.pop("fin_new_amount", None)
    context.user_data.pop("fin_pick_categories", None)
    context.user_data.pop("fin_pick_departments", None)
    context.user_data.pop("fin_category_id", None)
    context.user_data.pop("fin_department_id", None)
    if ok:
        await update.message.reply_text("✅ Заявка отправлена (ожидает согласования).")
    else:
        await update.message.reply_text("Не удалось сохранить заявку.")
    return ConversationHandler.END


def build_finance_conversation() -> ConversationHandler:
    return ConversationHandler(
        entry_points=[CallbackQueryHandler(fin_entry, pattern=r"^fin:n$")],
        states={
            FIN_AMOUNT: [MessageHandler(filters.TEXT & ~filters.COMMAND, fin_amount)],
            FIN_CATEGORY: [CallbackQueryHandler(fin_pick_category, pattern=r"^fc:\d{2}$")],
            FIN_DEPARTMENT: [CallbackQueryHandler(fin_pick_department, pattern=r"^fd:\d{2}$")],
            FIN_DESC: [MessageHandler(filters.TEXT & ~filters.COMMAND, fin_desc)],
        },
        fallbacks=[CommandHandler("cancel", fin_cancel)],
        name="finance_request",
        allow_reentry=False,
    )
