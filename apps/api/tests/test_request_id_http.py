"""Корреляция X-Request-ID в ответе (smoke против живого API, см. conftest TEST_API_URL)."""
from __future__ import annotations


def test_health_echoes_x_request_id_header(api_client):
    rid = "pytest-req-id-echo-0001"
    r = api_client.get("/health", headers={"X-Request-ID": rid})
    assert r.status_code == 200
    assert r.headers.get("X-Request-ID") == rid


def test_error_json_includes_same_request_id_as_header(api_client):
    """413 от MaxRequestBody: тело ответа и заголовок согласованы с X-Request-ID клиента."""
    rid = "pytest-req-id-413-0002"
    big = b"x" * 6_000_000
    # POST /api/auth/login без CSRF (исключение), иначе до проверки размера не дойдём.
    r = api_client.post(
        "/api/auth/login",
        headers={
            "X-Request-ID": rid,
            "Content-Type": "application/json",
        },
        content=big,
    )
    assert r.status_code == 413
    assert r.headers.get("X-Request-ID") == rid
    body = r.json()
    assert body.get("request_id") == rid
