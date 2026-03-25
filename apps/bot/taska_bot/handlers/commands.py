"""Команды и сценарий входа."""
from __future__ import annotations

import html

from telegram import Update
from telegram.ext import (
    CommandHandler,
    ContextTypes,
    ConversationHandler,
    MessageHandler,
    filters,
)

from taska_bot.domain.task_filters import overdue_tasks_for_user, today_tasks_for_user

(LOGIN_NAME, LOGIN_PASS) = range(2)


async def cmd_help(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message:
        return
    await update.message.reply_text(
        "Команды:\n"
        "/start — войти (логин и пароль как в CRM)\n"
        "/tasks — задачи на сегодня и просроченные\n"
        "/cancel — отменить ввод\n"
        "/help — справка"
    )


async def cmd_help_end(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    await cmd_help(update, context)
    return ConversationHandler.END


async def cmd_cancel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if update.message:
        await update.message.reply_text("Ок. При необходимости: /start")
    return ConversationHandler.END


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not update.message or not update.effective_chat:
        return ConversationHandler.END
    if update.effective_chat.type != "private":
        await update.message.reply_text("Напишите боту в личку и отправьте /start.")
        return ConversationHandler.END
    await update.message.reply_text("Введите логин из CRM:")
    return LOGIN_NAME


async def login_name(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not update.message:
        return ConversationHandler.END
    context.user_data["login_name"] = (update.message.text or "").strip()
    await update.message.reply_text("Введите пароль:")
    return LOGIN_PASS


async def login_password(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not update.message or not update.effective_user:
        return ConversationHandler.END
    api = context.application.bot_data["api"]
    password = update.message.text or ""
    login_name = (context.user_data.get("login_name") or "").strip()
    chat_id = update.effective_chat.id
    try:
        await update.message.delete()
    except Exception:
        pass

    result = await api.login(login_name, password)
    if not result:
        await context.bot.send_message(chat_id=chat_id, text="Неверный логин или пароль. /start — снова.")
        return ConversationHandler.END

    user = result.get("user") or {}
    uid = user.get("id")
    tg = str(update.effective_user.id)
    if uid:
        await api.link_telegram_to_user(uid, tg)

    context.user_data["crm_user"] = user
    context.user_data["access_token"] = result.get("access_token")
    name = html.escape(str(user.get("name") or user.get("login") or "пользователь"))
    await context.bot.send_message(
        chat_id=chat_id,
        text=(
            f"Вы вошли как <b>{name}</b>. Telegram привязан к профилю.\n"
            "/tasks — ваши задачи."
        ),
        parse_mode="HTML",
    )
    return ConversationHandler.END


async def cmd_tasks(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message:
        return
    if update.effective_chat and update.effective_chat.type != "private":
        return
    api = context.application.bot_data["api"]
    crm = context.user_data.get("crm_user")
    if not crm and update.effective_user:
        crm = await api.find_user_by_telegram_id(update.effective_user.id)
        if crm:
            context.user_data["crm_user"] = crm
    if not crm:
        await update.message.reply_text("Сначала /start или привяжите telegramUserId в CRM.")
        return
    uid = crm.get("id")
    if not uid:
        await update.message.reply_text("Не удалось определить пользователя.")
        return

    all_tasks = await api.get_tasks()
    today = today_tasks_for_user(all_tasks, uid)
    overdue = overdue_tasks_for_user(all_tasks, uid)

    lines = ["📋 <b>Ваши задачи</b>"]
    if overdue:
        lines.append(f"\n⚠️ Просрочено ({len(overdue)}):")
        for t in overdue[:12]:
            lines.append(f"• {html.escape(str(t.get('title') or '—'))}")
        if len(overdue) > 12:
            lines.append(f"… и ещё {len(overdue) - 12}")
    if today:
        lines.append(f"\n📅 На сегодня ({len(today)}):")
        for t in today[:12]:
            lines.append(f"• {html.escape(str(t.get('title') or '—'))}")
        if len(today) > 12:
            lines.append(f"… и ещё {len(today) - 12}")
    if not today and not overdue:
        lines.append("\nНет открытых задач на сегодня и просроченных.")
    await update.message.reply_text("\n".join(lines), parse_mode="HTML")


async def cmd_tasks_end(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    await cmd_tasks(update, context)
    return ConversationHandler.END


def build_conversation_handler() -> ConversationHandler:
    return ConversationHandler(
        entry_points=[CommandHandler("start", start)],
        states={
            LOGIN_NAME: [MessageHandler(filters.TEXT & ~filters.COMMAND, login_name)],
            LOGIN_PASS: [MessageHandler(filters.TEXT & ~filters.COMMAND, login_password)],
        },
        fallbacks=[
            CommandHandler("cancel", cmd_cancel),
            CommandHandler("help", cmd_help_end),
            CommandHandler("tasks", cmd_tasks_end),
        ],
    )


def register(application) -> None:
    application.add_handler(build_conversation_handler())
    application.add_handler(CommandHandler("help", cmd_help))
    application.add_handler(CommandHandler("tasks", cmd_tasks))
