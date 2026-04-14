"""Redis-backed event bus helpers for domain events."""
from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any

from app.core.config import get_settings
from app.core.redis import get_redis_client

logger = logging.getLogger(__name__)


def _serialize_event(event: dict[str, Any]) -> dict[str, str]:
    """Serialize event fields for Redis stream payload."""
    payload: dict[str, str] = {}
    for key, value in event.items():
        if isinstance(value, dict | list):
            payload[key] = json.dumps(value, ensure_ascii=False)
        elif isinstance(value, datetime):
            payload[key] = value.isoformat()
        elif value is None:
            payload[key] = ""
        else:
            payload[key] = str(value)
    return payload


def deserialize_domain_event_fields(fields: dict[str, str]) -> dict[str, Any]:
    """Обратно к виду, ожидаемому ``process_domain_event`` (после ``_serialize_event`` / XADD)."""
    out: dict[str, Any] = {}
    for key, raw in fields.items():
        if raw == "":
            out[key] = None
            continue
        if raw.startswith("{") or raw.startswith("["):
            try:
                out[key] = json.loads(raw)
                continue
            except json.JSONDecodeError:
                pass
        if key == "occurredAt":
            try:
                out[key] = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            except ValueError:
                out[key] = raw
        else:
            out[key] = raw
    return out


async def ensure_redis_stream_and_group() -> None:
    """
    Создаёт Redis Stream для доменных событий и consumer group (для будущих воркеров / мониторинга).
    Без Redis приложение работает: события пишутся в Postgres и обрабатываются синхронно.
    """
    settings = get_settings()
    redis = await get_redis_client()
    if redis is None:
        logger.warning("Redis недоступен: события только в БД, без stream.")
        return
    name = settings.REDIS_EVENTS_STREAM
    group = "taska_domain_events"
    try:
        await redis.xgroup_create(name, group, id="0", mkstream=True)
        logger.info("Redis stream %s + group %s OK", name, group)
    except Exception as exc:
        err = str(exc)
        if "BUSYGROUP" in err or "already exists" in err.lower():
            return
        logger.warning("Redis xgroup_create: %s", exc)


async def publish_domain_event(event: dict[str, Any]) -> tuple[bool, str | None]:
    """
    Publish canonical event to Redis stream.
    Returns: (published, stream_id)
    """
    settings = get_settings()
    redis = await get_redis_client()
    if redis is None:
        return False, None
    try:
        stream_id = await redis.xadd(
            settings.REDIS_EVENTS_STREAM,
            _serialize_event(event),
            maxlen=100000,
            approximate=True,
        )
        return True, stream_id
    except Exception as exc:
        logger.error("Redis xadd failed for event %s: %s", event.get("id"), exc)
        return False, None
