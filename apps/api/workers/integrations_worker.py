"""
Фоновые интеграции:
- Telegram getUpdates (воронки без webhook), offset в Redis;
- Redis Stream интеграций (``REDIS_INTEGRATIONS_STREAM``, дефолт ``queue.integrations.v1``): Meta webhook, синк личного Telegram (Telethon) в сделку;
  XREADGROUP + XACK, XAUTOCLAIM для ретраев.

Запуск из apps/api:  python -m workers.integrations_worker
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
from app.models.client import Client, Deal
from app.services.integrations_stream import (
    JOB_TYPE_META_WEBHOOK,
    JOB_TYPE_TELEGRAM_PERSONAL_SYNC,
    decode_meta_webhook_body,
    ensure_integrations_stream,
    integrations_group_name,
    integrations_stream_key,
    xack_message,
    xautoclaim_pending,
    xreadgroup_new,
)
from app.services.meta_instagram import process_instagram_webhook
from app.services.meta_webhook_queue import parse_meta_webhook_json
from app.services.telegram_leads import poll_all_funnels
from app.services.telegram_personal import sync_deal_messages
from app.services.worker_error_policy import classify_worker_exception, log_worker_exception

log = logging.getLogger("uvicorn.error")


def _integrations_consumer_name() -> str:
    return f"{socket.gethostname()}-{os.getpid()}"


async def _telegram_poll_loop(redis) -> None:
    settings = get_settings()
    interval = max(2, int(settings.TELEGRAM_LEADS_POLL_INTERVAL_SECONDS or 5))
    while True:
        try:
            async with AsyncSessionLocal() as session:
                n = await poll_all_funnels(session, redis=redis)
                await session.commit()
                if n:
                    log.info("integrations_worker: telegram leads processed=%s", n)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            kind = classify_worker_exception(exc)
            log_worker_exception(
                worker="integrations_worker",
                msg_id=None,
                exc=exc,
                kind=kind,
            )
        await asyncio.sleep(interval)


async def _process_meta_webhook_job(redis, msg_id: str, fields: dict[str, str]) -> None:
    stream = integrations_stream_key()
    group = integrations_group_name()

    async def ack_safely() -> None:
        try:
            await xack_message(redis, stream, group, msg_id)
        except Exception as exc:
            log.warning("integrations_worker: XACK failed id=%s: %s", msg_id, exc)

    typ = fields.get("type", "")
    if typ != JOB_TYPE_META_WEBHOOK:
        log.error("integrations_worker: meta handler wrong type=%r id=%s", typ, msg_id)
        await ack_safely()
        return

    raw = decode_meta_webhook_body(fields)
    if raw is None:
        log.warning("integrations_worker: bad base64 body id=%s", msg_id)
        await ack_safely()
        return

    body = parse_meta_webhook_json(raw)
    if body is None:
        log.warning("integrations_worker: invalid JSON id=%s (ACK poison)", msg_id)
        await ack_safely()
        return

    try:
        async with AsyncSessionLocal() as session:
            n = await process_instagram_webhook(session, body)
            await session.commit()
        await ack_safely()
        if n:
            log.info("integrations_worker: meta stream id=%s processed_messages=%s", msg_id, n)
    except Exception as exc:
        kind = classify_worker_exception(exc)
        log_worker_exception(
            worker="integrations_worker",
            msg_id=msg_id,
            exc=exc,
            kind=kind,
        )


async def _process_telegram_personal_sync_job(redis, msg_id: str, fields: dict[str, str]) -> None:
    stream = integrations_stream_key()
    group = integrations_group_name()

    async def ack_safely() -> None:
        try:
            await xack_message(redis, stream, group, msg_id)
        except Exception as exc:
            log.warning("integrations_worker: XACK failed id=%s: %s", msg_id, exc)

    if fields.get("type") != JOB_TYPE_TELEGRAM_PERSONAL_SYNC:
        await ack_safely()
        return

    user_id = (fields.get("user_id") or "").strip()
    deal_id = (fields.get("deal_id") or "").strip()
    try:
        limit = int(fields.get("limit") or "50")
    except ValueError:
        limit = 50
    limit = max(1, min(limit, 100))

    if not user_id or not deal_id:
        log.warning("integrations_worker: telegram_personal_sync bad fields id=%s", msg_id)
        await ack_safely()
        return

    try:
        async with AsyncSessionLocal() as session:
            deal = await session.get(Deal, deal_id)
            if not deal or deal.is_archived:
                log.warning(
                    "integrations_worker: telegram_personal_sync deal_not_found id=%s deal=%s",
                    msg_id,
                    deal_id,
                )
                await session.commit()
                await ack_safely()
                return
            linked = await session.get(Client, deal.client_id) if deal.client_id else None
            res = await sync_deal_messages(session, user_id, deal, limit=limit, linked_client=linked)
            await session.commit()
        await ack_safely()
        if res.get("ok"):
            log.info(
                "integrations_worker: telegram_personal_sync id=%s deal=%s imported=%s",
                msg_id,
                deal_id,
                res.get("imported"),
            )
        else:
            log.warning(
                "integrations_worker: telegram_personal_sync id=%s deal=%s error=%s",
                msg_id,
                deal_id,
                res.get("error"),
            )
    except Exception as exc:
        kind = classify_worker_exception(exc)
        log_worker_exception(
            worker="integrations_worker",
            msg_id=msg_id,
            exc=exc,
            kind=kind,
        )


async def _dispatch_integrations_job(redis, msg_id: str, fields: dict[str, str]) -> None:
    typ = fields.get("type", "")
    if typ == JOB_TYPE_META_WEBHOOK:
        await _process_meta_webhook_job(redis, msg_id, fields)
    elif typ == JOB_TYPE_TELEGRAM_PERSONAL_SYNC:
        await _process_telegram_personal_sync_job(redis, msg_id, fields)
    else:
        stream = integrations_stream_key()
        group = integrations_group_name()
        log.error("integrations_worker: unknown job type=%r id=%s", typ, msg_id)
        try:
            await xack_message(redis, stream, group, msg_id)
        except Exception as exc:
            log.warning("integrations_worker: XACK failed id=%s: %s", msg_id, exc)


async def _integrations_stream_loop(redis) -> None:
    if redis is None:
        log.error(
            "integrations_worker: Redis недоступен — stream интеграций не обрабатывается."
        )
        while True:
            await asyncio.sleep(86400)

    await ensure_integrations_stream(redis)
    consumer = _integrations_consumer_name()
    settings = get_settings()
    idle_ms = int(settings.REDIS_INTEGRATIONS_CLAIM_IDLE_MS or 120_000)

    log.info(
        "integrations_worker: consuming stream=%s group=%s consumer=%s",
        integrations_stream_key(),
        integrations_group_name(),
        consumer,
    )

    while True:
        try:
            for msg_id, fields in await xreadgroup_new(
                redis, consumer=consumer, block_ms=5000, count=10
            ):
                await _dispatch_integrations_job(redis, msg_id, fields)

            for msg_id, fields in await xautoclaim_pending(
                redis, consumer=consumer, idle_ms=idle_ms, count=10
            ):
                log.info("integrations_worker: retry job id=%s (XAUTOCLAIM)", msg_id)
                await _dispatch_integrations_job(redis, msg_id, fields)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            kind = classify_worker_exception(exc)
            log_worker_exception(
                worker="integrations_worker",
                msg_id=None,
                exc=exc,
                kind=kind,
            )
            await asyncio.sleep(1)


async def run_forever() -> None:
    redis = await get_redis_client()
    if redis is None:
        log.warning(
            "integrations_worker: Redis недоступен — offset Telegram только из Postgres; "
            "очередь интеграций недоступна."
        )

    await asyncio.gather(
        _telegram_poll_loop(redis),
        _integrations_stream_loop(redis),
    )


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(levelname)s %(name)s: %(message)s",
        stream=sys.stderr,
    )
    try:
        asyncio.run(run_forever())
    except KeyboardInterrupt:
        log.info("integrations_worker: interrupted")
    try:
        asyncio.run(close_redis())
    except Exception:
        pass


if __name__ == "__main__":
    main()
