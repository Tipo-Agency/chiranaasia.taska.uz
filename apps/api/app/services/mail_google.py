"""Google OAuth + Gmail API (чтение списка, отправка)."""
from __future__ import annotations

import base64
import uuid
from datetime import UTC, datetime
from email.message import EmailMessage
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.user_mail_oauth import UserMailOAuthAccount
from app.services.http_client import async_http_client
from app.services.fernet_secrets import decrypt_secret, encrypt_secret

PROVIDER_GOOGLE = "google"

# Чтение ящика + отправка от имени пользователя
GMAIL_SCOPES = " ".join(
    [
        "openid",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/gmail.send",
    ]
)


def _now_iso() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def google_redirect_uri() -> str:
    s = get_settings()
    base = (s.API_PUBLIC_BASE_URL or "").strip().rstrip("/")
    if not base:
        base = (s.PUBLIC_BASE_URL or "").strip().rstrip("/")
    if not base:
        base = "http://127.0.0.1:8000"
    p = (s.API_PREFIX or "/api").strip() or "/api"
    if not p.startswith("/"):
        p = "/" + p
    return f"{base}{p}/integrations/mail/google/callback"


def google_authorize_url(state: str) -> str:
    s = get_settings()
    cid = (s.GOOGLE_OAUTH_CLIENT_ID or "").strip()
    if not cid:
        raise ValueError("google_oauth_not_configured")
    from urllib.parse import urlencode

    q = {
        "client_id": cid,
        "redirect_uri": google_redirect_uri(),
        "response_type": "code",
        "scope": GMAIL_SCOPES,
        "access_type": "offline",
        "prompt": "consent",
        "include_granted_scopes": "true",
        "state": state,
    }
    return "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(q)


async def exchange_code_for_tokens(code: str) -> dict[str, Any]:
    s = get_settings()
    sec = (s.GOOGLE_OAUTH_CLIENT_SECRET or "").strip()
    cid = (s.GOOGLE_OAUTH_CLIENT_ID or "").strip()
    if not cid or not sec:
        raise ValueError("google_oauth_not_configured")
    body = {
        "code": code,
        "client_id": cid,
        "client_secret": sec,
        "redirect_uri": google_redirect_uri(),
        "grant_type": "authorization_code",
    }
    async with async_http_client() as client:
        r = await client.post("https://oauth2.googleapis.com/token", data=body)
        r.raise_for_status()
        return r.json()


async def fetch_google_user_email(access_token: str) -> str:
    async with async_http_client() as client:
        r = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        r.raise_for_status()
        data = r.json()
        return str(data.get("email") or "").strip()[:320]


async def refresh_access_token(refresh_token_plain: str) -> dict[str, Any]:
    s = get_settings()
    body = {
        "client_id": (s.GOOGLE_OAUTH_CLIENT_ID or "").strip(),
        "client_secret": (s.GOOGLE_OAUTH_CLIENT_SECRET or "").strip(),
        "refresh_token": refresh_token_plain,
        "grant_type": "refresh_token",
    }
    async with async_http_client() as client:
        r = await client.post("https://oauth2.googleapis.com/token", data=body)
        r.raise_for_status()
        return r.json()


async def get_valid_access_token(db: AsyncSession, row: UserMailOAuthAccount) -> str:
    """Возвращает access_token, при необходимости обновляя по refresh_token."""
    now = time_int()
    exp = _parse_exp(row.token_expires_at)
    if row.access_token_encrypted and exp and exp > now + 60:
        return decrypt_secret(row.access_token_encrypted)

    rt = decrypt_secret(row.refresh_token_encrypted)
    if not rt:
        raise ValueError("mail_refresh_token_missing")
    data = await refresh_access_token(rt)
    at = str(data.get("access_token") or "")
    if not at:
        raise ValueError("mail_token_refresh_failed")
    expires_in = int(data.get("expires_in") or 3600)
    row.access_token_encrypted = encrypt_secret(at)
    row.token_expires_at = str(now + expires_in)
    row.updated_at = _now_iso()
    await db.flush()
    return at


def time_int() -> int:
    return int(datetime.now(UTC).timestamp())


def _parse_exp(raw: str | None) -> int | None:
    if not raw:
        return None
    try:
        return int(str(raw).strip())
    except ValueError:
        return None


