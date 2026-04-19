"""Request ID, body size limits, security response headers, CSRF + Origin checks."""
from __future__ import annotations

import hmac
import re
import uuid
from collections.abc import Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.api_errors import error_response
from app.core.config import effective_browser_origin_allowlist, get_settings
from app.core.request_context import reset_request_id_token, set_request_id_token


def _trusted_origins() -> list[str]:
    s = get_settings()
    return effective_browser_origin_allowlist(s.CORS_ORIGINS, s.PUBLIC_BASE_URL)


def _request_browser_origin(request: Request) -> str | None:
    """Публичный origin за reverse-proxy — совпадает с Origin SPA на том же домене."""
    xfh = (request.headers.get("x-forwarded-host") or "").strip()
    host = (xfh.split(",")[0].strip() if xfh else (request.headers.get("host") or "").strip())
    if not host:
        return None
    xfp = (request.headers.get("x-forwarded-proto") or "").strip()
    proto = (xfp.split(",")[0].strip().lower() if xfp else (request.url.scheme or "https").lower())
    if proto not in ("http", "https"):
        proto = "https"
    return f"{proto}://{host}".rstrip("/")


def _origin_matches_request_public(request: Request, origin: str | None) -> bool:
    if not origin:
        return False
    expected = _request_browser_origin(request)
    if not expected:
        return False
    return origin.rstrip("/") == expected.rstrip("/")


def _referer_matches_request_public(request: Request, referer: str | None) -> bool:
    if not referer:
        return False
    expected = _request_browser_origin(request)
    if not expected:
        return False
    try:
        from urllib.parse import urlparse

        p = urlparse(referer)
        base = f"{p.scheme}://{p.netloc}".rstrip("/")
        return base == expected.rstrip("/")
    except Exception:
        return False


def _csp_value() -> str:
    s = get_settings()
    if s.SECURITY_CSP.strip():
        return s.SECURITY_CSP.strip()
    # default: no inline scripts; Meta / Telegram CDNs for embeds and assets
    return (
        "default-src 'self'; "
        "base-uri 'self'; "
        "frame-ancestors 'none'; "
        "form-action 'self'; "
        "img-src 'self' data: https: blob:; "
        "font-src 'self' data: https://fonts.gstatic.com; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.tailwindcss.com; "
        "script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://esm.sh; "
        "connect-src 'self' https://*.facebook.com https://*.fbcdn.net https://*.instagram.com "
        "https://graph.facebook.com https://telegram.org https://*.telegram.org https://esm.sh wss: ws:; "
        "worker-src 'self' blob:; "
        "object-src 'none'; "
        "upgrade-insecure-requests"
    )


def _origin_allowed(origin: str | None) -> bool:
    if not origin:
        return False
    norm = origin.rstrip("/")
    return norm in _trusted_origins()


def _referer_allowed(referer: str | None) -> bool:
    if not referer:
        return False
    try:
        from urllib.parse import urlparse

        p = urlparse(referer)
        base = f"{p.scheme}://{p.netloc}".rstrip("/")
        return base in _trusted_origins()
    except Exception:
        return False


# POST/PUT/PATCH/DELETE под /api/*: Origin/Referer из allowlist + X-CSRF-Token == cookie (double-submit).
_CSRF_PROTECTED_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})


def _normalized_path(path: str) -> str:
    p = (path or "").rstrip("/")
    return p if p else "/"


def _telegram_inbound_funnel_webhook(path: str, method: str) -> bool:
    """POST /api/integrations/telegram/webhook/{funnel_id} — приём обновлений от Telegram (не UI)."""
    if method.upper() != "POST":
        return False
    prefix = "/api/integrations/telegram/webhook/"
    if not path.startswith(prefix):
        return False
    tail = path[len(prefix) :].strip("/")
    if not tail or "/" in tail:
        return False
    return tail not in ("register", "unregister", "status")


def _csrf_exempt_webhook(path: str, method: str) -> bool:
    """
    Внешние вебхуки без cookie сессии и без X-CSRF-Token.
    Пути вне /api (например GET/POST /webhook/meta) middleware не трогает — см. dispatch.
    """
    m = method.upper()
    if _telegram_inbound_funnel_webhook(path, m):
        return True
    return False


def _csrf_exempt(path: str, method: str) -> bool:
    """
    Исключения из CSRF под /api/* (только перечисленные; остальные POST/PUT/PATCH/DELETE — под CSRF).

    - POST /api/auth/login — первая выдача csrf cookie.
    - POST /api/auth/refresh — обновление сессии до наличия csrf в некоторых клиентах.
    - POST /api/auth/logout — симметрично refresh (очистка cookie без обязательного CSRF в тех же клиентах).
    - POST /api/integrations/site/leads — публичный intake по X-Api-Key.
    - POST /api/integrations/telegram/webhook/{funnel_id} — входящие обновления от Telegram (не UI).
    Пути вне /api/* (например POST /webhook/meta) middleware не обрабатывает — CSRF к ним не применяется.
    """
    m = method.upper()
    if _csrf_exempt_webhook(path, m):
        return True
    if m != "POST":
        return False
    p = _normalized_path(path)
    if p == "/api/integrations/site/leads":
        return True
    if p in ("/api/auth/login", "/api/auth/refresh", "/api/auth/logout"):
        return True
    return False


