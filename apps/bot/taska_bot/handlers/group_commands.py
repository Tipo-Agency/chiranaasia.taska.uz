"""Команды для групп: создание задач и привязка group chat id."""
from __future__ import annotations

import html
import uuid
from datetime import datetime, timezone

from telegram import Update
from telegram.ext import CommandHandler, ContextTypes


async def cmd_task_in_group(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message or not update.effective_chat or not update.effective_user:
        return
    if update.effective_chat.type == "private":
        return

    api = context.application.bot_data["api"]
    crm = await api.find_user_by_telegram_id(update.effective_user.id)
    if not crm:
        await update.message.reply_text("Сначала привяжите Telegram: напишите боту в личку и сделайте /start.")
        return

    raw = " ".join(context.args or []).strip()
    if not raw and update.message.reply_to_message:
        raw = (update.message.reply_to_message.text or "").strip()
    if not raw:
        await update.message.reply_text("Использование: /task текст задачи (или ответьте /task на сообщение).")
        return

    statuses = await api.get_statuses()
    priorities = await api.get_priorities()
    st = str(statuses[0].get("name") or "Не начато") if statuses else "Не начато"
    pr = str(priorities[0].get("name") or "Средний") if priorities else "Средний"

    uid = str(crm.get("id") or "")
    tid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    ok = await api.put_tasks(
        [
            {
                "id": tid,
                "title": raw[:500],
                "description": None,
                "status": st,
                "priority": pr,
                "assigneeId": uid,
                "assigneeIds": [],
                "endDate": "",
                "isArchived": False,
                "entityType": "task",
                "createdByUserId": uid,
                "createdAt": now,
                "comments": [],
                "source": "telegram_group",
            }
        ]
    )
    if ok:
        await update.message.reply_text(
            f"✅ Задача создана и назначена на вас: <b>{html.escape(raw[:120])}</b>",
            parse_mode="HTML",
        )
    else:
        await update.message.reply_text("Не удалось создать задачу.")


def register(application) -> None:
    application.add_handler(CommandHandler("task", cmd_task_in_group))
    application.add_handler(CommandHandler("bindgroup", cmd_bind_group))
    application.add_handler(CommandHandler("groupstatus", cmd_group_status))


async def _resolve_admin(update: Update, context: ContextTypes.DEFAULT_TYPE) -> dict | None:
    if not update.effective_user:
        return None
    api = context.application.bot_data["api"]
    crm = await api.find_user_by_telegram_id(update.effective_user.id)
    if not crm:
        return None
    role = str(crm.get("role") or "").upper()
    return crm if role == "ADMIN" else None


async def cmd_bind_group(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message or not update.effective_chat:
        return
    if update.effective_chat.type == "private":
        await update.message.reply_text("Эта команда работает только в группе.")
        return
    admin = await _resolve_admin(update, context)
    if not admin:
        await update.message.reply_text("Только ADMIN с привязанным Telegram может выполнить /bindgroup.")
        return
    api = context.application.bot_data["api"]
    prefs = await api.get_notification_prefs("default") or {}
    prefs["telegramGroupChatId"] = str(update.effective_chat.id)
    gds = dict(prefs.get("groupDailySummary") or {})
    if "telegramGroup" not in gds:
        gds["telegramGroup"] = True
    prefs["groupDailySummary"] = gds
    ok = await api.put_notification_prefs(prefs, "default")
    if ok:
        await update.message.reply_text(
            f"✅ Группа привязана для уведомлений.\nchat_id: <code>{update.effective_chat.id}</code>",
            parse_mode="HTML",
        )
    else:
        await update.message.reply_text("Не удалось сохранить настройки группы.")


async def cmd_group_status(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message:
        return
    api = context.application.bot_data["api"]
    prefs = await api.get_notification_prefs("default") or {}
    cid = str(prefs.get("telegramGroupChatId") or "")
    gds = dict(prefs.get("groupDailySummary") or {})
    enabled = bool(gds.get("telegramGroup", True))
    text = (
        "📣 <b>Статус групповых уведомлений</b>\n"
        f"chat_id: <code>{html.escape(cid or 'не задан')}</code>\n"
        f"groupDailySummary.telegramGroup: <b>{'on' if enabled else 'off'}</b>\n\n"
        "Для привязки текущей группы: /bindgroup (только ADMIN)."
    )
    await update.message.reply_text(text, parse_mode="HTML")

