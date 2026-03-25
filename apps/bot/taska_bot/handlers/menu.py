"""Текстовое меню в личке: кнопки reply-клавиатуры."""
from __future__ import annotations

import html
from datetime import datetime

import pytz
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import ContextTypes, MessageHandler, filters

from taska_bot.handlers.commands import cmd_help, cmd_tasks
from taska_bot.handlers.crm_context import is_admin, resolve_crm_user, user_name
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
    main_reply_keyboard,
    open_site_inline_markup,
)

_ALIASES = {
    "Задачи": BTN_TASKS,
    "Сделки": BTN_DEALS,
    "Встречи": BTN_MEETINGS,
    "Чат": BTN_CHAT,
    "Заявки": BTN_FINANCE,
    "Клиенты": BTN_CLIENTS,
    "Профиль": BTN_PROFILE,
    "Помощь": BTN_HELP,
    "Система": BTN_WEBAPP,
}

_KEYWORDS = [
    ("задач", BTN_TASKS),
    ("сделк", BTN_DEALS),
    ("встреч", BTN_MEETINGS),
    ("чат", BTN_CHAT),
    ("заявк", BTN_FINANCE),
    ("клиент", BTN_CLIENTS),
    ("профил", BTN_PROFILE),
    ("помощ", BTN_HELP),
    ("систем", BTN_WEBAPP),
]


def _coerce_menu_text(text: str) -> str | None:
    """Пытается сопоставить текст кнопки меню, даже если Telegram изменил/урезал подпись."""
    t = (text or "").strip()
    if not t:
        return None
    if t in MENU_TEXTS:
        return _ALIASES.get(t, t)
    low = t.lower()
    for kw, btn in _KEYWORDS:
        if kw in low:
            return btn
    return None

MENU_TEXTS = frozenset(
    {
        BTN_TASKS,
        BTN_DEALS,
        BTN_MEETINGS,
        BTN_CHAT,
        BTN_FINANCE,
        BTN_CLIENTS,
        BTN_PROFILE,
        BTN_HELP,
        BTN_WEBAPP,
        *_ALIASES.keys(),
    }
)


def _today_str(tz_name: str) -> str:
    tz = pytz.timezone(tz_name)
    return datetime.now(tz).strftime("%Y-%m-%d")


def _uid_in_participants(meeting: dict, uid: str) -> bool:
    raw = meeting.get("participantIds") or []
    ids = {str(x) for x in raw}
    return str(uid) in ids


def _meeting_sort_key(m: dict) -> tuple[str, str]:
    d = (m.get("date") or "").strip()
    t = (m.get("time") or "").strip()
    return (d, t)


