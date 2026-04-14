"""Токен iCal-фида: длина, алфавит, разбор; единый 404 без утечки причины."""

from __future__ import annotations

import re

import pytest
from fastapi import HTTPException

from app.core.calendar_export_token import (
    generate_calendar_export_token,
    parse_calendar_feed_token_segment,
)


def test_generate_token_is_long_and_urlsafe():
    t = generate_calendar_export_token()
    assert len(t) >= 43
    assert len(t) <= 86
    assert re.fullmatch(r"[A-Za-z0-9_-]+", t)


def test_parse_accepts_strong_token_with_ics_suffix():
    t = generate_calendar_export_token()
    assert parse_calendar_feed_token_segment(f"{t}.ics") == t


def test_parse_accepts_legacy_uuid():
    u = "550e8400-e29b-41d4-a716-446655440000"
    assert parse_calendar_feed_token_segment(u) == u
    assert parse_calendar_feed_token_segment(f"{u}.ics") == u


@pytest.mark.parametrize(
    "raw",
    [
        "",
        "ab",
        "not-a-uuid-and-too-short",
        "550e8400-e29b-41d4-a716-44665544000g",  # bad hex
        "a" * 42,  # below strong minimum
        ("z" * 42) + "!",  # strong length but invalid charset
        "a" * 200,  # too long
    ],
)
def test_parse_rejects_invalid_with_404(raw: str):
    with pytest.raises(HTTPException) as exc:
        parse_calendar_feed_token_segment(raw)
    assert exc.value.status_code == 404
    assert exc.value.detail == "feed_not_found"
