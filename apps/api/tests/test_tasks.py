"""Tasks API smoke tests."""
import json

import pytest

from http_helpers import TEST_BROWSER_ORIGIN, browser_csrf_headers


def _demo_login(api_client):
    login = api_client.post(
        "/api/auth/login",
        json={"login": "demo", "password": ""},
    )
    assert login.status_code == 200, login.text
    return login


def test_get_tasks_requires_auth(api_client):
    """GET /api/tasks без JWT — 401."""
    r = api_client.get("/api/tasks")
    assert r.status_code == 401


def test_post_tasks_requires_auth(api_client):
    """POST /api/tasks без cookie-сессии: при доверенном Origin — 403 CSRF (раньше обработчика 401)."""
    r = api_client.post(
        "/api/tasks",
        json={"title": "x", "table_id": "t1"},
        headers={"Origin": TEST_BROWSER_ORIGIN, "Content-Type": "application/json"},
    )
    assert r.status_code == 403
    assert "CSRF" in str(r.json().get("message", ""))


def test_post_tasks_ok_with_tasks_edit(api_client):
    """POST /api/tasks с demo и правом tasks.edit (после миграции 042) — 201."""
    _demo_login(api_client)
    r = api_client.post(
        "/api/tasks",
        json={"title": "RBAC tasks.edit smoke", "table_id": "t1", "status": "todo"},
        headers=browser_csrf_headers(api_client),
    )
    assert r.status_code == 201, r.text
    assert r.json().get("title") == "RBAC tasks.edit smoke"


def test_get_tasks_returns_paginated(api_client):
    """GET /api/tasks returns 200 и обёртка items/total/limit/next_cursor (keyset)."""
    _demo_login(api_client)
    r = api_client.get("/api/tasks")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, dict)
    assert "items" in data and "total" in data and "limit" in data and "next_cursor" in data
    assert isinstance(data["items"], list)
    nc = data.get("next_cursor")
    if nc:
        with pytest.raises(json.JSONDecodeError):
            json.loads(nc)


def test_admin_logs_requires_auth(api_client):
    """GET /api/admin/logs without token returns 401."""
    r = api_client.get("/api/admin/logs?limit=5")
    assert r.status_code == 401


def test_system_logs_legacy_requires_auth(api_client):
    """Legacy GET /api/system/logs без JWT — 401 (тот же RBAC, что и /admin/logs)."""
    r = api_client.get("/api/system/logs?limit=5")
    assert r.status_code == 401


def test_admin_logs_returns_list(api_client):
    """GET /api/admin/logs with demo admin token returns 200 and list."""
    login = api_client.post(
        "/api/auth/login",
        json={"login": "demo", "password": ""},
    )
    assert login.status_code == 200, login.text
    r = api_client.get("/api/admin/logs?limit=5")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_system_logs_legacy_deprecated_headers(api_client):
    """Legacy ответ помечен Deprecation и указывает Link на канон /api/admin/logs."""
    login = api_client.post(
        "/api/auth/login",
        json={"login": "demo", "password": ""},
    )
    assert login.status_code == 200, login.text
    r = api_client.get("/api/system/logs?limit=3")
    assert r.status_code == 200
    assert r.headers.get("Deprecation") == "true"
    assert "/admin/logs" in (r.headers.get("Link") or "")
