"""Health endpoint smoke tests."""
import pytest


def test_health_returns_ok(api_client):
    """GET /health returns 200 and status ok."""
    r = api_client.get("/health")
    assert r.status_code == 200
    data = r.json()
    assert data.get("status") == "ok"
    assert "version" in data


def test_health_db_check(api_client):
    """GET /health includes db status when backend can reach Postgres."""
    r = api_client.get("/health")
    assert r.status_code == 200
    data = r.json()
    assert data.get("db") in ("ok", "error")
