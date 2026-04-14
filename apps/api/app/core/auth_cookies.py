"""HttpOnly access/refresh + читаемый csrf_token (double-submit)."""
from __future__ import annotations

import secrets

from starlette.responses import Response

from app.core.config import get_settings


def _cookie_base_kwargs() -> dict:
    s = get_settings()
    ss = (s.COOKIE_SAMESITE or "lax").lower()
    if ss not in ("lax", "strict", "none"):
        ss = "lax"
    kw: dict = {
        "samesite": ss,
        "secure": bool(s.COOKIE_SECURE),
        "path": "/",
    }
    if s.COOKIE_DOMAIN.strip():
        kw["domain"] = s.COOKIE_DOMAIN.strip()
    return kw


def set_csrf_cookie(response: Response) -> None:
    """Новый csrf_token при login/refresh (не HttpOnly — фронт читает для X-CSRF-Token)."""
    s = get_settings()
    token = secrets.token_hex(32)
    kwargs = {
        **_cookie_base_kwargs(),
        "key": s.CSRF_COOKIE_NAME,
        "value": token,
        "httponly": False,
        "max_age": 60 * 60 * 24 * 30,
    }
    response.set_cookie(**kwargs)


def set_access_token_cookie(response: Response, value: str) -> None:
    s = get_settings()
    max_age = int(s.ACCESS_TOKEN_EXPIRE_MINUTES) * 60
    kwargs = {
        **_cookie_base_kwargs(),
        "key": s.ACCESS_TOKEN_COOKIE_NAME,
        "value": value,
        "httponly": True,
        "max_age": max_age,
    }
    response.set_cookie(**kwargs)


def set_refresh_token_cookie(response: Response, value: str) -> None:
    s = get_settings()
    max_age = int(s.REFRESH_TOKEN_EXPIRE_DAYS) * 24 * 60 * 60
    kwargs = {
        **_cookie_base_kwargs(),
        "key": s.REFRESH_TOKEN_COOKIE_NAME,
        "value": value,
        "httponly": True,
        "max_age": max_age,
    }
    response.set_cookie(**kwargs)


def set_auth_cookies(response: Response, *, access_jwt: str, refresh_raw: str) -> None:
    set_access_token_cookie(response, access_jwt)
    set_refresh_token_cookie(response, refresh_raw)
    set_csrf_cookie(response)


def clear_auth_cookies(response: Response) -> None:
    s = get_settings()
    base = _cookie_base_kwargs()
    path = base["path"]
    domain = base.get("domain")
    for key in (s.ACCESS_TOKEN_COOKIE_NAME, s.REFRESH_TOKEN_COOKIE_NAME, s.CSRF_COOKIE_NAME):
        response.delete_cookie(key=key, path=path, domain=domain)
