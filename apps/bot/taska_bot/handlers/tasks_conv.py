"""Создание задачи из бота: заголовок, описание, срок, исполнитель."""
from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone

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

(TASK_TITLE, TASK_DESC, TASK_END, TASK_ASSIGNEE) = range(4)


def _assign_kb(context: ContextTypes.DEFAULT_TYPE) -> InlineKeyboardMarkup:
    users = context.user_data.get("task_assign_users") or []
    rows: list[list[InlineKeyboardButton]] = [
        [InlineKeyboardButton("👤 Я исполнитель", callback_data="tk:self")],
    ]
    row: list[InlineKeyboardButton] = []
    for i, u in enumerate(users[:15]):
        name = str(u.get("name") or u.get("login") or "?")[:16]
        row.append(InlineKeyboardButton(name, callback_data=f"tk:{i:02d}"))
        if len(row) == 3:
            rows.append(row)
            row = []
    if row:
        rows.append(row)
    return InlineKeyboardMarkup(rows)


async def task_new_cancel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    for k in ("task_new_title", "task_new_desc", "task_new_end", "task_assign_users"):
        context.user_data.pop(k, None)
    if update.message:
        await update.message.reply_text("Создание задачи отменено.")
    return ConversationHandler.END


async def task_new_entry(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    q = update.callback_query
    if not q:
        return ConversationHandler.END
    await q.answer()
    await q.message.reply_text("Название новой задачи:")
    return TASK_TITLE


async def task_new_title(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    title = (update.message.text or "").strip()
    if not title:
        await update.message.reply_text("Название не может быть пустым.")
        return TASK_TITLE
    context.user_data["task_new_title"] = title
    await update.message.reply_text("Описание (или «-» без описания):")
    return TASK_DESC


async def task_new_desc(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    t = (update.message.text or "").strip()
    context.user_data["task_new_desc"] = "" if t == "-" else t
    await update.message.reply_text("Срок: ГГГГ-ММ-ДД (или «-» без срока):")
    return TASK_END


async def task_new_end(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    t = (update.message.text or "").strip()
    context.user_data["task_new_end"] = "" if t == "-" else t
    crm = await resolve_crm_user(update, context)
    if not crm:
        await update.message.reply_text("Нет пользователя CRM.")
        return ConversationHandler.END
    api = context.application.bot_data["api"]
    cu = str(crm.get("id") or "")
    users = [u for u in await api.get_users() if not u.get("isArchived")]
    others = [u for u in users if str(u.get("id")) != cu][:15]
    context.user_data["task_assign_users"] = others
    await update.message.reply_text(
        "Кто исполнитель? (среди кнопок — коллеги; «Я исполнитель» — вы.)",
        reply_markup=_assign_kb(context),
    )
    return TASK_ASSIGNEE


async def task_new_assignee(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    q = update.callback_query
    if not q or not q.data:
        return TASK_ASSIGNEE
    data = q.data
    await q.answer()
    crm = await resolve_crm_user(update, context)
    if not crm:
        await q.message.reply_text("Нет пользователя CRM.")
        return ConversationHandler.END
    uid = str(crm.get("id") or "")

    m = re.fullmatch(r"tk:(self|\d{2})", data)
    if not m:
        return TASK_ASSIGNEE
    g1 = m.group(1)
    if g1 == "self":
        assignee_id = uid
    else:
        idx = int(g1, 10)
        pool = context.user_data.get("task_assign_users") or []
        if idx < 0 or idx >= len(pool):
            await q.message.reply_text("Список устарел. Начните снова: «➕ Новая задача».")
            return ConversationHandler.END
        assignee_id = str(pool[idx].get("id") or "")

    api = context.application.bot_data["api"]
    statuses = await api.get_statuses()
    priorities = await api.get_priorities()
    st = str(statuses[0].get("name") or "Не начато") if statuses else "Не начато"
    pr = str(priorities[0].get("name") or "Средний") if priorities else "Средний"

    title = context.user_data.get("task_new_title") or ""
    desc = context.user_data.get("task_new_desc") or ""
    end = context.user_data.get("task_new_end") or ""
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    tid = str(uuid.uuid4())

    ok = await api.put_tasks(
        [
            {
                "id": tid,
                "title": title,
                "description": desc or None,
                "status": st,
                "priority": pr,
                "assigneeId": assignee_id,
                "assigneeIds": [],
                "endDate": end,
                "isArchived": False,
                "entityType": "task",
                "createdByUserId": uid,
                "createdAt": now,
                "comments": [],
            }
        ]
    )

    for k in ("task_new_title", "task_new_desc", "task_new_end", "task_assign_users"):
        context.user_data.pop(k, None)

    if ok:
        await q.message.reply_text("✅ Задача создана.")
    else:
        await q.message.reply_text("Не удалось сохранить задачу.")
    return ConversationHandler.END


def build_task_creation_conversation() -> ConversationHandler:
    return ConversationHandler(
        entry_points=[CallbackQueryHandler(task_new_entry, pattern=r"^task:n$")],
        states={
            TASK_TITLE: [MessageHandler(filters.TEXT & ~filters.COMMAND, task_new_title)],
            TASK_DESC: [MessageHandler(filters.TEXT & ~filters.COMMAND, task_new_desc)],
            TASK_END: [MessageHandler(filters.TEXT & ~filters.COMMAND, task_new_end)],
            TASK_ASSIGNEE: [
                CallbackQueryHandler(task_new_assignee, pattern=r"^tk:(self|\d{2})$"),
            ],
        },
        fallbacks=[CommandHandler("cancel", task_new_cancel)],
        name="task_create",
        allow_reentry=False,
    )
