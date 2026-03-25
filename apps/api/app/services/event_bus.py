"""Redis-backed event bus helpers for domain events."""
from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any

from app.config import get_settings

logger = logging.getLogger(__name__)

_redis_client = None


async def _get_redis():
    """Lazy-init Redis client to avoid hard failure on import."""
    global _redis_client
    if _redis_client is not None:
        return _redis_client
    try:
        from redis.asyncio import Redis  # type: ignore

        settings = get_settings()
        _redis_client = Redis.from_url(settings.REDIS_URL, decode_responses=True)
        return _redis_client
    except Exception as exc:
        logger.warning("Redis init failed: %s", exc)
        return None


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


async def publish_domain_event(event: dict[str, Any]) -> tuple[bool, str | None]:
    """
    Publish canonical event to Redis stream.
    Returns: (published, stream_id)
    """
    settings = get_settings()
    redis = await _get_redis()
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
