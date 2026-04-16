"""
Воркер построения уведомлений по доменным событиям (async-режим).

Читает ``REDIS_EVENTS_STREAM`` в группе ``REDIS_DOMAIN_EVENTS_HUB_GROUP``,
вызывает ``process_domain_event``, ставит ``notification_events.hub_processed_at``.

Требуется ``DOMAIN_EVENTS_HUB_ASYNC=true`` у API и у этого процесса.

Запуск из ``apps/api``::

    python -m workers.domain_events_worker
"""
from __future__ import annotations

import asyncio
import logging
import os
import socket
import sys
import time
from datetime import datetime, timezone

from sqlalchemy import select

from app.core.config import get_settings
from app.core.redis import close_redis, get_redis_client
from app.db import AsyncSessionLocal
from app.models.notification import NotificationEvent
from app.services.domain_events_hub_stream import (
    domain_events_hub_group_name,
    domain_events_hub_xack,
    domain_events_stream_key,
    ensure_domain_events_hub_consumer_group,
    xautoclaim_domain_hub_pending,
    xreadgroup_domain_hub_new,
)
from app.services.event_bus import deserialize_domain_event_fields
from app.services.notification_hub import process_domain_event
from app.services.notifications_stream import enqueue_notification_delivery_jobs
from app.services.worker_error_policy import classify_worker_exception, log_worker_exception

log = logging.getLogger("uvicorn.error")


def _consumer_name() -> str:
    return f"{socket.gethostname()}-{os.getpid()}"


async def _process_stream_message(redis, msg_id: str, fields: dict[str, str]) -> None:
    stream = domain_events_stream_key()
    group = domain_events_hub_group_name()

    async def ack() -> None:
        try:
            await domain_events_hub_xack(redis, stream, group, msg_id)
        except Exception as exc:
            log.warning("domain_events_worker: XACK failed id=%s: %s", msg_id, exc)

    event = deserialize_domain_event_fields(fields)
    eid = event.get("id")
    if not eid or not isinstance(eid, str):
        log.warning("domain_events_worker: bad event id, ACK poison msg=%s", msg_id)
        await ack()
        return

    try:
        for _attempt in range(40):
            async with AsyncSessionLocal() as session:
                stmt = select(NotificationEvent).where(NotificationEvent.id == eid).with_for_update()
                result = await session.execute(stmt)
                row = result.scalar_one_or_none()
                if row is None:
                    await session.rollback()
                    await asyncio.sleep(0.025)
                    continue
                if row.hub_processed_at is not None:
                    await session.commit()
                    await ack()
                    return

                t0 = time.monotonic()
                queued_notifications = await process_domain_event(session, event)
                row.hub_processed_at = datetime.now(timezone.utc)
                await session.commit()
                await enqueue_notification_delivery_jobs(queued_notifications)
                ms = (time.monotonic() - t0) * 1000
                log.info("domain_events_worker: notification_build_ms=%.1f event_id=%s", ms, eid)
            await ack()
            return

        log.warning(
            "domain_events_worker: event row not visible after retries id=%s stream_msg=%s (no XACK)",
            eid,
            msg_id,
        )
    except Exception as exc:
        kind = classify_worker_exception(exc)
        log_worker_exception(
            worker="domain_events_worker",
            msg_id=msg_id,
            exc=exc,
            kind=kind,
        )


async def _hub_loop(redis) -> None:
    if redis is None:
        log.error("domain_events_worker: Redis unavailable — sleeping.")
        while True:
            await asyncio.sleep(86400)

    settings = get_settings()
    if not settings.DOMAIN_EVENTS_HUB_ASYNC:
        log.warning(
            "domain_events_worker: DOMAIN_EVENTS_HUB_ASYNC=false — idle (enable flag + run API with same setting)."
        )
        while True:
            await asyncio.sleep(86400)

    await ensure_domain_events_hub_consumer_group(redis)
    consumer = _consumer_name()
    idle_ms = int(settings.REDIS_DOMAIN_EVENTS_HUB_CLAIM_IDLE_MS or 120_000)

    log.info(
        "domain_events_worker: stream=%s group=%s consumer=%s",
        domain_events_stream_key(),
        domain_events_hub_group_name(),
        consumer,
    )

    while True:
        try:
            for msg_id, fields in await xreadgroup_domain_hub_new(
                redis, consumer=consumer, block_ms=5000, count=10
            ):
                await _process_stream_message(redis, msg_id, fields)

            for msg_id, fields in await xautoclaim_domain_hub_pending(
                redis, consumer=consumer, idle_ms=idle_ms, count=10
            ):
                log.info("domain_events_worker: XAUTOCLAIM id=%s", msg_id)
                await _process_stream_message(redis, msg_id, fields)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            kind = classify_worker_exception(exc)
            log_worker_exception(
                worker="domain_events_worker",
                msg_id=None,
                exc=exc,
                kind=kind,
            )
            await asyncio.sleep(1)


async def _run() -> None:
    redis = await get_redis_client()
    try:
        await _hub_loop(redis)
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
        log.info("domain_events_worker: interrupted")


if __name__ == "__main__":
    main()
