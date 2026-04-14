"""Финансы: без JWT — 401; approve без finance.approve — 403."""
import uuid

import pytest

from http_helpers import browser_csrf_headers


def _login(api_client, login: str, password: str = ""):
    r = api_client.post("/api/auth/login", json={"login": login, "password": password})
    assert r.status_code == 200, r.text


def test_finance_categories_requires_auth(api_client):
    r = api_client.get("/api/finance/categories")
    assert r.status_code == 401


def test_finance_requests_list_requires_auth(api_client):
    r = api_client.get("/api/finance/requests")
    assert r.status_code == 401


def test_finance_approve_request_forbidden_for_employee(api_client):
    _login(api_client, "anna")
    rid = str(uuid.uuid4())
    c = api_client.post(
        "/api/finance/requests",
        json={
            "id": rid,
            "title": "Тестовая заявка",
            "amount": "100",
            "currency": "UZS",
            "status": "pending",
            "requesterId": "u2",
        },
        headers=browser_csrf_headers(api_client),
    )
    assert c.status_code == 201, c.text
    r = api_client.patch(
        f"/api/finance/requests/{rid}",
        json={"status": "approved"},
        headers=browser_csrf_headers(api_client),
    )
    assert r.status_code == 403
    assert r.json().get("message") == "finance_approve_required"


def test_finance_approve_request_ok_for_demo_admin(api_client):
    _login(api_client, "demo")
    rid = str(uuid.uuid4())
    c = api_client.post(
        "/api/finance/requests",
        json={
            "id": rid,
            "title": "Админ заявка",
            "amount": "50",
            "currency": "UZS",
            "status": "pending",
            "requesterId": "demo-user",
        },
        headers=browser_csrf_headers(api_client),
    )
    assert c.status_code == 201, c.text
    r = api_client.patch(
        f"/api/finance/requests/{rid}",
        json={"status": "approved"},
        headers=browser_csrf_headers(api_client),
    )
    assert r.status_code == 200, r.text
    assert r.json().get("status") == "approved"


def test_finance_plan_doc_approve_forbidden_for_employee(api_client):
    _login(api_client, "anna")
    doc_id = str(uuid.uuid4())
    r = api_client.put(
        "/api/finance/financial-plan-documents",
        json=[
            {
                "id": doc_id,
                "departmentId": "d0",
                "period": "2026-04",
                "income": "0",
                "expenses": {},
                "status": "approved",
                "createdAt": "2026-04-01T00:00:00Z",
            }
        ],
        headers=browser_csrf_headers(api_client),
    )
    assert r.status_code == 403
    assert r.json().get("message") == "finance_approve_required"


@pytest.mark.parametrize("login", ["anna", "demo"])
def test_finance_plan_doc_draft_ok(api_client, login: str):
    """Черновик без перевода в approved — доступен и сотруднику с finance.finance, и админу."""
    _login(api_client, login)
    doc_id = str(uuid.uuid4())
    r = api_client.put(
        "/api/finance/financial-plan-documents",
        json=[
            {
                "id": doc_id,
                "departmentId": "d0",
                "period": "2026-05",
                "income": "0",
                "expenses": {},
                "status": "created",
                "createdAt": "2026-05-01T00:00:00Z",
            }
        ],
        headers=browser_csrf_headers(api_client),
    )
    assert r.status_code == 200, r.text
