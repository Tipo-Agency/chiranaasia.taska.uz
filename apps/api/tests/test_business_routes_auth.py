"""Проверка обязательной аутентификации на бизнес-роутерах (без JWT → 401)."""


def test_deals_list_requires_auth(api_client):
    r = api_client.get("/api/deals")
    assert r.status_code == 401


def test_deals_get_requires_auth(api_client):
    r = api_client.get("/api/deals/00000000-0000-0000-0000-000000000001")
    assert r.status_code == 401


def test_tables_list_requires_auth(api_client):
    r = api_client.get("/api/tables")
    assert r.status_code == 401


def test_tables_public_content_plan_allows_anon(api_client):
    """Публичный контент-план остаётся без авторизации."""
    r = api_client.get("/api/tables/public/content-plan/any-id")
    assert r.status_code == 200
    body = r.json()
    assert "table" in body and "posts" in body