async def upsert_google_account(
    db: AsyncSession,
    user_id: str,
    account_email: str,
    refresh_token: str,
    access_token: str,
    expires_in: int,
) -> UserMailOAuthAccount:
    if not refresh_token or not str(refresh_token).strip():
        raise ValueError("google_no_refresh_token")
    now = time_int()
    res = await db.execute(
        select(UserMailOAuthAccount).where(
            UserMailOAuthAccount.user_id == user_id,
            UserMailOAuthAccount.provider == PROVIDER_GOOGLE,
        )
    )
    row = res.scalar_one_or_none()
    if row is None:
        row = UserMailOAuthAccount(
            id=str(uuid.uuid4()),
            user_id=user_id,
            provider=PROVIDER_GOOGLE,
            account_email=account_email[:320],
            refresh_token_encrypted=encrypt_secret(refresh_token),
            access_token_encrypted=encrypt_secret(access_token) if access_token else None,
            token_expires_at=str(now + int(expires_in or 3600)),
            scopes=GMAIL_SCOPES,
            created_at=_now_iso(),
            updated_at=_now_iso(),
        )
        db.add(row)
    else:
        row.account_email = account_email[:320]
        if refresh_token and str(refresh_token).strip():
            row.refresh_token_encrypted = encrypt_secret(refresh_token)
        row.access_token_encrypted = encrypt_secret(access_token) if access_token else None
        row.token_expires_at = str(now + int(expires_in or 3600))
        row.scopes = GMAIL_SCOPES
        row.updated_at = _now_iso()
    await db.flush()
    return row


async def get_google_row(db: AsyncSession, user_id: str) -> UserMailOAuthAccount | None:
    res = await db.execute(
        select(UserMailOAuthAccount).where(
            UserMailOAuthAccount.user_id == user_id,
            UserMailOAuthAccount.provider == PROVIDER_GOOGLE,
        )
    )
    return res.scalar_one_or_none()


async def delete_google_row(db: AsyncSession, user_id: str) -> bool:
    row = await get_google_row(db, user_id)
    if not row:
        return False
    await db.delete(row)
    await db.flush()
    return True


async def _gmail_get_message_meta(*, token: str, message_id: str) -> dict[str, Any]:
    params = [
        ("format", "metadata"),
        ("metadataHeaders", "From"),
        ("metadataHeaders", "To"),
        ("metadataHeaders", "Subject"),
        ("metadataHeaders", "Date"),
    ]
    async with async_http_client() as client:
        r = await client.get(
            f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{message_id}",
            params=params,
            headers={"Authorization": f"Bearer {token}"},
        )
        r.raise_for_status()
        d = r.json()
    subj = ""
    from_ = ""
    date_ = ""
    snippet = str(d.get("snippet") or "")
    pl = d.get("payload")
    if isinstance(pl, dict):
        headers = pl.get("headers")
        if isinstance(headers, list):
            for h in headers:
                if not isinstance(h, dict):
                    continue
                n = (h.get("name") or "").lower()
                v = str(h.get("value") or "")
                if n == "subject":
                    subj = v
                elif n == "from":
                    from_ = v
                elif n == "date":
                    date_ = v
    return {
        "id": message_id,
        "threadId": str(d.get("threadId") or ""),
        "subject": subj,
        "from": from_,
        "date": date_,
        "snippet": snippet,
    }


async def list_gmail_messages(
    db: AsyncSession,
    user_id: str,
    *,
    max_results: int = 20,
) -> list[dict[str, Any]]:
    row = await get_google_row(db, user_id)
    if not row:
        raise ValueError("mail_not_connected")
    token = await get_valid_access_token(db, row)
    params: dict[str, str | int] = {"maxResults": min(max(1, max_results), 50)}
    async with async_http_client() as client:
        r = await client.get(
            "https://gmail.googleapis.com/gmail/v1/users/me/messages",
            params=params,
            headers={"Authorization": f"Bearer {token}"},
        )
        r.raise_for_status()
        data = r.json()
    messages = data.get("messages") or []
    if not isinstance(messages, list) or not messages:
        return []

    out: list[dict[str, Any]] = []
    for m in messages[:max_results]:
        if not isinstance(m, dict):
            continue
        mid = str(m.get("id") or "")
        if not mid:
            continue
        meta = await _gmail_get_message_meta(token=token, message_id=mid)
        out.append(meta)
    return out


async def send_gmail_message(
    db: AsyncSession,
    user_id: str,
    *,
    to: str,
    subject: str,
    body_text: str,
) -> dict[str, str]:
    row = await get_google_row(db, user_id)
    if not row:
        raise ValueError("mail_not_connected")
    token = await get_valid_access_token(db, row)
    from_addr = row.account_email or ""
    if not from_addr:
        raise ValueError("mail_account_email_missing")

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = to
    msg.set_content(body_text or "")

    raw_bytes = msg.as_bytes()
    raw = base64.urlsafe_b64encode(raw_bytes).decode().rstrip("=")

    async with async_http_client() as client:
        r = await client.post(
            "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json={"raw": raw},
        )
        r.raise_for_status()
        d = r.json()
    return {"id": str(d.get("id") or ""), "threadId": str(d.get("threadId") or "")}
