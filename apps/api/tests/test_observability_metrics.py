"""Prometheus /metrics: доступ по Bearer из PROMETHEUS_SCRAPE_TOKEN."""

from __future__ import annotations

import os

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@127.0.0.1:5432/test")
os.environ.setdefault("SECRET_KEY", "0" * 32)
os.environ.setdefault("REDIS_URL", "redis://127.0.0.1:6379/0")
os.environ.setdefault("PROMETHEUS_SCRAPE_TOKEN", "pytest-metrics-token")

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_metrics_forbidden_without_bearer() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        r = await ac.get("/metrics")
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_metrics_ok_with_bearer() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        r = await ac.get(
            "/metrics",
            headers={"Authorization": "Bearer pytest-metrics-token"},
        )
    assert r.status_code == 200
    assert b"http_requests_total" in r.content
    assert b"queue_depth" in r.content
    assert b"inbox_messages_count" in r.content
    assert b"notification_deliveries_dead_count" in r.content
    assert b"dlq_unresolved_count" in r.content
