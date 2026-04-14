"""ETag / 304 для JSON-списков (app.core.json_http_cache)."""
from __future__ import annotations

from starlette.requests import Request

from app.core.json_http_cache import json_body_etag, json_304_or_response, normalize_if_none_match


def test_normalize_if_none_match_strips_weak_and_quotes():
    assert normalize_if_none_match('W/"abc"') == "abc"
    assert normalize_if_none_match('"deadbeef"') == "deadbeef"
    assert normalize_if_none_match("  plain  ") == "plain"


def test_json_body_etag_stable_for_key_order():
    a = {"b": 1, "a": 2}
    b = {"a": 2, "b": 1}
    assert json_body_etag(a) == json_body_etag(b)


def test_json_304_when_if_none_match_matches():
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/x",
        "headers": [],
        "client": ("test", 0),
        "scheme": "http",
        "server": ("test", 80),
    }
    data = [{"id": "1", "name": "x"}]
    etag = json_body_etag(data)
    req = Request(
        {
            **scope,
            "headers": [(b"if-none-match", f'"{etag}"'.encode())],
        }
    )
    resp = json_304_or_response(req, data=data, max_age=60)
    assert resp.status_code == 304
    assert resp.headers["etag"] == f'"{etag}"'
    assert "max-age=60" in resp.headers.get("cache-control", "")


def test_json_200_when_no_or_wrong_if_none_match():
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/x",
        "headers": [],
        "client": ("test", 0),
        "scheme": "http",
        "server": ("test", 80),
    }
    data = [{"id": "1"}]
    etag = json_body_etag(data)

    r0 = json_304_or_response(Request(scope), data=data, max_age=300)
    assert r0.status_code == 200
    assert r0.headers["etag"] == f'"{etag}"'

    req_bad = Request(
        {
            **scope,
            "headers": [(b"if-none-match", b'"other"')],
        }
    )
    r1 = json_304_or_response(req_bad, data=data, max_age=300)
    assert r1.status_code == 200
