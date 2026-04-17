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
    # Публичный URL веб-интерфейса (HTTPS) — для кнопки Web App в Telegram
    web_app_url: str = ""


def load_settings() -> Settings:
    token = (os.getenv("TELEGRAM_BOT_TOKEN") or "").strip()
    if not token:
        raise ValueError("TELEGRAM_BOT_TOKEN обязателен в .env")
    backend = (os.getenv("BACKEND_URL") or "").strip().rstrip("/")
    if not backend:
        raise ValueError("BACKEND_URL обязателен (например http://127.0.0.1:8003)")
    tz = (os.getenv("DEFAULT_TIMEZONE") or "Asia/Tashkent").strip()
    # Если переменные не заданы на сервере (apps/bot/.env), используем домен по умолчанию,
    # чтобы кнопки Web App работали "из коробки".
    web = (os.getenv("WEB_APP_URL") or os.getenv("PUBLIC_APP_URL") or "https://chiranaasia.taska.uz").strip().rstrip("/")
    return Settings(telegram_token=token, backend_url=backend, timezone=tz, web_app_url=web)
