"""Общая привязка Telegram ↔ пользователь CRM."""
from __future__ import annotations

from telegram import Update
from telegram.ext import ContextTypes


async def resolve_crm_user(update: Update, context: ContextTypes.DEFAULT_TYPE) -> dict | None:
    api = context.application.bot_data["api"]
    crm = context.user_data.get("crm_user")
    if not crm and update.effective_user:
        crm = await api.find_user_by_telegram_id(update.effective_user.id)
        if crm:
            context.user_data["crm_user"] = crm
    return crm


def user_name(users: list[dict], uid: str) -> str:
    for u in users:
        if str(u.get("id") or "") == str(uid):
            return str(u.get("name") or u.get("login") or uid)
    return str(uid)


def is_admin(crm: dict) -> bool:
    return str(crm.get("role") or "").upper() == "ADMIN"
