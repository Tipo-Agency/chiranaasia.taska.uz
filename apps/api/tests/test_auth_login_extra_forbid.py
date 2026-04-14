"""Auth JSON body: лишние поля → 422 (extra=forbid) на login / refresh / logout."""

from __future__ import annotations

import os

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@127.0.0.1:5432/test")
os.environ.setdefault("SECRET_KEY", "0" * 32)
os.environ.setdefault("REDIS_URL", "redis://127.0.0.1:6379/0")

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_login_rejects_unknown_field() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        r = await ac.post(
            "/api/auth/login",
            json={"login": "x", "password": "y", "evil": True},
        )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_refresh_rejects_unknown_field() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        r = await ac.post(
            "/api/auth/refresh",
            json={"refresh_token": "x" * 12, "evil": True},
        )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_logout_rejects_unknown_field() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        r = await ac.post(
            "/api/auth/logout",
            json={"refresh_token": "x" * 12, "evil": True},
        )
    assert r.status_code == 422
