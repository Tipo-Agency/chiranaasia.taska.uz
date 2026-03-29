"""Meta (Messenger / Instagram) webhooks: subscription verify + event sink."""

import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.services.meta_instagram import process_instagram_webhook

router = APIRouter(tags=["meta-webhook"])
log = logging.getLogger("uvicorn.error")


@router.get("/webhook/meta")
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


@router.post("/webhook/meta")
async def meta_receive_events(request: Request, db: AsyncSession = Depends(get_db)):
    """Входящие события Meta: создание/обновление сделки и комментариев."""
    settings = get_settings()
    raw = await request.body()
    try:
        body = json.loads(raw.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        log.warning("meta webhook: не JSON")
        return {"status": "ok", "processed": 0}
    if not isinstance(body, dict):
        return {"status": "ok", "processed": 0}
    if settings.META_WEBHOOK_LOG_BODY:
        log.warning("meta webhook RAW body: %s", raw.decode("utf-8", errors="replace")[:20000])
    n = 0
    try:
        n = await process_instagram_webhook(db, body)
        await db.commit()
        if n:
            log.info("meta webhook: commit ok, обработано сообщений: %s", n)
        else:
            log.warning(
                "meta webhook: commit ok, но обработано 0 сообщений — смотрите логи выше "
                "(object/entry/messaging). Для полного тела: META_WEBHOOK_LOG_BODY=1 на сервере."
            )
    except Exception:
        await db.rollback()
        log.exception("meta webhook processing failed")
    return {"status": "ok", "processed": n}
