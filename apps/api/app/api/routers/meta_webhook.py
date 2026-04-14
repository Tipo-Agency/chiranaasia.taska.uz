"""Meta (Messenger / Instagram) webhooks: subscription verify + быстрый приём в Redis."""
from __future__ import annotations

import hashlib
import logging

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import JSONResponse, PlainTextResponse

from app.core.config import get_settings
from app.core.redis import get_redis_client, redis_key
from app.schemas.meta_webhook import MetaWebhookJsonResponse
from app.services.meta_webhook_queue import (
    parse_meta_webhook_json,
    push_meta_webhook_from_api,
    verify_meta_webhook_signature,
)

router = APIRouter(tags=["meta-webhook"])
log = logging.getLogger("uvicorn.error")


@router.get("/webhook/meta", response_class=PlainTextResponse)
async def meta_verify_subscription(
    hub_mode: str | None = Query(None, alias="hub.mode"),
    hub_verify_token: str | None = Query(None, alias="hub.verify_token"),
    hub_challenge: str | None = Query(None, alias="hub.challenge"),
):
    """Meta GET: echo hub.challenge when verify token matches (Messenger API Settings)."""
    settings = get_settings()
    if hub_mode != "subscribe":
        raise HTTPException(status_code=403, detail="Forbidden")
    if not settings.META_MARKER:
        log.warning("META_MARKER is not set; webhook verify disabled")
        raise HTTPException(status_code=503, detail="Webhook verify token not configured")
    if not hub_verify_token or hub_verify_token != settings.META_MARKER:
        raise HTTPException(status_code=403, detail="Forbidden")
    if not hub_challenge:
        raise HTTPException(status_code=400, detail="Missing hub.challenge")
    return PlainTextResponse(content=hub_challenge)


@router.post("/webhook/meta", response_model=MetaWebhookJsonResponse)
async def meta_receive_events(request: Request):
    """
    Подпись X-Hub-Signature-256, затем RPUSH в Redis и сразу 200.
    Разбор сделок — в ``integrations_worker`` (не блокирует HTTP).
    """
    settings = get_settings()
    raw = await request.body()

    if settings.META_WEBHOOK_VERIFY_SIGNATURE:
        secret = (settings.META_APP_SECRET or "").strip()
        if not secret:
            log.warning("meta webhook: META_WEBHOOK_VERIFY_SIGNATURE on but META_APP_SECRET empty")
            return JSONResponse(
                status_code=503,
                content=MetaWebhookJsonResponse(
                    status="error",
                    detail="meta_app_secret_not_configured",
                ).model_dump(mode="json"),
            )
        sig_header = request.headers.get("X-Hub-Signature-256")
        if not verify_meta_webhook_signature(secret, raw, sig_header):
            log.warning("meta webhook: invalid or missing X-Hub-Signature-256")
            return JSONResponse(
                status_code=403,
                content=MetaWebhookJsonResponse(
                    status="error",
                    detail="invalid_signature",
                ).model_dump(mode="json"),
            )

    if settings.META_WEBHOOK_LOG_BODY:
        log.warning("meta webhook RAW body: %s", raw.decode("utf-8", errors="replace")[:20000])

    if parse_meta_webhook_json(raw) is None:
        return JSONResponse(
            status_code=400,
            content=MetaWebhookJsonResponse(status="error", detail="invalid_json").model_dump(mode="json"),
        )

    redis = await get_redis_client()
    if redis is not None:
        try:
            digest = hashlib.sha256(raw).hexdigest()
            dedup_key = redis_key("webhook", "meta", "dedup", digest)
            inserted = await redis.set(dedup_key, "1", ex=600, nx=True)
            if inserted is not True:
                return JSONResponse(
                    status_code=200,
                    content=MetaWebhookJsonResponse(
                        status="ok",
                        queued=False,
                        deduplicated=True,
                    ).model_dump(mode="json"),
                )
        except Exception as exc:
            log.warning("meta webhook: dedup check failed (proceeding): %s", exc)

    ok, err = await push_meta_webhook_from_api(raw)
    if not ok:
        return JSONResponse(
            status_code=503,
            content=MetaWebhookJsonResponse(
                status="error",
                detail=err or "queue_failed",
            ).model_dump(mode="json"),
        )

    return JSONResponse(
        status_code=200,
        content=MetaWebhookJsonResponse(status="ok", queued=True).model_dump(mode="json"),
    )
