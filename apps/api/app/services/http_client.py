"""Общий httpx.AsyncClient с явными таймаутами (фаза G архитектуры)."""
from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import httpx

from app.core.config import get_settings


def default_async_timeout() -> httpx.Timeout:
    s = get_settings()
    return httpx.Timeout(
        connect=float(s.HTTPX_CONNECT_TIMEOUT_SEC),
        read=float(s.HTTPX_READ_TIMEOUT_SEC),
        write=float(s.HTTPX_WRITE_TIMEOUT_SEC),
        pool=float(s.HTTPX_POOL_TIMEOUT_SEC),
    )


@asynccontextmanager
async def async_http_client(
    *,
    timeout: httpx.Timeout | float | None = None,
    **kwargs: object,
) -> AsyncIterator[httpx.AsyncClient]:
    """
    Контекстный клиент с таймаутами по умолчанию из настроек.
    Дополнительные kwargs передаются в ``httpx.AsyncClient`` (headers, limits, …).
    """
    t = default_async_timeout() if timeout is None else timeout
    kw: dict[str, object] = dict(kwargs)
    kw["timeout"] = t
    async with httpx.AsyncClient(**kw) as client:
        yield client
