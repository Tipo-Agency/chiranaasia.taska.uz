"""Переменные окружения бота."""
from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    telegram_token: str
    backend_url: str
    timezone: str = "Asia/Tashkent"


def load_settings() -> Settings:
    token = (os.getenv("TELEGRAM_BOT_TOKEN") or "").strip()
    if not token:
        raise ValueError("TELEGRAM_BOT_TOKEN обязателен в .env")
    backend = (os.getenv("BACKEND_URL") or "").strip().rstrip("/")
    if not backend:
        raise ValueError("BACKEND_URL обязателен (например http://127.0.0.1:8003)")
    tz = (os.getenv("DEFAULT_TIMEZONE") or "Asia/Tashkent").strip()
    return Settings(telegram_token=token, backend_url=backend, timezone=tz)
