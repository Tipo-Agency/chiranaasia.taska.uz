"""
Consumer group для доменных событий: построение уведомлений вне HTTP (см. DOMAIN_EVENTS_HUB_ASYNC).

Stream: ``REDIS_EVENTS_STREAM`` (по умолчанию ``queue.domain.v1``).
Группа: ``REDIS_DOMAIN_EVENTS_HUB_GROUP`` (по умолчанию ``notification_hub``).

XGROUP CREATE с id ``$`` — в группу попадают только записи, появившиеся после создания группы
(без повторной обработки истории sync-эпохи).
"""
from __future__ import annotations

import logging
from typing import Any

from redis.exceptions import ResponseError

from app.core.config import get_settings

log = logging.getLogger("uvicorn.error")


def domain_events_stream_key() -> str:
    return get_settings().REDIS_EVENTS_STREAM


def domain_events_hub_group_name() -> str:
    return get_settings().REDIS_DOMAIN_EVENTS_HUB_GROUP


async def ensure_domain_events_hub_consumer_group(redis: Any) -> None:
    stream = domain_events_stream_key()
    group = domain_events_hub_group_name()
    try:
        await redis.xgroup_create(stream, group, id="$", mkstream=True)
        log.info("domain_events_hub_stream: created group %s on %s (from $)", group, stream)
    except ResponseError as exc:
        err = str(exc)
        if "BUSYGROUP" in err or "already exists" in err.lower():
            return
        raise


async def domain_events_hub_xack(redis: Any, stream: str, group: str, message_id: str) -> None:
    await redis.xack(stream, group, message_id)


async def xreadgroup_domain_hub_new(
    redis: Any,
    *,
    consumer: str,
    block_ms: int = 5000,
    count: int = 10,
) -> list[tuple[str, dict[str, str]]]:
    stream = domain_events_stream_key()
    group = domain_events_hub_group_name()
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


async def xautoclaim_domain_hub_pending(
    redis: Any,
    *,
    consumer: str,
    idle_ms: int,
    count: int = 10,
) -> list[tuple[str, dict[str, str]]]:
    stream = domain_events_stream_key()
    group = domain_events_hub_group_name()
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
        log.warning("domain_events_hub_stream: XAUTOCLAIM failed: %s", exc)
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
