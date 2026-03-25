"""Фоновые задачи (telegram.ext.JobQueue, тот же event loop что и бот)."""
from __future__ import annotations

from datetime import timedelta

from telegram.ext import ContextTypes

from taska_bot.api.client import ApiClient
from taska_bot.services.deal_broadcast import run_deal_notifications
from taska_bot.services.summaries import (
    build_daily_reminder_message,
    build_group_daily_summary,
    build_weekly_report_message,
)


def _as_chat_id(raw) -> int | str:
    if raw is None:
        return 0
    s = str(raw).strip()
    try:
        return int(s)
    except ValueError:
        return s


async def job_daily_reminders(context: ContextTypes.DEFAULT_TYPE) -> None:
    api: ApiClient = context.application.bot_data["api"]
    for user in await api.get_users():
        if user.get("isArchived"):
            continue
        tid = user.get("telegramUserId")
        if not tid:
            continue
        msg = await build_daily_reminder_message(api, user["id"])
        if not msg:
            continue
        try:
            await context.bot.send_message(chat_id=_as_chat_id(tid), text=msg)
        except Exception as e:
            context.application.logger.warning("daily_reminder %s: %s", tid, e)


async def job_group_daily_summary(context: ContextTypes.DEFAULT_TYPE) -> None:
    settings = context.application.bot_data["settings"]
    api: ApiClient = context.application.bot_data["api"]
    prefs = await api.get_notification_prefs("default")
    if not prefs:
        return
    gds = prefs.get("groupDailySummary", {"telegramGroup": True})
    if not gds.get("telegramGroup", True):
        return
    chat_id = prefs.get("telegramGroupChatId")
    if not chat_id:
        return
    text = await build_group_daily_summary(api, settings.timezone)
    if not text:
        return
    try:
        await context.bot.send_message(chat_id=_as_chat_id(chat_id), text=text, parse_mode="HTML")
    except Exception as e:
        context.application.logger.warning("group_daily: %s", e)


async def job_weekly_report(context: ContextTypes.DEFAULT_TYPE) -> None:
    settings = context.application.bot_data["settings"]
    api: ApiClient = context.application.bot_data["api"]
    prefs = await api.get_notification_prefs("default")
    if not prefs:
        return
    chat_id = prefs.get("telegramGroupChatId")
    if not chat_id:
        return
    text = await build_weekly_report_message(api, settings.timezone)
    if not text:
        return
    try:
        await context.bot.send_message(chat_id=_as_chat_id(chat_id), text=text)
    except Exception as e:
        context.application.logger.warning("weekly: %s", e)


def schedule_jobs(application, tz) -> None:
    """Регистрация после старта приложения (вызывается из post_init)."""
    from datetime import time

    jq = application.job_queue
    if jq is None:
        application.logger.error(
            "JobQueue отсутствует. Установите: pip install 'python-telegram-bot[job-queue]'"
        )
        return

    t09 = time(9, 0, tzinfo=tz)
    jq.run_daily(job_daily_reminders, time=t09, days=tuple(range(7)), name="daily_reminders")
    jq.run_daily(job_group_daily_summary, time=t09, days=tuple(range(7)), name="group_daily")
    jq.run_daily(job_weekly_report, time=t09, days=(0,), name="weekly_mon")
    jq.run_repeating(
        run_deal_notifications,
        interval=timedelta(minutes=5),
        first=timedelta(seconds=20),
        name="deals_group",
    )
