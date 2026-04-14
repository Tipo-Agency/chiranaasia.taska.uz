"""Контекст запроса: request_id для логов и audit_logs без явной передачи из каждого хендлера."""
from __future__ import annotations

from contextvars import ContextVar, Token

_request_id_ctx: ContextVar[str | None] = ContextVar("request_id", default=None)


def get_request_id() -> str | None:
    """Текущий request_id в async-цепочке обработки запроса (или None вне HTTP)."""
    return _request_id_ctx.get()


def set_request_id_token(request_id: str) -> Token[str | None]:
    """Для middleware: вернуть token для последующего reset."""
    return _request_id_ctx.set(request_id)


def reset_request_id_token(token: Token[str | None]) -> None:
    _request_id_ctx.reset(token)
