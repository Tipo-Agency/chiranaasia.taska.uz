"""Application configuration (pydantic-settings)."""
from __future__ import annotations

from functools import lru_cache

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def parse_cors_origins(raw: str) -> list[str]:
    """Явные origin из CORS_ORIGINS (через запятую). Без wildcard — см. validate_cors_origins."""
    return [o.strip() for o in raw.split(",") if o.strip()]


def effective_browser_origin_allowlist(cors_origins: str, public_base_url: str = "") -> list[str]:
    """Origin для CORS и CSRF: CORS_ORIGINS + при необходимости origin из PUBLIC_BASE_URL (без дублей)."""
    from urllib.parse import urlparse

    origins = [o.strip().rstrip("/") for o in parse_cors_origins(cors_origins)]
    seen = set(origins)
    raw = (public_base_url or "").strip()
    if raw:
        if "://" not in raw:
            raw = f"https://{raw}"
        p = urlparse(raw)
        if p.scheme in ("http", "https") and p.netloc:
            base = f"{p.scheme}://{p.netloc}".rstrip("/")
            if base not in seen:
                origins.append(base)
    return origins


class Settings(BaseSettings):
    """Настройки только из окружения / .env. Секреты без дефолтов."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Обязательные (ошибка при старте, если не заданы)
    DATABASE_URL: str = Field(..., description="PostgreSQL SQLAlchemy async URL")
    # Лимит времени одного SQL-запроса для пула приложения (API + воркеры), мс. None/0 — не задавать.
    # Alembic использует отдельный engine из alembic/env.py — миграции этим лимитом не ограничиваются.
    DATABASE_STATEMENT_TIMEOUT_MS: int | None = Field(
        default=None,
        description="PostgreSQL statement_timeout для соединений приложения (мс); пусто — без лимита",
    )
    SECRET_KEY: str = Field(..., description="JWT signing secret, >= 32 символов")
    REDIS_URL: str = Field(..., description="Redis URL")

    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    BCRYPT_ROUNDS: int = 12

    ENVIRONMENT: str = "development"

    SECURITY_CSP: str = ""
    SECURITY_ENABLE_HSTS: bool = False
    MAX_REQUEST_BODY_BYTES: int = 5_000_000
    WEBHOOK_MAX_BODY_BYTES: int = 10_000_000
    CSRF_PROTECTION_ENABLED: bool = True
    CSRF_COOKIE_NAME: str = "csrf_token"
    ACCESS_TOKEN_COOKIE_NAME: str = "access_token"
    REFRESH_TOKEN_COOKIE_NAME: str = "refresh_token"
    # False: JWT только из HttpOnly cookie (браузер). True — для сервисов с Authorization: Bearer.
    AUTH_ALLOW_BEARER_HEADER: bool = False
    COOKIE_SECURE: bool = False
    COOKIE_SAMESITE: str = "lax"
    COOKIE_DOMAIN: str = ""

    LOGIN_MAX_ATTEMPTS: int = 5
    LOGIN_LOCKOUT_SECONDS: int = 900

    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"
    # True: Access-Control-Allow-Credentials (cookies). Допустимо только с явным allow_origins (не *).
    CORS_ALLOW_CREDENTIALS: bool = True

    API_PREFIX: str = "/api"

    PUBLIC_BASE_URL: str = ""

    TELEGRAM_ALERT_CHAT_ID: str = ""
    TELEGRAM_EMPLOYEE_BOT_TOKEN: str = ""
    TELEGRAM_BOT_TOKEN: str = ""

    META_MARKER: str = ""
    META_APP_SECRET: str = ""
    META_TASKA: str = ""
    META_TIPA: str = ""
    META_UCHETGRAM: str = ""
    META_WEBHOOK_LOG_BODY: bool = False
    META_WEBHOOK_VERIFY_SIGNATURE: bool = True

    # Redis Streams: шаблон queue.<домен>.v1 — см. docs/QUEUES.md. Легаси: переопределите env
    # (например REDIS_EVENTS_STREAM=events.domain.v1) до дренажа старого stream.
    REDIS_EVENTS_STREAM: str = "queue.domain.v1"
    REDIS_INTEGRATIONS_STREAM: str = "queue.integrations.v1"
    REDIS_INTEGRATIONS_GROUP: str = "integrations"
    REDIS_INTEGRATIONS_CLAIM_IDLE_MS: int = 120_000

    REDIS_NOTIFICATIONS_STREAM: str = "queue.notifications.v1"
    REDIS_NOTIFICATIONS_GROUP: str = "notifications"
    REDIS_NOTIFICATIONS_CLAIM_IDLE_MS: int = 120_000

    # True: process_domain_event только во воркере (см. workers.domain_events_worker).
    # False (дефолт): синхронно в HTTP — для локальной отладки без воркера.
    DOMAIN_EVENTS_HUB_ASYNC: bool = False
    REDIS_DOMAIN_EVENTS_HUB_GROUP: str = "notification_hub"
    REDIS_DOMAIN_EVENTS_HUB_CLAIM_IDLE_MS: int = 120_000

    # WebSocket: 0 = без лимита
    WEBSOCKET_MAX_CONNECTIONS_PER_USER: int = 20

    SENTRY_DSN: str = ""
    PROMETHEUS_SCRAPE_TOKEN: str = ""

    HTTPX_CONNECT_TIMEOUT_SEC: float = 10.0
    HTTPX_READ_TIMEOUT_SEC: float = 60.0
    HTTPX_WRITE_TIMEOUT_SEC: float = 30.0
    HTTPX_POOL_TIMEOUT_SEC: float = 10.0

    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "noreply@chiranaasia.taska.uz"
    SMTP_USE_TLS: bool = True
    NOTIFICATIONS_RETENTION_DAYS: int = 90
    NOTIFICATIONS_RETENTION_INTERVAL_SECONDS: int = 3600

    TELEGRAM_LEADS_POLL_INTERVAL_SECONDS: int = 5
    TELEGRAM_LEADS_POLL_LIMIT: int = 50

    TELEGRAM_API_ID: int = 0
    TELEGRAM_API_HASH: str = ""

    # Публичный base URL **бэкенда** (для Google OAuth redirect_uri). Пусто — PUBLIC_BASE_URL, иначе http://127.0.0.1:8000
    API_PUBLIC_BASE_URL: str = ""
    GOOGLE_OAUTH_CLIENT_ID: str = ""
    GOOGLE_OAUTH_CLIENT_SECRET: str = ""
    # Путь на фронте после успешного OAuth (первый origin из CORS)
    MAIL_OAUTH_FRONTEND_PATH: str = "/settings?tab=profile&mail_connected=1"

    # S3-совместимое хранилище медиа (вложения сделок). Пусто — медиа в S3 не пишем (только legacy tgMessageId / без вложений).
    S3_BUCKET: str = ""
    S3_REGION: str = "us-east-1"
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    S3_ENDPOINT_URL: str = ""
    S3_MEDIA_PREFIX: str = "taska/media"
    S3_SIGNED_URL_EXPIRE_SECONDS: int = 3600

    CALENDAR_EXPORT_TZID: str = "Asia/Tashkent"

    # Idempotency-Key (POST /api/*): Redis, SHA-256 тела; см. middleware/idempotency.py
    IDEMPOTENCY_ENABLED: bool = True
    IDEMPOTENCY_TTL_SECONDS: int = 86_400
    IDEMPOTENCY_MAX_KEY_LEN: int = 256

    @field_validator("DATABASE_STATEMENT_TIMEOUT_MS")
    @classmethod
    def statement_timeout_non_negative(cls, v: object) -> int | None:
        if v is None:
            return None
        if not isinstance(v, int):
            raise TypeError("DATABASE_STATEMENT_TIMEOUT_MS must be int or unset")
        if v < 0:
            raise ValueError("DATABASE_STATEMENT_TIMEOUT_MS must be >= 0")
        if v == 0:
            return None
        return v

    @field_validator("DATABASE_URL", "REDIS_URL")
    @classmethod
    def strip_required_non_empty(cls, v: object) -> str:
        if not isinstance(v, str) or not v.strip():
            raise ValueError("must be a non-empty string")
        return v.strip()

    @field_validator("SECRET_KEY")
    @classmethod
    def validate_secret_key(cls, v: object) -> str:
        if not isinstance(v, str):
            raise TypeError("SECRET_KEY must be a string")
        s = v.strip()
        if len(s) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters long")
        low = s.lower()
        forbidden = (
            "change-me",
            "changeme",
            "your-secret-key",
            "replace_me",
            "placeholder",
            "secret_key_here",
        )
        for needle in forbidden:
            if needle in low:
                raise ValueError(f"SECRET_KEY must not look like a placeholder (contains {needle!r})")
        return s

    @field_validator("CORS_ORIGINS")
    @classmethod
    def validate_cors_origins(cls, v: object) -> str:
        if not isinstance(v, str):
            raise TypeError("CORS_ORIGINS must be a string")
        s = v.strip()
        origins = parse_cors_origins(s)
        if not origins:
            raise ValueError("CORS_ORIGINS must list at least one origin (comma-separated)")
        for o in origins:
            if o == "*":
                raise ValueError(
                    "CORS_ORIGINS must not contain '*' — browsers forbid wildcard with credentials; "
                    "list explicit http(s):// origins"
                )
        return s

    @model_validator(mode="after")
    def csrf_required_in_production(self) -> Settings:
        """В production/staging нельзя отключать CSRF через env (ошибка при старте)."""
        env = (self.ENVIRONMENT or "").strip().lower()
        if env in ("production", "prod", "staging") and not self.CSRF_PROTECTION_ENABLED:
            raise ValueError(
                "CSRF_PROTECTION_ENABLED must be True when ENVIRONMENT is production, prod, or staging"
            )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
