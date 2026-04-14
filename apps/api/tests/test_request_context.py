"""request_id: ContextVar, фильтр логов (без поднятого HTTP)."""
from __future__ import annotations

import logging
import os

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@127.0.0.1:5432/test")
os.environ.setdefault("SECRET_KEY", "unit-test-secret-key-min-32-chars-ok")
os.environ.setdefault("REDIS_URL", "redis://127.0.0.1:6379/0")

from app.core.logging_handlers import RequestIdLogFilter
from app.core.request_context import get_request_id, reset_request_id_token, set_request_id_token


def test_context_get_set():
    assert get_request_id() is None
    t = set_request_id_token("corr-abc")
    try:
        assert get_request_id() == "corr-abc"
    finally:
        reset_request_id_token(t)
    assert get_request_id() is None


def test_request_id_log_filter_injects_from_context():
    t = set_request_id_token("log-corr-99")
    try:
        rec = logging.LogRecord("pytest", logging.INFO, __file__, 1, "hello", (), None)
        assert getattr(rec, "request_id", None) is None
        assert RequestIdLogFilter().filter(rec) is True
        assert rec.request_id == "log-corr-99"
    finally:
        reset_request_id_token(t)


def test_request_id_log_filter_preserves_explicit():
    t = set_request_id_token("ignored")
    try:
        rec = logging.LogRecord("pytest", logging.INFO, __file__, 1, "hello", (), None)
        rec.request_id = "explicit"
        assert RequestIdLogFilter().filter(rec) is True
        assert rec.request_id == "explicit"
    finally:
        reset_request_id_token(t)
