"""
Воркер доставки уведомлений (отдельный процесс от API).

Очередь: Redis Stream из ``REDIS_NOTIFICATIONS_STREAM`` (дефолт ``queue.notifications.v1``),
consumer group ``notifications`` (``REDIS_NOTIFICATIONS_GROUP``).

Протокол:
  1. **XREADGROUP** … **STREAMS** … **>** — новые сообщения для группы.
  2. **XAUTOCLAIM** — зависшие в PEL (без XACK) после ``REDIS_NOTIFICATIONS_CLAIM_IDLE_MS``.
  3. Поле сообщения: ``notification_id`` → в БД читаются строки ``notification_deliveries``
     (каналы ``telegram`` / ``email``), отправка через HTTP Telegram API и SMTP
     (логика в ``app.services.notification_delivery.process_deliveries_for_notification``).
  4. После успешного ``commit`` сессии: **XACK**, если обработка завершена с точки зрения stream
     (``should_ack_stream``): все доставки terminal либо только ``retry`` с будущим ``next_retry_at``
     (тогда сообщение не ACK — снова выдастся после idle).

API и Uvicorn **не** вызывают отправку: только **XADD** задач и постановка строк в БД.

Запуск (из каталога ``apps/api``, то же venv что и у backend)::

    python -m workers.notifications_worker

Требуются те же переменные окружения, что для API: ``DATABASE_URL``, ``REDIS_URL``, ``SECRET_KEY``.
Telegram: токен из воронки (``notification_prefs.default_funnel_id`` → расшифрованный ``botToken`` при
включённом канале), иначе fallback ``TELEGRAM_BOT_TOKEN``. Для email — настройки SMTP.
"""
from __future__ import annotations

import asyncio
import logging
import os
import socket
import sys

from app.core.config import get_settings
from app.core.redis import close_redis, get_redis_client
from app.db import AsyncSessionLocal
from app.services.notification_delivery import process_deliveries_for_notification
from app.services.notifications_stream import (
    ensure_notifications_stream,
    notifications_group_name,
    notifications_stream_key,
    notifications_xack,
    xautoclaim_notifications_pending,
    xreadgroup_notifications_new,
)
from app.services.worker_error_policy import classify_worker_exception, log_worker_exception

log = logging.getLogger("uvicorn.error")


def _consumer_name() -> str:
    return f"{socket.gethostname()}-{os.getpid()}"


async def _process_stream_message(redis, msg_id: str, fields: dict[str, str]) -> None:
    """
    Одно сообщение stream: доставки по notification_id, затем XACK при успехе и should_ack_stream.
    """
    stream = notifications_stream_key()
    group = notifications_group_name()
    nid = (fields.get("notification_id") or "").strip()

    async def ack_after_success() -> None:
        """XACK только после успешного commit и явного разрешения (нет отложенной работы по тому же job)."""
        try:
            await notifications_xack(redis, stream, group, msg_id)
            log.info("notifications_worker: XACK id=%s notification_id=%s", msg_id, nid or "—")
        except Exception as exc:
            log.warning("notifications_worker: XACK failed id=%s: %s", msg_id, exc)

    if not nid:
        log.warning("notifications_worker: empty notification_id, ACK poison id=%s", msg_id)
        await ack_after_success()
        return

    try:
        async with AsyncSessionLocal() as session:
            result = await process_deliveries_for_notification(session, nid)
            await session.commit()

        if result.get("should_ack_stream"):
            await ack_after_success()
        else:
            log.info(
                "notifications_worker: skip XACK (backoff) id=%s notification_id=%s",
                msg_id,
                nid,
            )

        if result.get("processed") or result.get("sent") or result.get("failed"):
            log.info(
                "notifications_worker: done id=%s notification_id=%s processed=%s sent=%s dead=%s",
                msg_id,
                nid,
                result.get("processed"),
                result.get("sent"),
                result.get("failed"),
            )
    except Exception as exc:
        kind = classify_worker_exception(exc)
        log_worker_exception(
            worker="notifications_worker",
            msg_id=msg_id,
            exc=exc,
            kind=kind,
        )


async def _notifications_stream_loop(redis) -> None:
    if redis is None:
        log.error("notifications_worker: Redis unavailable — exiting stream loop (sleep).")
        while True:
            await asyncio.sleep(86400)

    await ensure_notifications_stream(redis)
    consumer = _consumer_name()
    settings = get_settings()
    idle_ms = int(settings.REDIS_NOTIFICATIONS_CLAIM_IDLE_MS or 120_000)

    log.info(
        "notifications_worker: XREADGROUP stream=%s group=%s consumer=%s",
        notifications_stream_key(),
        notifications_group_name(),
        consumer,
    )

    while True:
        try:
            # Новые записи: XREADGROUP GROUP <group> <consumer> COUNT … BLOCK … STREAMS <key> >
            for msg_id, fields in await xreadgroup_notifications_new(
                redis, consumer=consumer, block_ms=5000, count=10
            ):
                await _process_stream_message(redis, msg_id, fields)

            for msg_id, fields in await xautoclaim_notifications_pending(
                redis, consumer=consumer, idle_ms=idle_ms, count=10
            ):
                log.info("notifications_worker: XAUTOCLAIM id=%s", msg_id)
                await _process_stream_message(redis, msg_id, fields)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            kind = classify_worker_exception(exc)
            log_worker_exception(
                worker="notifications_worker",
                msg_id=None,
                exc=exc,
                kind=kind,
            )
            await asyncio.sleep(1)


async def _run() -> None:
    redis = await get_redis_client()
    try:
        await _notifications_stream_loop(redis)
    finally:
        try:
            await close_redis()
        except Exception:
            pass


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(levelname)s %(name)s: %(message)s",
        stream=sys.stderr,
    )
    try:
        asyncio.run(_run())
    except KeyboardInterrupt:
        log.info("notifications_worker: interrupted")


if __name__ == "__main__":
    main()
