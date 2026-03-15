"""Tasks API smoke tests."""
import pytest


def test_get_tasks_returns_list(api_client):
    """GET /api/tasks returns 200 and list."""
    r = api_client.get("/api/tasks")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_system_logs_returns_list(api_client):
    """GET /api/system/logs returns 200 and list."""
    r = api_client.get("/api/system/logs?limit=5")
    assert r.status_code == 200
    assert isinstance(r.json(), list)
