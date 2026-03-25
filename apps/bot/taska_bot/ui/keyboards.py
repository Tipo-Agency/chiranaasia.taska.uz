"""Клавиатуры: главное меню в личке, Web App."""
from __future__ import annotations

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, KeyboardButton, ReplyKeyboardMarkup, WebAppInfo

# Тексты кнопок (как пишет пользователь / как на кнопке)
BTN_TASKS = "📋 Задачи"
BTN_DEALS = "🎯 Сделки"
BTN_MEETINGS = "📅 Встречи"
BTN_CHAT = "💬 Чат"
BTN_FINANCE = "📝 Заявки"
BTN_CLIENTS = "👥 Клиенты"
BTN_PROFILE = "👤 Профиль"
BTN_HELP = "❓ Помощь"
BTN_WEBAPP = "🌐 Система"


def main_reply_keyboard(web_app_url: str) -> ReplyKeyboardMarkup:
    """
    Постоянное нижнее меню в личке.
    Кнопка Web App — только при HTTPS (требование Telegram).
    """
    rows: list[list[KeyboardButton]] = [
        [KeyboardButton(BTN_TASKS), KeyboardButton(BTN_DEALS)],
        [KeyboardButton(BTN_MEETINGS), KeyboardButton(BTN_CHAT)],
        [KeyboardButton(BTN_FINANCE), KeyboardButton(BTN_CLIENTS)],
        [KeyboardButton(BTN_PROFILE), KeyboardButton(BTN_HELP)],
    ]
    if web_app_url.startswith("https://"):
        rows.append([KeyboardButton(BTN_WEBAPP, web_app=WebAppInfo(url=web_app_url))])
    return ReplyKeyboardMarkup(
        rows,
        resize_keyboard=True,
        is_persistent=True,
        selective=False,
    )


def open_site_inline_markup(http_url: str) -> InlineKeyboardMarkup | None:
    """Если URL только http — отдельная inline-кнопка «открыть в браузере»."""
    if not http_url or not http_url.startswith("http"):
        return None
    if http_url.startswith("https://"):
        return None
    return InlineKeyboardMarkup(
        [[InlineKeyboardButton("Открыть сайт в браузере", url=http_url)]]
    )
