"""Команды и сценарий входа."""
from __future__ import annotations

import html

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, ReplyKeyboardRemove, Update
from telegram.ext import (
    CommandHandler,
    ContextTypes,
    ConversationHandler,
    MessageHandler,
    filters,
)

from taska_bot.domain.task_filters import overdue_tasks_for_user, today_tasks_for_user
from taska_bot.handlers.crm_context import is_admin, resolve_crm_user
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

(LOGIN_NAME, LOGIN_PASS) = range(2)

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
}


async def cmd_help(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message:
        return
    await update.message.reply_text(
        "Снизу кнопки меню (в личке):\n"
        "📋 Задачи — сегодня/просрочка, открытые, статус\n"
        "🎯 Сделки — воронки, смена стадии\n"
        "📅 Встречи — список, новая встреча\n"
        "💬 Чат CRM — уведомления и ответ реплаем / «Ответить»\n"
        "📝 Заявки — свои и согласование (роль ADMIN)\n"
        "👥 Клиенты — поиск по имени\n"
        "👤 Профиль — имя, роль\n"
        "🌐 Система — веб (HTTPS + WEB_APP_URL)\n\n"
        "Команды: /start, /tasks, /cancel, /help, /run_deliveries (ADMIN)\n"
        "В чате CRM: /cancel_reply, при комменте к сделке: /cancel_comment\n"
        "В группе: /task, /bindgroup (ADMIN), /groupstatus"
    )


async def cmd_help_end(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    await cmd_help(update, context)
    return ConversationHandler.END


async def cmd_cancel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if update.message:
        await update.message.reply_text(
            "Ок. При необходимости: /start",
            reply_markup=ReplyKeyboardRemove(),
        )
    return ConversationHandler.END


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not update.message or not update.effective_chat:
        return ConversationHandler.END
    if update.effective_chat.type != "private":
        await update.message.reply_text("Напишите боту в личку и отправьте /start.")
        return ConversationHandler.END
    api = context.application.bot_data["api"]
    if update.effective_user:
        crm = await api.find_user_by_telegram_id(update.effective_user.id)
        if crm:
            context.user_data["crm_user"] = crm
            name = html.escape(str(crm.get("name") or crm.get("login") or "пользователь"))
            from taska_bot.handlers.menu import send_main_menu_after_auth

            await send_main_menu_after_auth(
                context,
                update.effective_chat.id,
                f"С возвращением, <b>{name}</b>! Telegram привязан к профилю.",
            )
            return ConversationHandler.END
    await update.message.reply_text("Введите логин из CRM:", reply_markup=ReplyKeyboardRemove())
    return LOGIN_NAME


async def login_name(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not update.message:
        return ConversationHandler.END
    text = (update.message.text or "").strip()
    if text in _MENU_TEXTS:
        # Пользователь нажал кнопку меню, но находится в сценарии авторизации.
        # Завершаем сценарий, чтобы меню снова работало предсказуемо.
        context.user_data.pop("login_name", None)
        await update.message.reply_text("Вы сейчас в авторизации. Нажмите /start чтобы войти, или /cancel чтобы выйти.")
        return ConversationHandler.END
    context.user_data["login_name"] = text
    await update.message.reply_text("Введите пароль:")
    return LOGIN_PASS


async def login_password(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not update.message or not update.effective_user:
        return ConversationHandler.END
    api = context.application.bot_data["api"]
    password = (update.message.text or "").strip()
    if password in _MENU_TEXTS:
        context.user_data.pop("login_name", None)
        await update.message.reply_text("Авторизация отменена. Нажмите /start чтобы войти.")
        return ConversationHandler.END
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
    name = html.escape(str(user.get("name") or user.get("login") or "пользователь"))
    from taska_bot.handlers.menu import send_main_menu_after_auth

    await send_main_menu_after_auth(
        context,
        chat_id,
        f"Вы вошли как <b>{name}</b>. Telegram привязан к профилю.\n"
        "Меню снизу — задачи, сделки, встречи, профиль.",
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
    kb = InlineKeyboardMarkup(
        [
            [
                InlineKeyboardButton("Все мои открытые", callback_data="t:all"),
                InlineKeyboardButton("➕ Новая задача", callback_data="task:n"),
            ]
        ]
    )
    await update.message.reply_text("\n".join(lines), parse_mode="HTML", reply_markup=kb)


async def cmd_tasks_end(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    await cmd_tasks(update, context)
    return ConversationHandler.END


async def cmd_run_deliveries(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message or not update.effective_chat:
        return
    if update.effective_chat.type != "private":
        await update.message.reply_text("Команда работает только в личке.")
        return
    crm = await resolve_crm_user(update, context)
    if not crm or not is_admin(crm):
        await update.message.reply_text("Только ADMIN.")
        return

    api = context.application.bot_data["api"]
    res = await api.run_notification_deliveries(limit=200)
    if not res:
        await update.message.reply_text("Не удалось запустить доставки.")
        return
    await update.message.reply_text(
        "✅ Задачи доставки поставлены в Redis stream queue.notifications:\n"
        f"queued: {res.get('queued')}",
    )


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
    from taska_bot.handlers.callbacks import register as register_callbacks
    from taska_bot.handlers.chat_flow import register as register_chat_flow
    from taska_bot.handlers.finance_conv import build_finance_conversation
    from taska_bot.handlers.meetings_conv import build_meeting_conversation
    from taska_bot.handlers.menu import register as register_menu
    from taska_bot.handlers.tasks_conv import build_task_creation_conversation
    from taska_bot.handlers.group_commands import register as register_group

    application.add_handler(build_task_creation_conversation())
    application.add_handler(build_meeting_conversation())
    application.add_handler(build_finance_conversation())
    application.add_handler(build_conversation_handler())
    application.add_handler(CommandHandler("help", cmd_help))
    application.add_handler(CommandHandler("tasks", cmd_tasks))
    application.add_handler(CommandHandler("run_deliveries", cmd_run_deliveries))
    register_callbacks(application)
    register_chat_flow(application)
    register_menu(application)
    register_group(application)
