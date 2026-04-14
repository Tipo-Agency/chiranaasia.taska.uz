"""Лимиты slowapi: 429 и Retry-After. Имя `test_zu_*` — коллекция после `test_tasks` (логин 5/мин по IP)."""
import os
import uuid

import pytest


def test_auth_login_rate_limit_429_and_retry_after(api_client):
    """POST /api/auth/login: не более 5/мин с одного IP; 6-й — 429 + Retry-After.

    Историческое имя сценария — ``test_login_rate_limit``; в репозитории тест назван иначе.
    """
    for i in range(5):
        r = api_client.post(
            "/api/auth/login",
            json={"login": f"ratelimit-{i}-{uuid.uuid4().hex[:6]}", "password": "x"},
        )
        assert r.status_code in (401, 200), r.text

    r6 = api_client.post(
        "/api/auth/login",
        json={"login": f"ratelimit-extra-{uuid.uuid4().hex[:8]}", "password": "x"},
    )
    assert r6.status_code == 429, r6.text
    assert r6.headers.get("Retry-After"), "ожидается Retry-After (секунды или http-date)"
    body = r6.json()
    assert body.get("error") == "rate_limited"


@pytest.mark.skipif(
    not os.environ.get("TEST_SITE_LEADS_API_KEY") or not os.environ.get("TEST_SITE_LEADS_FUNNEL_READY"),
    reason="Нужны TEST_SITE_LEADS_API_KEY и TEST_SITE_LEADS_FUNNEL_READY=1",
)
def test_site_leads_rate_limit_429_and_retry_after(api_client):
    """POST /api/integrations/site/leads: 30/мин с IP; следующий — 429 + Retry-After."""
    key = os.environ.get("TEST_SITE_LEADS_API_KEY", "").strip()
    for i in range(30):
        phone_suffix = uuid.uuid4().hex[:12]
        body = {
            "name": "rl test",
            "phone": f"+7999{phone_suffix}"[:16],
            "email": f"rl-{phone_suffix}@example.invalid",
            "message": "x",
        }
        r = api_client.post(
            "/api/integrations/site/leads",
            json=body,
            headers={"X-Api-Key": key},
        )
        assert r.status_code in (201, 200), r.text

    r31 = api_client.post(
        "/api/integrations/site/leads",
        json={
            "name": "rl test",
            "phone": f"+7999{uuid.uuid4().hex[:12]}"[:16],
            "email": f"rl-{uuid.uuid4().hex}@example.invalid",
            "message": "x",
        },
        headers={"X-Api-Key": key},
    )
    assert r31.status_code == 429, r31.text
    assert r31.headers.get("Retry-After")
    assert r31.json().get("error") == "rate_limited"
