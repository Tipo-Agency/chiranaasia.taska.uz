"""Idempotency-Key для POST /api/*: Redis, SHA-256 тела; replay или 409 при несовпадении тела."""
from __future__ import annotations

import base64
import hashlib
import json
import logging
from collections.abc import Callable
from typing import Any

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.api_errors import ensure_request_id, error_response
from app.core.config import get_settings
from app.core.redis import get_redis_client
from app.core.redis import idempotency_key as idempotency_redis_key

logger = logging.getLogger(__name__)

_IDEMPOTENCY_HEADER_CANDIDATES = ("idempotency-key", "x-idempotency-key")


def _normalize_idempotency_header(request: Request) -> str | None:
    for name in _IDEMPOTENCY_HEADER_CANDIDATES:
        raw = request.headers.get(name)
        if raw is None:
            continue
        s = str(raw).strip()
        if s:
            return s
    return None


def _body_sha256(body: bytes) -> str:
    return hashlib.sha256(body).hexdigest()


def _normalize_api_path(path: str) -> str:
    """Канонический путь без завершающего слэша (для scope ключа, см. docs/API.md §3)."""
    p = (path or "").rstrip("/")
    return p if p else "/"


def _idempotency_scope_fingerprint(method: str, path: str, raw_header_key: str) -> str:
    """Один Redis-key на связку METHOD + path + Idempotency-Key (не делим разные POST между маршрутами)."""
    norm = _normalize_api_path(path)
    composite = f"{method.upper()}:{norm}:{raw_header_key}"
    return hashlib.sha256(composite.encode("utf-8")).hexdigest()


def _redis_record_key(method: str, path: str, raw_header_key: str) -> str:
    return idempotency_redis_key("http", _idempotency_scope_fingerprint(method, path, raw_header_key))


def _should_apply(path: str, method: str) -> bool:
    if method.upper() != "POST":
        return False
    settings = get_settings()
    prefix = (settings.API_PREFIX or "/api").rstrip("/") or "/api"
    if not path.startswith(prefix + "/") and path != prefix:
        return False
    return True


class IdempotencyMiddleware(BaseHTTPMiddleware):
    """
    После CSRF (см. порядок add_middleware в main): повтор с тем же ключом и телом — ответ из Redis.
    Тот же ключ и другое тело — 409. Запись в Redis привязана к METHOD + path + Idempotency-Key (docs/API.md §3).
    Без Redis — пропуск (идемпотентность отключена).
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        settings = get_settings()
        if not settings.IDEMPOTENCY_ENABLED:
            return await call_next(request)

        if not _should_apply(request.url.path, request.method):
            return await call_next(request)

        raw_key = _normalize_idempotency_header(request)
        if not raw_key:
            return await call_next(request)

        max_len = settings.IDEMPOTENCY_MAX_KEY_LEN
        if len(raw_key) > max_len:
            return error_response(
                status_code=400,
                error="bad_request",
                message=f"Idempotency-Key слишком длинный (макс. {max_len})",
                request=request,
            )

        body = await request.body()
        body_hash = _body_sha256(body)
        rkey = _redis_record_key(request.method, request.url.path, raw_key)

        r = await get_redis_client()
        if r is None:
            logger.debug("Idempotency: Redis недоступен, пропуск")
            return await self._call_with_body(request, call_next, body)

        try:
            raw = await r.get(rkey)
        except Exception as exc:
            logger.warning("Idempotency: Redis GET failed: %s", exc)
            return await self._call_with_body(request, call_next, body)

        if raw:
            try:
                rec: dict[str, Any] = json.loads(raw)
            except json.JSONDecodeError:
                logger.warning("Idempotency: битая запись %s", rkey)
                return await self._call_with_body(request, call_next, body)

            stored_h = rec.get("body_sha256")
            if stored_h != body_hash:
                return error_response(
                    status_code=409,
                    error="idempotency_conflict",
                    message="Тот же Idempotency-Key уже использован с другим телом запроса",
                    request=request,
                    details={"expected_body_sha256": stored_h, "request_body_sha256": body_hash},
                )

            try:
                rb = base64.b64decode(rec.get("body_b64") or "", validate=True)
            except Exception:
                return error_response(
                    status_code=500,
                    error="internal_error",
                    message="Сохранённый ответ идемпотентности повреждён",
                    request=request,
                )

            sc = int(rec.get("status_code") or 200)
            ct = str(rec.get("content_type") or "application/json")
            headers = {
                "Content-Type": ct,
                "Idempotent-Replayed": "true",
                "X-Idempotent-Replayed": "true",
                "X-Request-ID": ensure_request_id(request),
            }
            return Response(content=rb, status_code=sc, headers=headers)

        response = await self._call_with_body(request, call_next, body)

        if response.status_code >= 500:
            return response

        chunks: list[bytes] = []
        async for chunk in response.body_iterator:
            chunks.append(chunk)
        rb = b"".join(chunks)

        ct = response.headers.get("content-type") or "application/json"
        payload = {
            "body_sha256": body_hash,
            "status_code": response.status_code,
            "content_type": ct,
            "body_b64": base64.b64encode(rb).decode("ascii"),
        }
        ttl = settings.IDEMPOTENCY_TTL_SECONDS
        try:
            await r.set(rkey, json.dumps(payload, separators=(",", ":")), ex=ttl)
        except Exception as exc:
            logger.warning("Idempotency: Redis SET failed: %s", exc)

        out = Response(content=rb, status_code=response.status_code, headers=dict(response.headers))
        return out

    async def _call_with_body(
        self,
        request: Request,
        call_next: Callable,
        body: bytes,
    ) -> Response:
        async def receive():
            return {"type": "http.request", "body": body, "more_body": False}

        new_request = Request(request.scope, receive)
        return await call_next(new_request)
