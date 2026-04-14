"""Классификация ошибок в воркерах: ретрай / DLQ / алерт (фаза I)."""
from __future__ import annotations

import asyncio
import logging
from enum import Enum

import httpx

log = logging.getLogger("uvicorn.error")


class WorkerErrorKind(str, Enum):
    """Решение политики при исключении в обработчике очереди."""

    RETRY = "retry"  # не XACK — XAUTOCLAIM / повтор
    DLQ = "dlq"  # зафиксировать и не крутить вечно (если есть путь в DLQ)
    FATAL = "fatal"  # лог CRITICAL, ретрай допустим по умолчанию политики stream


def classify_worker_exception(exc: BaseException) -> WorkerErrorKind:
    if isinstance(exc, asyncio.TimeoutError):
        return WorkerErrorKind.RETRY
    if isinstance(exc, httpx.TimeoutException | httpx.ConnectError | httpx.NetworkError):
        return WorkerErrorKind.RETRY
    if isinstance(exc, httpx.HTTPStatusError):
        code = exc.response.status_code if exc.response is not None else 0
        if code in (408, 425, 429) or 500 <= code <= 599:
            return WorkerErrorKind.RETRY
        if 400 <= code <= 499:
            return WorkerErrorKind.DLQ
    if isinstance(exc, ValueError | TypeError | KeyError):
        return WorkerErrorKind.DLQ
    return WorkerErrorKind.RETRY


def log_worker_exception(*, worker: str, msg_id: str | None, exc: BaseException, kind: WorkerErrorKind) -> None:
    log.warning(
        "%s: classified=%s msg_id=%s: %s",
        worker,
        kind.value,
        msg_id or "—",
        exc,
        exc_info=True,
    )
