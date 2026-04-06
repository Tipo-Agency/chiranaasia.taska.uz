"""Telegram funnel webhooks: register with Bot API, receive updates over HTTPS."""

from __future__ import annotations

import json
import logging
import secrets
from typing import Any

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user_admin
from app.config import get_settings
from app.database import get_db
from app.models.funnel import SalesFunnel
from app.services.telegram_leads import process_telegram_update_dict, telegram_source_config

log = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/integrations/telegram", tags=["integrations-telegram"])


def _webhook_url(settings, funnel_id: str) -> str:
    base = (settings.PUBLIC_BASE_URL or "").strip().rstrip("/")
    prefix = (settings.API_PREFIX or "/api").strip()
    if not prefix.startswith("/"):
        prefix = "/" + prefix
    return f"{base}{prefix}/integrations/telegram/webhook/{funnel_id}"


async def _call_telegram(token: str, method: str, data: dict[str, Any]) -> dict[str, Any]:
    url = f"https://api.telegram.org/bot{token}/{method}"
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post(url, data=data)
    try:
        return r.json()
    except Exception:
        return {"ok": False, "description": r.text[:500]}


@router.post("/webhook/{funnel_id}")
async def telegram_funnel_webhook(
    funnel_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    x_telegram_bot_api_secret_token: str | None = Header(None, alias="X-Telegram-Bot-Api-Secret-Token"),
):
    """Inbound Telegram updates for a funnel (HTTPS webhook). Verified via secret_token."""
    funnel = await db.get(SalesFunnel, funnel_id)
    if not funnel:
        raise HTTPException(status_code=404, detail="funnel_not_found")

    cfg = telegram_source_config(funnel)
    if not cfg or cfg.get("enabled") is not True:
        raise HTTPException(status_code=404, detail="telegram_disabled")

    expected = str(cfg.get("webhookSecret") or "").strip()
    if not expected:
        raise HTTPException(status_code=404, detail="webhook_not_configured")

    got = str(x_telegram_bot_api_secret_token or "").strip()
    if not got or got != expected:
        raise HTTPException(status_code=403, detail="invalid_secret")

    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="invalid_json") from None

    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="invalid_update")

    try:
        n = await process_telegram_update_dict(
            db,
            funnel,
            body,
            event_source="telegram-webhook",
        )
        await db.commit()
    except Exception as exc:
        log.warning("telegram webhook funnel=%s: %s", funnel_id, exc)
        await db.rollback()
        raise HTTPException(status_code=500, detail="processing_failed") from exc

    return {"ok": True, "processed": n}


@router.post("/webhook/register")
async def register_telegram_webhook(
    body: dict,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(get_current_user_admin),
):
    """Generate secret_token, call setWebhook, save funnel.sources.telegram (useWebhook=true)."""
    settings = get_settings()
    base = (settings.PUBLIC_BASE_URL or "").strip().rstrip("/")
    if not base:
        raise HTTPException(status_code=400, detail="PUBLIC_BASE_URL_not_configured")

    funnel_id = str(body.get("funnelId") or "").strip()
    if not funnel_id:
        raise HTTPException(status_code=400, detail="funnelId_required")

    funnel = await db.get(SalesFunnel, funnel_id)
    if not funnel:
        raise HTTPException(status_code=404, detail="funnel_not_found")

    cfg = telegram_source_config(funnel)
    if not cfg or cfg.get("enabled") is not True:
        raise HTTPException(status_code=400, detail="telegram_not_enabled")

    token = str(cfg.get("botToken") or "").strip()
    if not token:
        raise HTTPException(status_code=400, detail="bot_token_missing")

    sources = dict(funnel.sources or {})
    tg = dict(sources.get("telegram") or {})

    secret = str(tg.get("webhookSecret") or "").strip()
    if not secret:
        secret = secrets.token_urlsafe(32)[:64]

    wurl = _webhook_url(settings, funnel_id)
    payload = {
        "url": wurl,
        "secret_token": secret,
        "allowed_updates": json.dumps(["message"]),
    }
    data = await _call_telegram(token, "setWebhook", payload)
    if not (isinstance(data, dict) and data.get("ok") is True):
        desc = (data or {}).get("description") if isinstance(data, dict) else None
        raise HTTPException(
            status_code=502,
            detail=f"telegram_setWebhook_failed:{desc or json.dumps(data) if data is not None else 'unknown'}",
        )

    tg["webhookSecret"] = secret
    tg["useWebhook"] = True
    tg["webhookRegistered"] = True
    sources["telegram"] = tg
    funnel.sources = sources

    await db.commit()
    await db.refresh(funnel)

    return {"ok": True, "webhookUrl": wurl, "webhookRegistered": True}


@router.post("/webhook/unregister")
async def unregister_telegram_webhook(
    body: dict,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(get_current_user_admin),
):
    """deleteWebhook and turn off useWebhook for the funnel."""
    funnel_id = str(body.get("funnelId") or "").strip()
    if not funnel_id:
        raise HTTPException(status_code=400, detail="funnelId_required")

    funnel = await db.get(SalesFunnel, funnel_id)
    if not funnel:
        raise HTTPException(status_code=404, detail="funnel_not_found")

    cfg = telegram_source_config(funnel)
    token = str((cfg or {}).get("botToken") or "").strip()
    if token:
        await _call_telegram(token, "deleteWebhook", {})

    sources = dict(funnel.sources or {})
    tg = dict(sources.get("telegram") or {})
    tg.pop("webhookSecret", None)
    tg["useWebhook"] = False
    tg["webhookRegistered"] = False
    sources["telegram"] = tg
    funnel.sources = sources

    await db.commit()
    return {"ok": True, "webhookRegistered": False}


@router.get("/webhook/status")
async def telegram_webhook_status(
    funnelId: str,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(get_current_user_admin),
):
    """Lightweight status for UI (no secrets)."""
    settings = get_settings()
    funnel = await db.get(SalesFunnel, funnelId)
    if not funnel:
        raise HTTPException(status_code=404, detail="funnel_not_found")
    cfg = telegram_source_config(funnel)
    has_secret = bool(cfg and str(cfg.get("webhookSecret") or "").strip())
    return {
        "ok": True,
        "funnelId": funnelId,
        "webhookUrl": _webhook_url(settings, funnelId) if (settings.PUBLIC_BASE_URL or "").strip() else "",
        "webhookRegistered": bool(cfg and cfg.get("webhookRegistered")),
        "useWebhook": bool(cfg and cfg.get("useWebhook")),
        "webhookSecretSet": has_secret,
    }
