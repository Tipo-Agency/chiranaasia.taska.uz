"""Админ-роуты: JWT без права admin.system → 403; demo (admin) → 200."""


def _login(api_client, login: str, password: str = ""):
    r = api_client.post("/api/auth/login", json={"login": login, "password": password})
    assert r.status_code == 200, r.text


def test_admin_logs_forbidden_for_employee(api_client):
    _login(api_client, "anna")
    r = api_client.get("/api/admin/logs?limit=5")
    assert r.status_code == 403


def test_admin_audit_logs_forbidden_for_employee(api_client):
    _login(api_client, "anna")
    r = api_client.get("/api/admin/audit-logs?limit=5")
    assert r.status_code == 403


def test_system_logs_legacy_forbidden_for_employee(api_client):
    _login(api_client, "anna")
    r = api_client.get("/api/system/logs?limit=5")
    assert r.status_code == 403


def test_system_audit_forbidden_for_employee(api_client):
    _login(api_client, "anna")
    r = api_client.get("/api/system/audit?limit=5")
    assert r.status_code == 403


def test_system_audit_ok_for_demo_admin(api_client):
    _login(api_client, "demo")
    r = api_client.get("/api/system/audit?limit=5")
    assert r.status_code == 200, r.text
    assert isinstance(r.json(), list)


def test_admin_audit_logs_ok_for_demo_admin(api_client):
    _login(api_client, "demo")
    r = api_client.get("/api/admin/audit-logs?limit=5")
    assert r.status_code == 200, r.text
    assert isinstance(r.json(), list)
