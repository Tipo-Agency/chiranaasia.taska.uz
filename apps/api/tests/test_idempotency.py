"""Idempotency-Key: Redis + hash тела; replay и 409 (POST /api/*)."""
import uuid

import pytest


def test_post_idempotency_replay_same_body(api_client):
    """Два POST с одним ключом и телом — второй ответ из кэша (X-Idempotent-Replayed)."""
    key = f"pytest-idemp-{uuid.uuid4().hex}"
    headers = {"Idempotency-Key": key}
    body = {"login": f"idemp-{uuid.uuid4().hex[:8]}", "password": "wrong"}
    r1 = api_client.post("/api/auth/login", json=body, headers=headers)
    assert r1.status_code in (401, 200), r1.text
    r2 = api_client.post("/api/auth/login", json=body, headers=headers)
    assert r2.status_code == r1.status_code, r2.text
    assert r2.headers.get("Idempotent-Replayed") == "true"
    assert r2.headers.get("X-Idempotent-Replayed") == "true"
    assert r2.json() == r1.json()


def test_post_idempotency_conflict_different_body(api_client):
    """Тот же ключ и другое тело — 409."""
    key = f"pytest-idemp-conflict-{uuid.uuid4().hex}"
    headers = {"Idempotency-Key": key}
    b1 = {"login": "user-a", "password": "x"}
    b2 = {"login": "user-b", "password": "x"}
    r1 = api_client.post("/api/auth/login", json=b1, headers=headers)
    assert r1.status_code in (401, 200), r1.text
    r2 = api_client.post("/api/auth/login", json=b2, headers=headers)
    assert r2.status_code == 409, r2.text
    data = r2.json()
    assert data.get("error") == "idempotency_conflict"


def test_post_idempotency_same_key_different_path_no_false_replay(api_client):
    """Один Idempotency-Key на разных путях не отдаёт чужой replay."""
    key = f"pytest-idemp-scope-{uuid.uuid4().hex}"
    login_body = {"login": "scope-user", "password": "wrong-pass"}
    r1 = api_client.post("/api/auth/login", json=login_body, headers={"Idempotency-Key": key})
    assert r1.status_code == 401, r1.text
    r2 = api_client.post(
        "/api/auth/refresh",
        json={"refresh_token": "x" * 12},
        headers={"Idempotency-Key": key},
    )
    assert r2.status_code == 401, r2.text
    assert r2.headers.get("Idempotent-Replayed") != "true"
    assert r2.headers.get("X-Idempotent-Replayed") != "true"
