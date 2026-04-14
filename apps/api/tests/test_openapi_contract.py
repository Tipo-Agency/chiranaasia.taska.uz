"""OpenAPI: схема строится, в description зафиксированы ошибки / CSRF / rate limit."""

from __future__ import annotations

import os

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@127.0.0.1:5432/test")
os.environ.setdefault("SECRET_KEY", "0" * 32)
os.environ.setdefault("REDIS_URL", "redis://127.0.0.1:6379/0")

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_openapi_json_builds_and_lists_integrations_site_leads() -> None:
    schema = app.openapi()
    assert schema.get("info", {}).get("title") == "Taska API"
    desc = schema.get("info", {}).get("description") or ""
    assert "request_id" in desc
    assert "X-CSRF-Token" in desc
    assert "429" in desc
    paths = schema.get("paths") or {}
    assert "/api/integrations/site/leads" in paths
    post = paths["/api/integrations/site/leads"].get("post") or {}
    assert post.get("requestBody") is not None


@pytest.mark.asyncio
async def test_openapi_http_route_returns_json() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        r = await ac.get("/openapi.json")
    assert r.status_code == 200
    data = r.json()
    assert data["info"]["title"] == "Taska API"
    assert "/api/auth/login" in data.get("paths", {})
