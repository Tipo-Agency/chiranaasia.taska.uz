"""
Очередь доставки уведомлений: Redis Stream из ``REDIS_NOTIFICATIONS_STREAM`` (дефолт ``queue.notifications.v1``) + group ``notifications``.

- XADD при создании уведомления (payload: ``notification_id``).
- XREADGROUP / XAUTOCLAIM во воркере, XACK когда по уведомлению не осталось срочной работы.
"""
from __future__ import annotations

import logging
from typing import Any

from redis.exceptions import ResponseError

from app.core.config import get_settings

log = logging.getLogger("uvicorn.error")


def notifications_stream_key() -> str:
    return get_settings().REDIS_NOTIFICATIONS_STREAM


def notifications_group_name() -> str:
    return get_settings().REDIS_NOTIFICATIONS_GROUP


async def ensure_notifications_stream(redis: Any) -> None:
    """XGROUP CREATE … MKSTREAM (идемпотентно)."""
    stream = notifications_stream_key()
    group = notifications_group_name()
    try:
        await redis.xgroup_create(stream, group, id="0", mkstream=True)
        log.info("notifications_stream: created %s group=%s", stream, group)
    except ResponseError as exc:
        err = str(exc)
        if "BUSYGROUP" in err or "already exists" in err.lower():
            return
        raise


async def xadd_notification_job(redis: Any, notification_id: str) -> str:
    """Поставить задачу обработать доставки для уведомления. Возвращает id записи в stream."""
    stream = notifications_stream_key()
    msg_id: str = await redis.xadd(
        stream,
        {"notification_id": str(notification_id)},
        maxlen=100_000,
        approximate=True,
    )
    return msg_id


async def notifications_xack(redis: Any, stream: str, group: str, message_id: str) -> None:
    await redis.xack(stream, group, message_id)


async def xreadgroup_notifications_new(
    redis: Any,
    *,
    consumer: str,
    block_ms: int = 5000,
    count: int = 10,
) -> list[tuple[str, dict[str, str]]]:
    stream = notifications_stream_key()
    group = notifications_group_name()
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


async def xautoclaim_notifications_pending(
    redis: Any,
    *,
    consumer: str,
    idle_ms: int,
    count: int = 10,
) -> list[tuple[str, dict[str, str]]]:
    stream = notifications_stream_key()
    group = notifications_group_name()
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
        log.warning("notifications_stream: XAUTOCLAIM failed: %s", exc)
        return []

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