def _webhook_path(path: str) -> bool:
    return path.startswith("/webhook/")


class RequestIDMiddleware(BaseHTTPMiddleware):
    """
    Самый внешний слой (регистрируется последним): request_id до CSRF / лимита тела и т.д.
    Прокидывает id в ContextVar — логи и audit_log могут читать без явного request.
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        raw = (request.headers.get("X-Request-ID") or "").strip()
        # audit_logs.request_id — VARCHAR(64)
        rid = raw[:64] if raw else str(uuid.uuid4())
        request.state.request_id = rid
        token = set_request_id_token(rid)
        try:
            response = await call_next(request)
            response.headers["X-Request-ID"] = rid
            return response
        finally:
            reset_request_id_token(token)


class MaxRequestBodyMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        path = request.url.path
        cl = request.headers.get("content-length")
        if cl is not None:
            try:
                n = int(cl)
            except ValueError:
                return error_response(
                    status_code=400,
                    error="bad_request",
                    message="Некорректный заголовок Content-Length",
                    request=request,
                )
            settings = get_settings()
            max_bytes = settings.WEBHOOK_MAX_BODY_BYTES if _webhook_path(path) else settings.MAX_REQUEST_BODY_BYTES
            if n > max_bytes:
                return error_response(
                    status_code=413,
                    error="payload_too_large",
                    message="Тело запроса слишком большое",
                    request=request,
                )
        return await call_next(request)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault("Content-Security-Policy", _csp_value())
        settings = get_settings()
        if settings.SECURITY_ENABLE_HSTS:
            response.headers.setdefault(
                "Strict-Transport-Security",
                "max-age=31536000; includeSubDomains; preload",
            )
        return response


class CSRFMiddleware(BaseHTTPMiddleware):
    """
    Защита мутаций под /api/*: POST, PUT, PATCH, DELETE.

    1) Origin или Referer из CORS_ORIGINS (или Bearer / заголовок CSRF при отсутствии Origin — нестандартные клиенты).
    2) Cookie csrf_token и заголовок X-CSRF-Token совпадают (constant-time).

    Не применяется к путям без префикса /api/ (в т.ч. /webhook/meta).
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        method = request.method.upper()
        path = request.url.path

        if not path.startswith("/api/"):
            return await call_next(request)
        if method not in _CSRF_PROTECTED_METHODS:
            return await call_next(request)
        if _csrf_exempt(path, method):
            return await call_next(request)

        settings = get_settings()
        if not settings.CSRF_PROTECTION_ENABLED:
            return await call_next(request)

        origin = request.headers.get("origin")
        referer = request.headers.get("referer")
        auth = request.headers.get("authorization") or ""
        csrf_header = (request.headers.get("X-CSRF-Token") or "").strip()

        origin_ok = (
            _origin_allowed(origin)
            or _referer_allowed(referer)
            or _origin_matches_request_public(request, origin)
            or _referer_matches_request_public(request, referer)
        )
        # Нет Origin/Referer: браузерные preflight/custom header; Bearer или X-CSRF-Token — признак не «голого» form POST
        if not origin_ok and not origin and not referer:
            if auth.startswith("Bearer ") or csrf_header:
                origin_ok = True

        if not origin_ok:
            return error_response(
                status_code=403,
                error="forbidden",
                message="Недопустимый источник запроса (Origin/Referer)",
                request=request,
            )

        cookie = request.cookies.get(settings.CSRF_COOKIE_NAME)
        if not csrf_header:
            return error_response(
                status_code=403,
                error="forbidden",
                message="CSRF: отсутствует или неверный токен",
                request=request,
            )
        if not cookie:
            return error_response(
                status_code=403,
                error="forbidden",
                message="CSRF: отсутствует или неверный токен",
                request=request,
            )
        try:
            token_ok = hmac.compare_digest(
                cookie.encode("utf-8"),
                csrf_header.encode("utf-8"),
            )
        except (ValueError, TypeError):
            token_ok = False
        if not token_ok:
            return error_response(
                status_code=403,
                error="forbidden",
                message="CSRF: отсутствует или неверный токен",
                request=request,
            )

        return await call_next(request)


# Cache-Control для ответов auth (устанавливается в роутере или здесь по path)
_AUTH_CACHE_PATHS = re.compile(r"^/api/auth/(login|refresh|me|logout)(/|$)")


class AuthCacheControlMiddleware(BaseHTTPMiddleware):
    """no-store для эндпоинтов аутентификации."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)
        path = request.url.path
        if _AUTH_CACHE_PATHS.match(path):
            response.headers["Cache-Control"] = "no-store"
            response.headers["Pragma"] = "no-cache"
        return response
