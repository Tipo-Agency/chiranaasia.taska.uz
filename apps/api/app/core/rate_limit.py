"""Глобальный limiter (slowapi); лимиты на эндпоинты — в роутерах."""
from __future__ import annotations

from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request

from app.core.auth import get_current_user_optional
from app.core.config import get_settings


def rate_limit_key(request: Request) -> str:
    """
    Ключ лимита: docs/API.md §6.
    POST login / refresh / logout / site leads — по IP; иначе при валидном JWT — user_id (sub), без JWT — IP.
    """
    settings = get_settings()
    prefix = (settings.API_PREFIX or "/api").rstrip("/") or "/api"
    path = (request.url.path or "").rstrip("/") or "/"
    method = (request.method or "GET").upper()

    ip_scope_paths = {
        f"{prefix}/auth/login",
        f"{prefix}/auth/refresh",
        f"{prefix}/auth/logout",
        f"{prefix}/integrations/site/leads",
    }
    if method == "POST" and path in ip_scope_paths:
        return f"ip:{get_remote_address(request)}"

    uid = get_current_user_optional(request)
    if uid:
        return f"user:{uid}"
    return f"ip:{get_remote_address(request)}"


# default_limits — см. docs/API.md §6 (300/мин для маршрутов без своего @limiter.limit).
# headers_enabled: Retry-After и X-RateLimit-* при 429 (см. main._rate_limit_handler + _inject_headers)
limiter = Limiter(
    key_func=rate_limit_key,
    default_limits=["300/minute"],
    headers_enabled=True,
)
