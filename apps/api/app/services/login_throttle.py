"""Блокировка логина после серии неудач (Redis)."""
from __future__ import annotations

import logging

from app.core.config import get_settings
from app.core.redis import get_redis_client

log = logging.getLogger("uvicorn.error")


def _norm_login(login: str) -> str:
    return (login or "").strip().lower()[:200]


async def is_login_locked(login: str) -> int | None:
    """Если заблокирован — вернуть оставшиеся секунды TTL, иначе None."""
    redis = await get_redis_client()
    if redis is None:
        return None
    key = f"login_lock:{_norm_login(login)}"
    exists = await redis.exists(key)
    if not exists:
        return None
    ttl = await redis.ttl(key)
    return max(int(ttl), 1)


async def record_login_failure(login: str) -> None:
    settings = get_settings()
    redis = await get_redis_client()
    if redis is None:
        log.warning("Login throttle: Redis недоступен, блокировка отключена")
        return
    norm = _norm_login(login)
    fail_key = f"login_fail:{norm}"
    lock_key = f"login_lock:{norm}"
    n = await redis.incr(fail_key)
    if n == 1:
        await redis.expire(fail_key, settings.LOGIN_LOCKOUT_SECONDS)
    if n >= settings.LOGIN_MAX_ATTEMPTS:
        await redis.set(lock_key, "1", ex=settings.LOGIN_LOCKOUT_SECONDS)
        await redis.delete(fail_key)


async def reset_login_throttle(login: str) -> None:
    redis = await get_redis_client()
    if redis is None:
        return
    norm = _norm_login(login)
    await redis.delete(f"login_fail:{norm}")
    await redis.delete(f"login_lock:{norm}")
