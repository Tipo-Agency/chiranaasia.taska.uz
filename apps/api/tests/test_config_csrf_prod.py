"""CSRF: в production/staging нельзя отключить через env."""

from __future__ import annotations

import pytest

from app.core.config import Settings


def _minimal_env(monkeypatch: pytest.MonkeyPatch, **overrides: str) -> None:
    base = {
        "DATABASE_URL": "postgresql+asyncpg://u:p@127.0.0.1:5432/t",
        "SECRET_KEY": "0" * 32,
        "REDIS_URL": "redis://127.0.0.1:6379/0",
    }
    for k, v in {**base, **overrides}.items():
        monkeypatch.setenv(k, v)


def test_csrf_cannot_be_disabled_in_production(monkeypatch: pytest.MonkeyPatch):
    _minimal_env(monkeypatch, ENVIRONMENT="production", CSRF_PROTECTION_ENABLED="false")
    with pytest.raises(ValueError, match="CSRF_PROTECTION_ENABLED"):
        Settings()


def test_csrf_cannot_be_disabled_in_staging(monkeypatch: pytest.MonkeyPatch):
    _minimal_env(monkeypatch, ENVIRONMENT="staging", CSRF_PROTECTION_ENABLED="0")
    with pytest.raises(ValueError, match="CSRF_PROTECTION_ENABLED"):
        Settings()


def test_csrf_may_be_disabled_in_development(monkeypatch: pytest.MonkeyPatch):
    _minimal_env(monkeypatch, ENVIRONMENT="development", CSRF_PROTECTION_ENABLED="false")
    s = Settings()
    assert s.CSRF_PROTECTION_ENABLED is False
