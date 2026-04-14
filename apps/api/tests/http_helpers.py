"""Общие HTTP-заголовки для smoke-тестов (CSRF + Origin)."""
from __future__ import annotations

import os

import httpx

TEST_BROWSER_ORIGIN = os.environ.get("TEST_BROWSER_ORIGIN", "http://localhost:3000")


def browser_csrf_headers(client: httpx.Client, *, json_body: bool = True) -> dict[str, str]:
    """После login в client.cookies есть csrf_token — для POST/PUT/PATCH/DELETE под /api."""
    csrf = client.cookies.get("csrf_token") or ""
    h: dict[str, str] = {"Origin": TEST_BROWSER_ORIGIN, "X-CSRF-Token": csrf}
    if json_body:
        h["Content-Type"] = "application/json"
    return h
