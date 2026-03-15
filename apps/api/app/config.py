"""Application configuration."""
import os
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings from environment."""

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://taska:taska@localhost:5432/taska"

    # Auth
    SECRET_KEY: str = "change-me-in-production-use-openssl-rand-hex-32"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # CORS
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"

    # API prefix
    API_PREFIX: str = "/api"

    # Optional: Telegram alerts on CRITICAL errors (chat_id for employee notifications group)
    TELEGRAM_ALERT_CHAT_ID: str = ""
    TELEGRAM_EMPLOYEE_BOT_TOKEN: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()