async def _send_deals(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message:
        return
    api = context.application.bot_data["api"]
    crm = await resolve_crm_user(update, context)
    if not crm:
        await update.message.reply_text("Сначала /start — войдите или привяжите Telegram в CRM.")
        return
    uid = str(crm.get("id") or "")
    if not uid:
        await update.message.reply_text("Не удалось определить пользователя.")
        return

    deals = await api.get_deals()
    mine = [d for d in deals if not d.get("isArchived") and str(d.get("assigneeId") or "") == uid]
    mine.sort(
        key=lambda d: str(d.get("updatedAt") or d.get("createdAt") or ""),
        reverse=True,
    )

    lines = ["🎯 <b>Сделки</b> (кратко). Ниже — открыть список, воронки и смену стадии."]
    if not mine:
        lines.append("\nНет активных сделок на вас как на ответственном.")
    else:
        lines.append(f"\nНа вас: {len(mine)}")
        for d in mine[:8]:
            title = html.escape(str(d.get("title") or "—"))
            stage = html.escape(str(d.get("stage") or "—"))
            lines.append(f"• {title} — <i>{stage}</i>")
        if len(mine) > 8:
            lines.append(f"… ещё {len(mine) - 8}")
    kb = InlineKeyboardMarkup(
        [[InlineKeyboardButton("Списки и воронки ▶", callback_data="d:mine")]]
    )
    await update.message.reply_text("\n".join(lines), parse_mode="HTML", reply_markup=kb)


async def _send_meetings(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message:
        return
    api = context.application.bot_data["api"]
    settings = context.application.bot_data["settings"]
    crm = context.user_data.get("crm_user")
    if not crm and update.effective_user:
        crm = await api.find_user_by_telegram_id(update.effective_user.id)
        if crm:
            context.user_data["crm_user"] = crm
    if not crm:
        await update.message.reply_text("Сначала /start — войдите или привяжите Telegram в CRM.")
        return
    uid = str(crm.get("id") or "")
    if not uid:
        await update.message.reply_text("Не удалось определить пользователя.")
        return

    today = _today_str(settings.timezone)
    meetings = await api.get_meetings()
    mine = [m for m in meetings if _uid_in_participants(m, uid)]
    upcoming = [m for m in mine if (m.get("date") or "") >= today]
    upcoming.sort(key=_meeting_sort_key)

    lines = ["📅 <b>Ваши встречи</b> (вы в участниках)"]
    kb_rows: list[list[InlineKeyboardButton]] = []
    if not upcoming:
        lines.append("\nНет предстоящих встреч с датой от сегодня.")
    else:
        lines.append(f"\nБлижайшие ({min(len(upcoming), 12)} из {len(upcoming)}):")
        context.user_data["meeting_pick_list"] = [str(m.get("id")) for m in upcoming[:12]]
        for m in upcoming[:12]:
            title = html.escape(str(m.get("title") or "—"))
            d = html.escape(str(m.get("date") or "—"))
            t = html.escape(str(m.get("time") or ""))
            lines.append(f"• {d} {t} — {title}")
        row: list[InlineKeyboardButton] = []
        for i in range(min(len(upcoming), 12)):
            row.append(InlineKeyboardButton(str(i + 1), callback_data=f"m:o:{i:02d}"))
            if len(row) == 6:
                kb_rows.append(row)
                row = []
        if row:
            kb_rows.append(row)
    kb_rows.append([InlineKeyboardButton("➕ Новая встреча", callback_data="meet:n")])
    kb = InlineKeyboardMarkup(kb_rows)
    await update.message.reply_text("\n".join(lines), parse_mode="HTML", reply_markup=kb)


async def _send_chat_intro(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message:
        return
    await update.message.reply_text(
        "💬 <b>Чат CRM</b>\n\n"
        "Новые входящие из системы дублируются сюда каждые ~45 сек.\n"
        "Ответьте <b>реплаем</b> на сообщение бота или нажмите «Ответить».\n"
        "<code>/cancel_reply</code> — если ждём текст ответа и вы передумали.",
        parse_mode="HTML",
    )


async def _send_finance(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message:
        return
    api = context.application.bot_data["api"]
    crm = await resolve_crm_user(update, context)
    if not crm:
        await update.message.reply_text("Сначала /start.")
        return
    uid = str(crm.get("id") or "")
    users = await api.get_users()
    rows = await api.get_finance_requests()
    active = [r for r in rows if not r.get("isArchived")]
    mine = [r for r in active if str(r.get("requesterId") or "") == uid]
    lines = ["📝 <b>Заявки</b>\n", "<b>Ваши:</b>"]
    if not mine:
        lines.append("— пока нет.")
    else:
        for r in mine[:12]:
            st = html.escape(str(r.get("status") or "—"))
            amt = html.escape(str(r.get("amount") or ""))
            des = html.escape(str(r.get("description") or "")[:120])
            lines.append(f"• {amt} — {st}\n  <i>{des}</i>")
    kb_rows: list[list[InlineKeyboardButton]] = [
        [InlineKeyboardButton("➕ Новая заявка", callback_data="fin:n")],
    ]
    if is_admin(crm):
        pending = [r for r in active if str(r.get("status") or "") == "pending"][:8]
        context.user_data["fin_pending_ids"] = [str(r.get("id")) for r in pending]
        lines.append("\n<b>На согласовании (ADMIN):</b>")
        if not pending:
            lines.append("— нет ожидающих.")
        else:
            for i, r in enumerate(pending):
                req_name = user_name(users, str(r.get("requesterId") or ""))
                amt = html.escape(str(r.get("amount") or ""))
                des = html.escape(str(r.get("description") or "")[:80])
                lines.append(f"{i + 1}. {html.escape(req_name)} — {amt}\n  <i>{des}</i>")
                kb_rows.append(
                    [
                        InlineKeyboardButton(f"✅ {i + 1}", callback_data=f"r:a:{i:02d}"),
                        InlineKeyboardButton(f"❌ {i + 1}", callback_data=f"r:x:{i:02d}"),
                    ]
                )
    await update.message.reply_text(
        "\n".join(lines), parse_mode="HTML", reply_markup=InlineKeyboardMarkup(kb_rows)
    )


async def _send_clients_search_prompt(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message:
        return
    crm = await resolve_crm_user(update, context)
    if not crm:
        await update.message.reply_text("Сначала /start.")
        return
    context.user_data["client_search_pending"] = True
    await update.message.reply_text("Напишите часть имени клиента одним сообщением:")


async def _send_profile(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message:
        return
    api = context.application.bot_data["api"]
    crm = context.user_data.get("crm_user")
    if not crm and update.effective_user:
        crm = await api.find_user_by_telegram_id(update.effective_user.id)
        if crm:
            context.user_data["crm_user"] = crm
    if not crm:
        await update.message.reply_text("Сначала /start — войдите или привяжите Telegram в CRM.")
        return

    name = html.escape(str(crm.get("name") or "—"))
    login = html.escape(str(crm.get("login") or "—"))
    role = html.escape(str(crm.get("role") or "—"))
    email = crm.get("email")
    email_line = f"\n📧 {html.escape(str(email))}" if email else ""

    text = (
        f"👤 <b>Профиль</b>\n\n"
        f"Имя: {name}\n"
        f"Логин: {login}\n"
        f"Роль: {role}"
        f"{email_line}"
    )
    await update.message.reply_text(text, parse_mode="HTML")


async def on_menu_text(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message or not update.effective_chat:
        return
    if update.effective_chat.type != "private":
        return
    coerced = _coerce_menu_text(update.message.text or "")
    if not coerced:
        return
    text = coerced

    if text == BTN_TASKS:
        await cmd_tasks(update, context)
    elif text == BTN_DEALS:
        await _send_deals(update, context)
    elif text == BTN_MEETINGS:
        await _send_meetings(update, context)
    elif text == BTN_CHAT:
        await _send_chat_intro(update, context)
    elif text == BTN_FINANCE:
        await _send_finance(update, context)
    elif text == BTN_CLIENTS:
        await _send_clients_search_prompt(update, context)
    elif text == BTN_PROFILE:
        await _send_profile(update, context)
    elif text == BTN_HELP:
        await cmd_help(update, context)


def register(application) -> None:
    application.add_handler(
        MessageHandler(
            filters.TEXT & ~filters.COMMAND & filters.ChatType.PRIVATE,
            on_menu_text,
        )
    )


async def send_main_menu_after_auth(
    context: ContextTypes.DEFAULT_TYPE,
    chat_id: int,
    intro_html: str,
) -> None:
    """Приветствие + reply-меню; при HTTP-URL — inline «открыть в браузере»."""
    settings = context.application.bot_data["settings"]
    kb = main_reply_keyboard(settings.web_app_url)
    await context.bot.send_message(chat_id=chat_id, text=intro_html, parse_mode="HTML", reply_markup=kb)
    inline = open_site_inline_markup(settings.web_app_url)
    if inline:
        await context.bot.send_message(
            chat_id=chat_id,
            text="Сайт по HTTP — откройте в браузере (Mini App нужен HTTPS):",
            reply_markup=inline,
        )
