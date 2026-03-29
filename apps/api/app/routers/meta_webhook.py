"""Meta (Messenger / Instagram) webhooks: subscription verify + event sink."""

import logging

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse

from app.config import get_settings

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
async def meta_receive_events(request: Request):
    """Meta POST: acknowledge payload; processing is added when messaging is wired."""
    await request.body()
    return {"status": "ok"}
