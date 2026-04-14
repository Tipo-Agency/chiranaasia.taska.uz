"""Метрики админки: GET /api/admin/metrics/queues (smoke против живого API)."""


def test_admin_metrics_queues_requires_auth(api_client):
    r = api_client.get("/api/admin/metrics/queues")
    assert r.status_code == 401


def test_admin_metrics_queues_ok_for_demo_admin(api_client):
    login = api_client.post(
        "/api/auth/login",
        json={"login": "demo", "password": ""},
    )
    assert login.status_code == 200, login.text
    r = api_client.get("/api/admin/metrics/queues")
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data.get("inbox_messages_count"), int)
    assert isinstance(data.get("failed_deliveries_count"), int)
    assert isinstance(data.get("dlq_unresolved_count"), int)
    assert data["inbox_messages_count"] >= 0
    assert data["failed_deliveries_count"] >= 0
    assert data["dlq_unresolved_count"] >= 0
