"""OAuth2 к Gmail: authorize + callback. Секреты — Fernet в БД (refresh token)."""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.config import effective_browser_origin_allowlist, get_settings
from app.db import get_db
from app.models.user import User
from app.schemas.common_responses import OkResponse
from app.schemas.mail_integration import MailOAuthAuthorizeResponse, MailOAuthStatusResponse
from app.services.mail_google import (
    delete_google_row,
    exchange_code_for_tokens,
    fetch_google_user_email,
    get_google_row,
    google_authorize_url,
    upsert_google_account,
)
from app.services.mail_oauth_state import create_mail_oauth_state, parse_mail_oauth_state

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/integrations/mail", tags=["integrations-mail"])


def _frontend_redirect(query_suffix: str) -> RedirectResponse:
    s = get_settings()
    origins = effective_browser_origin_allowlist(s.CORS_ORIGINS, s.PUBLIC_BASE_URL)
    base = (origins[0] if origins else "http://localhost:3000").rstrip("/")
    path = (s.MAIL_OAUTH_FRONTEND_PATH or "/settings?tab=profile").strip()
    if not path.startswith("/"):
        path = "/" + path
    url = f"{base}{path}"
    q = query_suffix.strip().lstrip("&?")
    if q:
        url += ("&" if "?" in url else "?") + q
    return RedirectResponse(url, status_code=302)


@router.get("/status", response_model=MailOAuthStatusResponse)
async def mail_oauth_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    s = get_settings()
    configured = bool((s.GOOGLE_OAUTH_CLIENT_ID or "").strip() and (s.GOOGLE_OAUTH_CLIENT_SECRET or "").strip())
    row = await get_google_row(db, current_user.id)
    return MailOAuthStatusResponse(
        configured=configured,
        connected=row is not None,
        provider="google" if row else None,
        accountEmail=row.account_email if row else None,
    )


@router.get("/google/authorize", response_model=MailOAuthAuthorizeResponse)
async def mail_google_authorize(current_user: User = Depends(get_current_user)):
    s = get_settings()
    if not (s.GOOGLE_OAUTH_CLIENT_ID or "").strip() or not (s.GOOGLE_OAUTH_CLIENT_SECRET or "").strip():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="google_oauth_not_configured",
        )
    try:
        st = create_mail_oauth_state(current_user.id)
        url = google_authorize_url(st)
    except ValueError as e:
        if str(e) == "google_oauth_not_configured":
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="google_oauth_not_configured")
        raise
    return MailOAuthAuthorizeResponse(url=url)


@router.get("/google/callback")
async def mail_google_callback(
    request: Request,
    db: AsyncSession = Depends(get_db),
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
):
    _ = request
    if error:
        return _frontend_redirect(f"mail_error={error}")
    if not code or not state:
        return _frontend_redirect("mail_error=missing_code")
    uid = parse_mail_oauth_state(state)
    if not uid:
        return _frontend_redirect("mail_error=invalid_state")
    try:
        tokens = await exchange_code_for_tokens(code)
    except Exception as e:
        logger.warning("gmail token exchange failed: %s", e)
        return _frontend_redirect("mail_error=token_exchange")
    at = str(tokens.get("access_token") or "")
    rt = str(tokens.get("refresh_token") or "")
    exp_in = int(tokens.get("expires_in") or 3600)
    if not at:
        return _frontend_redirect("mail_error=no_access_token")
    try:
        email = await fetch_google_user_email(at)
    except Exception as e:
        logger.warning("gmail userinfo failed: %s", e)
        return _frontend_redirect("mail_error=userinfo")
    if not email:
        return _frontend_redirect("mail_error=no_email")
    try:
        await upsert_google_account(db, uid, email, rt, at, exp_in)
        await db.commit()
    except ValueError:
        await db.rollback()
        return _frontend_redirect("mail_error=upsert_failed")
    except Exception as e:
        await db.rollback()
        logger.exception("gmail save account: %s", e)
        return _frontend_redirect("mail_error=save")
    return _frontend_redirect("mail_connected=1")


@router.delete("/connection", response_model=OkResponse)
async def mail_disconnect(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await delete_google_row(db, current_user.id)
    await db.commit()
    return OkResponse()
