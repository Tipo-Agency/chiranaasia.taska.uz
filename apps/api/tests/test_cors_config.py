"""CORS: явный whitelist origins, без '*' вместе с credentials."""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.core.config import Settings, effective_browser_origin_allowlist, parse_cors_origins


def _settings(**kwargs: object) -> Settings:
    base: dict[str, object] = {
        "DATABASE_URL": "postgresql://u:p@localhost/db",
        "SECRET_KEY": "x" * 32,
        "REDIS_URL": "redis://localhost:6379/0",
    }
    base.update(kwargs)
    return Settings(**base)


def test_parse_cors_origins_trims_and_splits():
    assert parse_cors_origins(" http://a , https://b ") == ["http://a", "https://b"]


def test_effective_browser_origin_allowlist_adds_public_base():
    out = effective_browser_origin_allowlist(
        "http://localhost:3000",
        "https://tipa.taska.uz/api",
    )
    assert "http://localhost:3000" in out
    assert "https://tipa.taska.uz" in out


def test_effective_browser_origin_allowlist_dedupes_public_base():
    out = effective_browser_origin_allowlist(
        "https://tipa.taska.uz,http://localhost:3000",
        "https://tipa.taska.uz",
    )
    assert out.count("https://tipa.taska.uz") == 1


def test_cors_rejects_wildcard_only():
    with pytest.raises(ValidationError) as ei:
        _settings(CORS_ORIGINS="*")
    err = str(ei.value).lower()
    assert "cors_origins" in err or "cors" in err
    assert "*" in str(ei.value)


def test_cors_rejects_wildcard_in_list():
    with pytest.raises(ValidationError):
        _settings(CORS_ORIGINS="http://localhost:3000,*")


def test_cors_rejects_empty():
    with pytest.raises(ValidationError):
        _settings(CORS_ORIGINS="  ,  ")


def test_no_wildcard_with_allow_credentials_default():
    """Инвариант: allow_credentials=True (дефолт) только с явным списком, не с *."""
    s = _settings()
    origins = parse_cors_origins(s.CORS_ORIGINS)
    assert "*" not in origins
    assert s.CORS_ALLOW_CREDENTIALS is True


def test_cors_allow_credentials_can_be_disabled():
    s = _settings(CORS_ALLOW_CREDENTIALS=False)
    assert s.CORS_ALLOW_CREDENTIALS is False
