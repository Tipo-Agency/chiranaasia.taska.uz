"""Auth smoke tests."""
from __future__ import annotations

import os
import uuid

_TRUSTED_ORIGIN = os.environ.get("TEST_BROWSER_ORIGIN", "http://localhost:3000")


def _browser_mutate_headers(csrf_token: str | None = None) -> dict[str, str]:
    h = {"Origin": _TRUSTED_ORIGIN}
    if csrf_token:
        h["X-CSRF-Token"] = csrf_token
    return h


def test_login_success(api_client):
    """POST /api/auth/login returns token for a valid user."""
    login = f"pytest_{uuid.uuid4().hex[:8]}"
    password = "pytest-pass-123"

    admin_login = api_client.post(
        "/api/auth/login",
        json={"login": "demo", "password": ""},
    )
    assert admin_login.status_code == 200, admin_login.text
    # Сессия в cookies; JSON без токенов.
    alj = admin_login.json()
    assert "access_token" not in alj and "refresh_token" not in alj and "token_type" not in alj
    csrf = api_client.cookies.get("csrf_token")
    assert csrf, "после login должна быть csrf_token cookie"

    create_resp = api_client.put(
        "/api/auth/users",
        json=[
            {
                "name": "Pytest User",
                "role": "EMPLOYEE",
                "login": login,
                "password": password,
            }
        ],
        headers={**_browser_mutate_headers(csrf), "Content-Type": "application/json"},
    )
    assert create_resp.status_code == 200

    r = api_client.post(
        "/api/auth/login",
        json={"login": login, "password": password},
    )
    assert r.status_code == 200
    data = r.json()
    assert "user" in data and "id" in data["user"]
    assert "access_token" not in data
    assert "refresh_token" not in data
    assert "token_type" not in data


def test_login_invalid_returns_401(api_client):
    """POST /api/auth/login with wrong credentials returns 401."""
    r = api_client.post(
        "/api/auth/login",
        json={"login": "nonexistent", "password": "wrong"},
    )
    assert r.status_code == 401


# Тот же кейс, что test_login_invalid_returns_401 (альтернативное имя теста).
test_login_wrong_password = test_login_invalid_returns_401


def test_get_me_requires_auth(api_client):
    """GET /api/auth/me без cookie сессии → 401."""
    r = api_client.get("/api/auth/me")
    assert r.status_code == 401


def test_refresh_token_rotation_old_refresh_invalid(api_client):
    """После успешного /auth/refresh старый refresh-токен больше не принимается."""
    login = api_client.post("/api/auth/login", json={"login": "demo", "password": ""})
    assert login.status_code == 200, login.text
    old_refresh = api_client.cookies.get("refresh_token")
    assert old_refresh, "ожидается HttpOnly refresh_token после login"

    ref1 = api_client.post("/api/auth/refresh", json={})
    assert ref1.status_code == 200, ref1.text

    replay = api_client.post("/api/auth/refresh", json={"refresh_token": old_refresh})
    assert replay.status_code == 401, replay.text


test_refresh_token_rotation = test_refresh_token_rotation_old_refresh_invalid


def test_logout_clears_cookies_and_me_unauthorized(api_client):
    """POST /auth/logout с CSRF снимает сессию; /me без повторного login → 401."""
    from http_helpers import browser_csrf_headers

    login = api_client.post("/api/auth/login", json={"login": "demo", "password": ""})
    assert login.status_code == 200, login.text
    assert api_client.cookies.get("access_token")

    lo = api_client.post("/api/auth/logout", json={}, headers=browser_csrf_headers(api_client))
    assert lo.status_code == 200, lo.text

    me = api_client.get("/api/auth/me")
    assert me.status_code == 401, me.text


test_logout_clears_cookies = test_logout_clears_cookies_and_me_unauthorized


def test_get_users_requires_auth(api_client):
    """GET /api/auth/users без сессии → 401."""
    r = api_client.get("/api/auth/users")
    assert r.status_code == 401


def test_get_users_ok_after_login(api_client):
    """GET /api/auth/users после login → 200 и список."""
    login = api_client.post("/api/auth/login", json={"login": "demo", "password": ""})
    assert login.status_code == 200, login.text
    r = api_client.get("/api/auth/users")
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data, list)
    assert len(data) >= 1


