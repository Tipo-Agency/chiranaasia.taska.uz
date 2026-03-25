"""Сборка Application: API-клиент, JobQueue, хендлеры."""
from __future__ import annotations

import logging

import pytz
from telegram import Update
from telegram.ext import Application

from taska_bot.api.client import ApiClient
from taska_bot.handlers.commands import register as register_handlers
from taska_bot.jobs.scheduled import schedule_jobs
from taska_bot.settings import Settings, load_settings

logger = logging.getLogger(__name__)


def build_application(settings: Settings | None = None) -> Application:
    s = settings or load_settings()
    api = ApiClient(s.backend_url)

    async def post_init(app: Application) -> None:
        app.bot_data["settings"] = s
        app.bot_data["api"] = api
        tz = pytz.timezone(s.timezone)
        schedule_jobs(app, tz)
        logger.info("Bot post_init: API client and jobs ready (timezone=%s)", s.timezone)

    async def post_shutdown(app: Application) -> None:
        await api.aclose()
        logger.info("API client closed")

    application = (
        Application.builder()
        .token(s.telegram_token)
        .post_init(post_init)
        .post_shutdown(post_shutdown)
        .build()
    )
    register_handlers(application)
    return application


def run() -> None:
    logging.basicConfig(
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        level=logging.INFO,
        force=True,
    )
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("telegram").setLevel(logging.WARNING)
    logging.getLogger("apscheduler").setLevel(logging.WARNING)

    app = build_application()
    logger.info("Polling…")
    app.run_polling(allowed_updates=Update.ALL_TYPES, drop_pending_updates=True)
