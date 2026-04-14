"""
Отправка сообщений через Telegram Bot API (sendMessage).

Используется воркером уведомлений (очередь Redis Stream → ``notification_delivery``).
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.services.http_client import async_http_client
from app.models.funnel import SalesFunnel
from app.services.notifications import load_user_and_notification_pref_row
from app.services.telegram_leads import telegram_source_config

_MIN_RETRY_AFTER = 1
_MAX_RETRY_AFTER = 3600


@dataclass(frozen=True)
class TelegramSendResult:
    ok: bool
    error: str | None = None
    # 429 / flood: выставить retry_after_seconds (секунды до следующей попытки)
    rate_limited: bool = False
    retry_after_seconds: int | None = None
    http_status: int | None = None
    telegram_error_code: int | None = None


def _clamp_retry_after(raw: Any) -> int:
    try:
        sec = int(float(raw))
    except (TypeError, ValueError):
        sec = 30
    return max(_MIN_RETRY_AFTER, min(sec, _MAX_RETRY_AFTER))


def _retry_after_from_telegram_json(data: dict[str, Any]) -> int | None:
    if data.get("error_code") != 429:
        return None
    params = data.get("parameters")
    if isinstance(params, dict):
        ra = params.get("retry_after")
        if ra is not None:
            return _clamp_retry_after(ra)
    desc = str(data.get("description") or "")
    # «Too Many Requests: retry after N»
    if "retry after" in desc.lower():
        parts = desc.lower().split("retry after", 1)
        if len(parts) > 1:
            tail = parts[1].strip().split()
            if tail:
                return _clamp_retry_after(tail[0])
    return 60


def _retry_after_from_headers(headers: httpx.Headers) -> int | None:
    raw = headers.get("retry-after")
    if not raw:
        return None
    return _clamp_retry_after(raw)


async def resolve_notification_telegram_bot_token(db: AsyncSession, user_id: str) -> str | None:
    """
    Токен бота для push-уведомлений: сначала воронка из ``notification_prefs.default_funnel_id``
    (расшифрованный ``botToken`` при включённом Telegram), иначе fallback ``TELEGRAM_BOT_TOKEN``.
    """
    _user, pref_row = await load_user_and_notification_pref_row(db, user_id)
    funnel_id = (pref_row.default_funnel_id or "").strip() if pref_row else ""
    if funnel_id:
        funnel = await db.get(SalesFunnel, funnel_id)
        if funnel:
            cfg = telegram_source_config(funnel)
            if cfg and cfg.get("enabled") is not False:
                token = str(cfg.get("botToken") or "").strip()
                if token:
                    return token
    env_tok = (get_settings().TELEGRAM_BOT_TOKEN or "").strip()
    return env_tok or None


async def send_telegram_message(
    bot_token: str,
    chat_id: str,
    text: str,
    *,
    parse_mode: str | None = None,
    timeout_sec: float = 20.0,
) -> TelegramSendResult:
    """
    POST sendMessage. Обрабатывает HTTP 429, тело с ``error_code`` / ``parameters.retry_after``,
    прочие ошибки API и сетевые сбои.
    """
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    form: dict[str, str] = {"chat_id": str(chat_id), "text": text}
    if parse_mode:
        form["parse_mode"] = parse_mode

    try:
        async with async_http_client(timeout=httpx.Timeout(timeout_sec)) as client:
            r = await client.post(url, data=form)
    except httpx.TimeoutException as exc:
        return TelegramSendResult(ok=False, error=f"telegram_timeout:{exc}", http_status=None)
    except httpx.RequestError as exc:
        return TelegramSendResult(ok=False, error=f"telegram_network:{exc}", http_status=None)

    raw_text = r.text or ""
    data: Any
    try:
        data = r.json()
    except json.JSONDecodeError:
        data = {"ok": False, "description": raw_text[:500] if raw_text else "invalid_json"}

    if r.status_code == 429:
        ra = None
        if isinstance(data, dict):
            ra = _retry_after_from_telegram_json(data)
        if ra is None:
            ra = _retry_after_from_headers(r.headers) or 60
        err = (
            str(data.get("description"))
            if isinstance(data, dict) and data.get("description")
            else "too_many_requests"
        )
        return TelegramSendResult(
            ok=False,
            error=err[:2000],
            rate_limited=True,
            retry_after_seconds=ra,
            http_status=429,
            telegram_error_code=429 if isinstance(data, dict) else None,
        )

    if r.status_code >= 400:
        err = raw_text[:2000] if raw_text else f"http_{r.status_code}"
        if isinstance(data, dict) and data.get("description"):
            err = str(data.get("description"))[:2000]
        return TelegramSendResult(ok=False, error=err, http_status=r.status_code)

    if not isinstance(data, dict):
        return TelegramSendResult(
            ok=False,
            error="telegram_unexpected_response",
            http_status=r.status_code,
        )

    if data.get("ok") is True:
        return TelegramSendResult(ok=True, http_status=r.status_code)

    err = str(data.get("description") or "telegram_send_failed")[:2000]
    code = data.get("error_code")
    try:
        err_code = int(code) if code is not None else None
    except (TypeError, ValueError):
        err_code = None

    if err_code == 429:
        ra = _retry_after_from_telegram_json(data) or 60
        return TelegramSendResult(
            ok=False,
            error=err,
            rate_limited=True,
            retry_after_seconds=ra,
            http_status=r.status_code,
            telegram_error_code=429,
        )

    return TelegramSendResult(
        ok=False,
        error=err,
        http_status=r.status_code,
        telegram_error_code=err_code,
    )
