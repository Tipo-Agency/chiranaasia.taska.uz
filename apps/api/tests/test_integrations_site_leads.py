"""Site leads: нормализация контактов; опционально — HTTP 201/200/401 (нужен живой API и ключ)."""
import os
import uuid

import pytest
from pydantic import ValidationError

from app.api.routers.integrations_site import (
    _normalize_email_for_dedup,
    _normalize_phone_for_dedup,
)
from app.schemas.integrations import SiteLeadPayload


def test_normalize_phone_strips_non_digits():
    assert _normalize_phone_for_dedup("+998 (90) 123-45-67") == "998901234567"
    assert _normalize_phone_for_dedup("") == ""


def test_normalize_email_lowercase():
    assert _normalize_email_for_dedup("  User@Example.COM ") == "user@example.com"


def test_site_lead_payload_extra_forbidden():
    with pytest.raises(ValidationError):
        SiteLeadPayload.model_validate(
            {"phone": "+79990001122", "unknownField": "x"},
        )


def test_site_lead_utm_extra_forbidden():
    with pytest.raises(ValidationError):
        SiteLeadPayload.model_validate(
            {"phone": "+79990001122", "utm": {"source": "g", "evil": True}},
        )


@pytest.mark.integration
@pytest.mark.skipif(
    not os.environ.get("TEST_SITE_LEADS_API_KEY") or not os.environ.get("TEST_SITE_LEADS_FUNNEL_READY"),
    reason="Задайте TEST_SITE_LEADS_API_KEY и TEST_SITE_LEADS_FUNNEL_READY=1 (воронка с site.enabled и активным ключом).",
)
def test_site_leads_201_then_200_duplicate_and_401_bad_key(api_client):
    """POST /api/integrations/site/leads: 201 → 200 duplicate → 401 неверный ключ."""
    key = os.environ.get("TEST_SITE_LEADS_API_KEY", "").strip()
    phone_suffix = uuid.uuid4().hex[:10]
    phone = f"+7000{phone_suffix}"
    body = {
        "name": "pytest site lead",
        "phone": phone,
        "email": f"pytest-{phone_suffix}@example.invalid",
        "message": "hi",
    }
    r1 = api_client.post(
        "/api/integrations/site/leads",
        json=body,
        headers={"X-Api-Key": key},
    )
    assert r1.status_code == 201, r1.text
    data1 = r1.json()
    assert data1.get("ok") is True
    assert data1.get("duplicate") is False
    assert data1.get("dealId")

    r2 = api_client.post(
        "/api/integrations/site/leads",
        json=body,
        headers={"X-Api-Key": key},
    )
    assert r2.status_code == 200, r2.text
    data2 = r2.json()
    assert data2.get("duplicate") is True
    assert data2.get("dealId") == data1.get("dealId")

    r3 = api_client.post(
        "/api/integrations/site/leads",
        json=body,
        headers={"X-Api-Key": key + "wrong"},
    )
    assert r3.status_code == 401
