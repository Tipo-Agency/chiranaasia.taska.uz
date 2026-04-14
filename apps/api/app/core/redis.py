"""Единый async Redis (redis.asyncio): клиент, Depends, префиксы ключей для очередей и idempotency."""
from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncGenerator

import redis.asyncio as redis_ai
from redis.asyncio import Redis

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_lock = asyncio.Lock()
_client: Redis | None = None

# Общий префикс для новых подсистем (очереди, idempotency). Существующие ключи (login_*, streams по имени из env) не трогаем.
KEY_PREFIX = "taska"


def redis_key(*parts: str) -> str:
    """Ключ вида taska:a:b:c — для списков/сортированных сетов, locks, кэша."""
    tail = ":".join(p.strip(":") for p in parts if p)
    return f"{KEY_PREFIX}:{tail}" if tail else KEY_PREFIX


def queue_list_key(queue_name: str) -> str:
    """Ключ Redis LIST для очереди (например rpush/blpop)."""
    return redis_key("queue", queue_name)


def idempotency_key(scope: str, fingerprint: str) -> str:
    """Ключ для SET NX EX / GET — идемпотентность HTTP или обработчика."""
    return redis_key("idemp", scope, fingerprint)


def notifications_user_pubsub_channel(user_id: str) -> str:
    """Имя канала Redis Pub/Sub для push in-app уведомлений одному пользователю."""
    uid = (user_id or "").strip()
    return redis_key("pub", "notifications", "user", uid)


def notifications_user_pubsub_pattern() -> str:
    """Шаблон PSUBSCRIBE для всех каналов ``notifications_user_pubsub_channel``."""
    return redis_key("pub", "notifications", "user", "*")


def notifications_user_pubsub_prefix() -> str:
    """Префикс канала + ``:`` для извлечения ``user_id`` из полного имени канала."""
    return redis_key("pub", "notifications", "user") + ":"


async def get_redis_client() -> Redis | None:
    """Возвращает общий async-клиент или None при ошибке инициализации (как раньше)."""
    global _client
    if _client is not None:
        return _client
    async with _lock:
        if _client is not None:
            return _client
        try:
            settings = get_settings()
            _client = redis_ai.Redis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
            )
            return _client
        except Exception as exc:
            logger.warning("Redis init failed: %s", exc)
            return None


async def close_redis() -> None:
    """Закрыть пул соединений (shutdown приложения)."""
    global _client
    async with _lock:
        if _client is None:
            return
        try:
            await _client.aclose()
        except Exception as exc:
            logger.warning("Redis close failed: %s", exc)
        _client = None


async def get_redis() -> AsyncGenerator[Redis | None, None]:
    """FastAPI Depends — тот же singleton, без отдельного подключения на запрос."""
    yield await get_redis_client()
