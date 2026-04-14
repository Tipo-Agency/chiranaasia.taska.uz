"""Единый формат ошибок API (docs/API.md § Ошибка)."""
from __future__ import annotations

import uuid
from typing import Any

from fastapi.responses import JSONResponse
from starlette.requests import Request

_STATUS_TO_ERROR: dict[int, str] = {
    400: "bad_request",
    401: "unauthorized",
    403: "forbidden",
    404: "not_found",
    405: "method_not_allowed",
    409: "conflict",
    413: "payload_too_large",
    415: "unsupported_media_type",
    422: "validation_error",
    429: "rate_limited",
    500: "internal_error",
    502: "bad_gateway",
    503: "service_unavailable",
}


def ensure_request_id(request: Request) -> str:
    """Гарантирует request.state.request_id (API.md: если заголовка нет — UUID)."""
    rid = getattr(request.state, "request_id", None)
    if not rid:
        rid = str(uuid.uuid4())
        request.state.request_id = rid
    return str(rid)


def error_code_for_status(status_code: int) -> str:
    return _STATUS_TO_ERROR.get(status_code, f"http_{status_code}")


def http_detail_to_message_and_details(detail: Any) -> tuple[str, dict[str, Any] | list[Any] | None]:
    """Разбор HTTPException.detail (str | dict | list)."""
    if detail is None:
        return "Ошибка запроса", None
    if isinstance(detail, str):
        return detail, None
    if isinstance(detail, list):
        return "Ошибка запроса", {"items": detail}
    if isinstance(detail, dict):
        inner = detail.get("detail")
        if isinstance(inner, str):
            rest = {k: v for k, v in detail.items() if k != "detail"}
            return inner, rest if rest else None
        msg = detail.get("message")
        if isinstance(msg, str):
            rest = {k: v for k, v in detail.items() if k != "message"}
            return msg, rest if rest else None
        return "Ошибка запроса", detail
    return str(detail), None


def first_validation_message(errors: list[dict[str, Any]]) -> str:
    if not errors:
        return "Некорректные данные запроса"
    e = errors[0]
    loc_parts: list[str] = []
    for x in e.get("loc") or ():
        if x in (None, "body", "query", "path", "header"):
            continue
        loc_parts.append(str(x))
    loc = ".".join(loc_parts) if loc_parts else ""
    msg = (e.get("msg") or "").strip()
    if loc and msg:
        return f"{loc}: {msg}"
    return msg or "Некорректные данные запроса"


def error_response(
    *,
    status_code: int,
    error: str,
    message: str,
    request: Request,
    details: dict[str, Any] | list[Any] | None = None,
) -> JSONResponse:
    rid = ensure_request_id(request)
    body: dict[str, Any] = {
        "error": error,
        "message": message,
        "request_id": rid,
    }
    if details is not None:
        body["details"] = details
    resp = JSONResponse(status_code=status_code, content=body)
    resp.headers.setdefault("X-Request-ID", rid)
    return resp
