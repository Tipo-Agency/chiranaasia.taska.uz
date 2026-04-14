"""
Очередь интеграций: Redis Stream из ``REDIS_INTEGRATIONS_STREAM`` (дефолт ``queue.integrations.v1``) + group ``integrations``.

- XADD: Meta webhook (body base64), синк личного Telegram (Telethon) в сделку.
- XREADGROUP / XAUTOCLAIM во воркере, XACK после успешного commit.
- Сообщения без ACK остаются в PEL → повторная выдача после min_idle (ретраи).
"""
from __future__ import annotations

import base64
import logging
from typing import Any

from redis.exceptions import ResponseError

from app.core.config import get_settings

log = logging.getLogger("uvicorn.error")

JOB_TYPE_META_WEBHOOK = "meta_webhook"
JOB_TYPE_TELEGRAM_PERSONAL_SYNC = "telegram_personal_sync"
# Дорожная карта (см. docs/INTEGRATIONS.md §12): email_sync, onec_import, telephony_event, edo_poll, bank_statement_import, …


def integrations_stream_key() -> str:
    return get_settings().REDIS_INTEGRATIONS_STREAM


def integrations_group_name() -> str:
    return get_settings().REDIS_INTEGRATIONS_GROUP


async def ensure_integrations_stream(redis: Any) -> None:
    """XGROUP CREATE … MKSTREAM (идемпотентно)."""
    stream = integrations_stream_key()
    group = integrations_group_name()
    try:
        await redis.xgroup_create(stream, group, id="0", mkstream=True)
        log.info("integrations_stream: created %s group=%s", stream, group)
    except ResponseError as exc:
        err = str(exc)
        if "BUSYGROUP" in err or "already exists" in err.lower():
            return
        raise


async def xadd_telegram_personal_sync_job(
    redis: Any, *, user_id: str, deal_id: str, limit: int
) -> str:
    """Поставить в очередь синхронизацию переписки сделки через Telethon (обработка во воркере)."""
    stream = integrations_stream_key()
    lim = max(1, min(int(limit), 100))
    msg_id: str = await redis.xadd(
        stream,
        {
            "type": JOB_TYPE_TELEGRAM_PERSONAL_SYNC,
            "user_id": str(user_id).strip(),
            "deal_id": str(deal_id).strip(),
            "limit": str(lim),
        },
        maxlen=100_000,
        approximate=True,
    )
    return msg_id


async def xadd_meta_webhook_job(redis: Any, raw_body: bytes) -> str:
    """Добавить задачу разбора Meta webhook. Возвращает id записи в stream."""
    stream = integrations_stream_key()
    b64 = base64.b64encode(raw_body).decode("ascii")
    msg_id: str = await redis.xadd(
        stream,
        {"type": JOB_TYPE_META_WEBHOOK, "body": b64},
        maxlen=100_000,
        approximate=True,
    )
    return msg_id


async def xack_message(redis: Any, stream: str, group: str, message_id: str) -> None:
    await redis.xack(stream, group, message_id)


async def xreadgroup_new(
    redis: Any,
    *,
    consumer: str,
    block_ms: int = 5000,
    count: int = 10,
) -> list[tuple[str, dict[str, str]]]:
    """
    Новые сообщения для consumer group (``>``).
    Возвращает [(msg_id, fields), ...].
    """
    stream = integrations_stream_key()
    group = integrations_group_name()
    out = await redis.xreadgroup(
        groupname=group,
        consumername=consumer,
        streams={stream: ">"},
        count=count,
        block=block_ms,
    )
    if not out:
        return []
    result: list[tuple[str, dict[str, str]]] = []
    for _stream_name, messages in out:
        if not messages:
            continue
        for msg_id, fields in messages:
            if isinstance(fields, dict):
                result.append((str(msg_id), {str(k): str(v) for k, v in fields.items()}))
    return result


async def xautoclaim_pending(
    redis: Any,
    *,
    consumer: str,
    idle_ms: int,
    count: int = 10,
) -> list[tuple[str, dict[str, str]]]:
    """
    Забрать зависшие в PEL сообщения (ретраи).
    Возвращает [(msg_id, fields), ...].
    """
    stream = integrations_stream_key()
    group = integrations_group_name()
    try:
        claim_result = await redis.xautoclaim(
            name=stream,
            groupname=group,
            consumername=consumer,
            min_idle_time=idle_ms,
            start_id="0-0",
            count=count,
        )
    except ResponseError as exc:
        log.warning("integrations_stream: XAUTOCLAIM failed: %s", exc)
        return []

    # redis-py: [next_start, [(id, {fields}), ...]]
    if not claim_result or len(claim_result) < 2:
        return []
    messages = claim_result[1]
    if not messages:
        return []
    result: list[tuple[str, dict[str, str]]] = []
    for item in messages:
        if not item or len(item) < 2:
            continue
        msg_id, fields = item[0], item[1]
        if isinstance(fields, dict):
            result.append((str(msg_id), {str(k): str(v) for k, v in fields.items()}))
    return result


def decode_meta_webhook_body(fields: dict[str, str]) -> bytes | None:
    b64 = fields.get("body")
    if not b64:
        return None
    try:
        return base64.b64decode(b64.encode("ascii") if isinstance(b64, str) else b64)
    except Exception:
        return None