def test_get_users_employee_only_non_archived(api_client):
    """У employee без access.users — только пользователи с isArchived=false."""
    anna = api_client.post("/api/auth/login", json={"login": "anna", "password": ""})
    assert anna.status_code == 200, anna.text
    r = api_client.get("/api/auth/users")
    assert r.status_code == 200, r.text
    for row in r.json():
        assert row.get("isArchived") is False, row


def test_me_admin_permissions_match_catalog(api_client):
    """У роли admin в /me полный список прав, совпадающий с каталогом (без расхождений с доступом)."""
    login = api_client.post("/api/auth/login", json={"login": "demo", "password": ""})
    assert login.status_code == 200, login.text
    cat = api_client.get("/api/auth/permissions/catalog")
    assert cat.status_code == 200, cat.text
    all_keys = set(cat.json().get("allKeys") or [])
    me = api_client.get("/api/auth/me")
    assert me.status_code == 200, me.text
    user = me.json()
    assert user.get("roleSlug") == "admin"
    perms = set(user.get("permissions") or [])
    assert perms == all_keys
    assert len(perms) == len(all_keys)


def test_me_employee_permissions_match_roles_list(api_client):
    """У employee в /me тот же набор прав, что в GET /roles для slug=employee; всё ⊆ каталога."""
    admin_login = api_client.post("/api/auth/login", json={"login": "demo", "password": ""})
    assert admin_login.status_code == 200, admin_login.text
    cat = api_client.get("/api/auth/permissions/catalog")
    assert cat.status_code == 200, cat.text
    all_keys = set(cat.json().get("allKeys") or [])
    roles = api_client.get("/api/auth/roles")
    assert roles.status_code == 200, roles.text
    employee_role = next((x for x in roles.json() if x.get("slug") == "employee"), None)
    assert employee_role is not None
    from_api_roles = set(employee_role.get("permissions") or [])

    anna = api_client.post("/api/auth/login", json={"login": "anna", "password": ""})
    assert anna.status_code == 200, anna.text
    me = api_client.get("/api/auth/me")
    assert me.status_code == 200, me.text
    user = me.json()
    assert user.get("roleSlug") == "employee"
    emp_perms = set(user.get("permissions") or [])
    assert emp_perms == from_api_roles
    assert emp_perms.issubset(all_keys)


def test_csrf_required_on_mutating(api_client):
    """POST/PUT/PATCH/DELETE под /api без X-CSRF-Token (при доверенном Origin) → 403."""
    login = api_client.post("/api/auth/login", json={"login": "demo", "password": ""})
    assert login.status_code == 200, login.text
    assert api_client.cookies.get("csrf_token")
    for method, path, body in (
        ("PUT", "/api/tasks/batch", []),
        ("PATCH", "/api/auth/roles/00000000-0000-4000-8000-000000000001", {"name": "admin"}),
        ("DELETE", "/api/meetings/00000000-0000-0000-0000-000000000099", None),
        ("POST", "/api/messages", {"senderId": "x", "text": "t"}),
    ):
        h = _browser_mutate_headers()
        if method != "DELETE":
            h["Content-Type"] = "application/json"
        req: dict = {"headers": h}
        if body is not None:
            req["json"] = body
        r = api_client.request(method, path, **req)
        assert r.status_code == 403, (method, path, r.text)
        body_json = r.json()
        msg = str(body_json.get("message", ""))
        assert "CSRF" in msg, (method, path, msg)
        assert body_json.get("error") == "forbidden"
        assert body_json.get("request_id")


test_csrf_required_on_post = test_csrf_required_on_mutating


def test_csrf_telegram_inbound_webhook_not_blocked_by_csrf(api_client):
    """Приём вебхука Telegram без CSRF и без Origin — не ответ 403 с текстом про CSRF."""
    r = api_client.post(
        "/api/integrations/telegram/webhook/pytest-nonexistent-funnel",
        json={"update_id": 1},
        headers={"Content-Type": "application/json"},
    )
    assert r.status_code != 403 or "CSRF" not in r.text
