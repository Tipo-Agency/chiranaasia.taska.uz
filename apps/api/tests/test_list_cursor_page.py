"""Юнит-тесты keyset cursor: Fernet, seek-предикат (без поднятого HTTP-сервера)."""
from __future__ import annotations

import json
import os

# До импорта app.* — иначе get_settings() без обязательных env не поднимется.
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@127.0.0.1:5432/test")
os.environ.setdefault("SECRET_KEY", "unit-test-secret-key-min-32-chars-ok")
os.environ.setdefault("REDIS_URL", "redis://127.0.0.1:6379/0")

import pytest
from sqlalchemy import Column, Integer, MetaData, String, Table, select

from app.services.list_cursor_page import (
    ListCursorError,
    assert_cursor_matches,
    build_seek_after,
    decode_list_cursor,
    encode_list_cursor,
    filter_fingerprint,
)


def test_encode_decode_cursor_roundtrip_and_opaque_string():
    payload = {
        "r": "tasks",
        "sp": ["created_at", "id"],
        "op": ["desc", "desc"],
        "fh": filter_fingerprint({"a": 1}),
        "vals": ["2024-01-01T00:00:00+00:00", "uuid-here"],
    }
    token = encode_list_cursor(payload)
    assert isinstance(token, str)
    with pytest.raises(json.JSONDecodeError):
        json.loads(token)
    out = decode_list_cursor(token)
    assert out["r"] == "tasks"
    assert out["sp"] == ["created_at", "id"]
    assert out["vals"][-1] == "uuid-here"


def test_decode_garbage_raises():
    with pytest.raises(ListCursorError):
        decode_list_cursor("not-a-fernet-token")


def test_tampered_cursor_rejected():
    payload = {
        "r": "tasks",
        "sp": ["created_at", "id"],
        "op": ["desc", "desc"],
        "fh": filter_fingerprint({}),
        "vals": ["2024-01-01T00:00:00+00:00", "uuid-here"],
    }
    token = encode_list_cursor(payload)
    assert len(token) >= 2
    flip = "B" if token[-1] != "B" else "C"
    tampered = token[:-1] + flip
    with pytest.raises(ListCursorError) as exc:
        decode_list_cursor(tampered)
    assert exc.value.args[0] == "invalid_cursor"


def test_cursor_wrong_resource_raises():
    p = {
        "v": 1,
        "r": "tasks",
        "sp": ["x"],
        "op": ["asc"],
        "fh": "ab",
        "vals": [1, 2],
    }
    with pytest.raises(ListCursorError) as exc:
        assert_cursor_matches(
            p,
            resource="deals",
            sort_parts=["x"],
            order_parts=["asc"],
            fingerprint="ab",
        )
    assert exc.value.args[0] == "cursor_resource_mismatch"


def test_assert_cursor_matches_validates():
    p = {
        "v": 1,
        "r": "tasks",
        "sp": ["x"],
        "op": ["asc"],
        "fh": "ab",
        "vals": [1, 2],
    }
    assert_cursor_matches(
        p,
        resource="tasks",
        sort_parts=["x"],
        order_parts=["asc"],
        fingerprint="ab",
    )
    with pytest.raises(ListCursorError):
        assert_cursor_matches(
            p,
            resource="deals",
            sort_parts=["x"],
            order_parts=["asc"],
            fingerprint="ab",
        )


def test_build_seek_after_sql():
    md = MetaData()
    t = Table("t", md, Column("a", Integer), Column("b", String))
    a = t.c.a
    b = t.c.b
    pred = build_seek_after([a, b], ["asc", "asc"], [1, "z"])
    stmt = select(t).where(pred)
    compiled = str(stmt.compile(compile_kwargs={"literal_binds": True}))
    assert "t.a" in compiled and "t.b" in compiled


# Второй id для отчётов / регрессий keyset-пагинации.
test_encode_decode_cursor = test_encode_decode_cursor_roundtrip_and_opaque_string
test_cursor_wrong_resource = test_cursor_wrong_resource_raises
test_build_seek_after = test_build_seek_after_sql
