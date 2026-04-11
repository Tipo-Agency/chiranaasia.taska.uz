"""Tasks API smoke tests."""
import pytest


def test_get_tasks_returns_list(api_client):
    """GET /api/tasks returns 200 and list."""
    r = api_client.get("/api/tasks")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_admin_logs_requires_auth(api_client):
    """GET /api/admin/logs without token returns 401."""
    r = api_client.get("/api/admin/logs?limit=5")
    assert r.status_code == 401


def test_admin_logs_returns_list(api_client):
    """GET /api/admin/logs with demo admin token returns 200 and list."""
    login = api_client.post(
        "/api/auth/login",
        json={"login": "demo", "password": ""},
    )
    assert login.status_code == 200, login.text
    token = login.json()["access_token"]
    r = api_client.get(
        "/api/admin/logs?limit=5",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    assert isinstance(r.json(), list)
