"""Health endpoint smoke tests."""
import pytest


def test_health_returns_ok(api_client):
    """GET /health returns 200 и минимальное тело без утечек диагностики."""
    r = api_client.get("/health")
    assert r.status_code == 200
    data = r.json()
    assert data == {"status": "ok"}
    assert "version" not in data
    assert "db_error" not in data
    assert "db" not in data


def test_health_db_check(api_client):
    """При доступной Postgres публичный health остаётся 200 / ok."""
    r = api_client.get("/health")
    assert r.status_code == 200
    data = r.json()
    assert data.get("status") == "ok"
