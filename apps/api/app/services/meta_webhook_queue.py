"""Проверка подписи Meta + постановка в Redis Stream интеграций (``REDIS_INTEGRATIONS_STREAM``)."""
from __future__ import annotations

import json
import logging
from typing import Any

from app.core.redis import get_redis_client
from app.core.secret_compare import compare_hex_hmac_sha256
from app.services.integrations_stream import ensure_integrations_stream, xadd_meta_webhook_job

log = logging.getLogger("uvicorn.error")


def verify_meta_webhook_signature(
    app_secret: str,
    raw_body: bytes,
    signature_header: str | None,
) -> bool:
    """
    Meta: заголовок ``X-Hub-Signature-256: sha256=<hex>``, HMAC-SHA256(raw_body, app_secret).
    """
    if not app_secret or not signature_header:
        return False
    sig = signature_header.strip()
    prefix = "sha256="
    if not sig.startswith(prefix):
        return False
    want_hex = sig[len(prefix) : :].strip().lower()
    if len(want_hex) != 64:
        return False
    return compare_hex_hmac_sha256(want_hex, raw_body, app_secret)


async def push_meta_webhook_from_api(raw_body: bytes) -> tuple[bool, str | None]:
    """
    XADD в stream интеграций (consumer group читает во воркере).
    """
    redis = await get_redis_client()
    if redis is None:
        return False, "redis_unavailable"
    try:
        await ensure_integrations_stream(redis)
        await xadd_meta_webhook_job(redis, raw_body)
        return True, None
    except Exception as exc:
        log.warning("meta_webhook_queue: XADD failed: %s", exc)
        return False, "redis_enqueue_failed"


def parse_meta_webhook_json(raw_body: bytes) -> dict[str, Any] | None:
    try:
        data = json.loads(raw_body.decode("utf-8") or "{}")
    except (json.JSONDecodeError, UnicodeDecodeError):
        return None
    return data if isinstance(data, dict) else None
