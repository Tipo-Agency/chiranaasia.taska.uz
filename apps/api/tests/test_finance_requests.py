"""Заявки на оплату: workflow и идемпотентность (smoke против живого API)."""
from __future__ import annotations

import uuid
from datetime import date

from http_helpers import browser_csrf_headers


def _login(api_client, login: str, password: str = "") -> None:
    r = api_client.post("/api/auth/login", json={"login": login, "password": password})
    assert r.status_code == 200, r.text


def test_approve_request_requires_permission(api_client):
    """Без finance.approve — PATCH в approved → 403."""
    _login(api_client, "anna")
    rid = str(uuid.uuid4())
    c = api_client.post(
        "/api/finance/requests",
        json={
            "id": rid,
            "title": "Тест approve perm",
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


def test_create_finance_request_returns_201(api_client):
    _login(api_client, "demo")
    rid = str(uuid.uuid4())
    r = api_client.post(
        "/api/finance/requests",
        json={
            "id": rid,
            "title": "Pytest заявка",
            "amount": "100.00",
            "currency": "UZS",
            "status": "pending",
            "requesterId": "demo-user",
        },
        headers=browser_csrf_headers(api_client),
    )
    assert r.status_code == 201, r.text
    data = r.json()
    assert data.get("id") == rid
    assert data.get("status") == "pending"


def test_reject_requires_comment(api_client):
    _login(api_client, "demo")
    rid = str(uuid.uuid4())
    c = api_client.post(
        "/api/finance/requests",
        json={
            "id": rid,
            "title": "На отклонение",
            "amount": "10",
            "currency": "UZS",
            "status": "pending",
            "requesterId": "demo-user",
        },
        headers=browser_csrf_headers(api_client),
    )
    assert c.status_code == 201, c.text
    r = api_client.patch(
        f"/api/finance/requests/{rid}",
        json={"status": "rejected"},
        headers=browser_csrf_headers(api_client),
    )
    assert r.status_code == 400, r.text
    assert r.json().get("message") == "finance_request_reject_comment_required"


def test_mark_paid_requires_approve_permission(api_client):
    _login(api_client, "demo")
    rid = str(uuid.uuid4())
    c = api_client.post(
        "/api/finance/requests",
        json={
            "id": rid,
            "title": "К оплате",
            "amount": "20",
            "currency": "UZS",
            "status": "pending",
            "requesterId": "demo-user",
        },
        headers=browser_csrf_headers(api_client),
    )
    assert c.status_code == 201, c.text
    ap = api_client.patch(
        f"/api/finance/requests/{rid}",
        json={"status": "approved"},
        headers=browser_csrf_headers(api_client),
    )
    assert ap.status_code == 200, ap.text

    _login(api_client, "anna")
    paid = api_client.patch(
        f"/api/finance/requests/{rid}",
        json={"status": "paid"},
        headers=browser_csrf_headers(api_client),
    )
    assert paid.status_code == 403, paid.text
    assert paid.json().get("message") == "finance_mark_paid_required"


def test_finance_approve_request_fund_insufficient_when_in_budget(api_client):
    """В бюджете лимит фонда: одобрение заявки с суммой выше остатка — 400."""
    _login(api_client, "demo")
    rid = str(uuid.uuid4())
    pid = str(uuid.uuid4())
    ym = date.today().strftime("%Y-%m")
    c = api_client.post(
        "/api/finance/requests",
        json={
            "id": rid,
            "title": "Заявка больше фонда",
            "amount": "500",
            "currency": "UZS",
            "status": "pending",
            "requesterId": "demo-user",
            "category": "fund-1",
        },
        headers=browser_csrf_headers(api_client),
    )
    assert c.status_code == 201, c.text
    put = api_client.put(
        "/api/finance/financial-plannings",
        json=[
            {
                "id": pid,
                "departmentId": "d0",
                "period": ym,
                "status": "conducted",
                "createdAt": "2020-01-01T00:00:00Z",
                "requestIds": [rid],
                "requestFundIds": {rid: "fund-1"},
                "fundAllocations": {"fund-1": 100},
            }
        ],
        headers=browser_csrf_headers(api_client),
    )
    assert put.status_code == 200, put.text
    r = api_client.patch(
        f"/api/finance/requests/{rid}",
        json={"status": "approved"},
        headers=browser_csrf_headers(api_client),
    )
    assert r.status_code == 400, r.text
    assert r.json().get("message") == "finance_request_budget_insufficient"


def test_finance_approve_request_budget_fund_required(api_client):
    """Заявка в бюджете без назначенного фонда — 400."""
    _login(api_client, "demo")
    rid = str(uuid.uuid4())
    pid = str(uuid.uuid4())
    ym = date.today().strftime("%Y-%m")
    c = api_client.post(
        "/api/finance/requests",
        json={
            "id": rid,
            "title": "Без фонда",
            "amount": "10",
            "currency": "UZS",
            "status": "pending",
            "requesterId": "demo-user",
        },
        headers=browser_csrf_headers(api_client),
    )
    assert c.status_code == 201, c.text
    put = api_client.put(
        "/api/finance/financial-plannings",
        json=[
            {
                "id": pid,
                "departmentId": "d0",
                "period": ym,
                "status": "conducted",
                "createdAt": "2020-01-01T00:00:00Z",
                "requestIds": [rid],
                "requestFundIds": {},
                "fundAllocations": {"fund-1": 10000},
            }
        ],
        headers=browser_csrf_headers(api_client),
    )
    assert put.status_code == 200, put.text
    r = api_client.patch(
        f"/api/finance/requests/{rid}",
        json={"status": "approved"},
        headers=browser_csrf_headers(api_client),
    )
    assert r.status_code == 400, r.text
    assert r.json().get("message") == "finance_request_budget_category_required"


def test_finance_approve_partial_within_budget(api_client):
    """Частичное одобрение: сумма больше лимита, но budgetApprovedUzs в пределах — 200."""
    _login(api_client, "demo")
    rid = str(uuid.uuid4())
    pid = str(uuid.uuid4())
    ym = date.today().strftime("%Y-%m")
    c = api_client.post(
        "/api/finance/requests",
        json={
            "id": rid,
            "title": "Частично",
            "amount": "500",
            "currency": "UZS",
            "status": "pending",
            "requesterId": "demo-user",
            "category": "fund-1",
        },
        headers=browser_csrf_headers(api_client),
    )
    assert c.status_code == 201, c.text
    put = api_client.put(
        "/api/finance/financial-plannings",
        json=[
            {
                "id": pid,
                "departmentId": "d0",
                "period": ym,
                "status": "conducted",
                "createdAt": "2020-01-01T00:00:00Z",
                "requestIds": [rid],
                "requestFundIds": {rid: "fund-1"},
                "fundAllocations": {"fund-1": 100},
            }
        ],
        headers=browser_csrf_headers(api_client),
    )
    assert put.status_code == 200, put.text
    r = api_client.patch(
        f"/api/finance/requests/{rid}",
        json={"status": "approved", "budgetApprovedUzs": 80},
        headers=browser_csrf_headers(api_client),
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("status") == "approved"
    assert data.get("budgetApprovedAmount") == "80"


def test_create_finance_request_idempotency_replay(api_client):
    """Повтор POST с тем же Idempotency-Key и телом — ответ из кэша (статус как у первого ответа, часто 201)."""
    _login(api_client, "demo")
    key = f"pytest-fr-idemp-{uuid.uuid4().hex}"
    rid = str(uuid.uuid4())
    body = {
        "id": rid,
        "title": "Идемпотентная заявка",
        "amount": "30",
        "currency": "UZS",
        "status": "pending",
        "requesterId": "demo-user",
    }
    headers = {**browser_csrf_headers(api_client), "Idempotency-Key": key}
    r1 = api_client.post("/api/finance/requests", json=body, headers=headers)
    assert r1.status_code == 201, r1.text
    r2 = api_client.post("/api/finance/requests", json=body, headers=headers)
    assert r2.status_code == 201, r2.text
    assert r2.headers.get("X-Idempotent-Replayed") == "true"
    assert r2.json() == r1.json()
