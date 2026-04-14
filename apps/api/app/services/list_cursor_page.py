"""Непрозрачный cursor (Fernet) и seek-предикат для стабильной keyset-пагинации."""
from __future__ import annotations

import hashlib
import json
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from cryptography.fernet import InvalidToken
from sqlalchemy import Date, DateTime, Numeric, and_, false, or_
from sqlalchemy.sql import ColumnElement

from app.services.fernet_secrets import get_app_fernet

CURSOR_VERSION = 1


class ListCursorError(Exception):
    """Невалидный или подделанный курсор."""


def filter_fingerprint(parts: dict[str, Any]) -> str:
    """Короткий отпечаток фильтров/контекста (смена фильтров с тем же cursor → mismatch)."""
    blob = json.dumps(parts, default=str, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()[:32]


def encode_list_cursor(payload: dict[str, Any]) -> str:
    data = dict(payload)
    data["v"] = CURSOR_VERSION
    raw = json.dumps(data, default=str, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return get_app_fernet().encrypt(raw.encode("utf-8")).decode("ascii")


def decode_list_cursor(token: str) -> dict[str, Any]:
    s = (token or "").strip()
    if not s:
        raise ListCursorError("empty_cursor")
    try:
        raw = get_app_fernet().decrypt(s.encode("ascii")).decode("utf-8")
        data = json.loads(raw)
    except (InvalidToken, ValueError, json.JSONDecodeError, UnicodeError) as exc:
        raise ListCursorError("invalid_cursor") from exc
    if not isinstance(data, dict):
        raise ListCursorError("invalid_cursor_shape")
    if int(data.get("v", 0)) != CURSOR_VERSION:
        raise ListCursorError("cursor_version_mismatch")
    return data


def _serialize_cell(val: Any) -> Any:
    if val is None:
        return None
    if isinstance(val, Decimal):
        return format(val, "f")
    if isinstance(val, datetime | date):
        return val.isoformat()
    return val


def row_seek_values(columns: list[Any], row: Any) -> list[Any]:
    out: list[Any] = []
    for col in columns:
        key = getattr(col, "key", None) or getattr(col, "name", None)
        if key is None:
            raise ListCursorError("bad_column")
        val = getattr(row, key, None)
        out.append(_serialize_cell(val))
    return out


def coerce_seek_value(col: Any, raw: Any) -> Any:
    if raw is None:
        return None
    try:
        col_type = col.type
    except Exception:
        return raw
    if isinstance(col_type, Numeric):
        return Decimal(str(raw))
    if isinstance(col_type, DateTime):
        if isinstance(raw, datetime):
            return raw
        s = str(raw).replace("Z", "+00:00")
        return datetime.fromisoformat(s)
    if isinstance(col_type, Date):
        if isinstance(raw, date):
            return raw
        s = str(raw)[:10]
        return date.fromisoformat(s)
    return raw


def build_seek_after(
    columns: list[Any],
    directions: list[str],
    raw_values: list[Any],
) -> ColumnElement[bool]:
    if not (len(columns) == len(directions) == len(raw_values)):
        raise ListCursorError("cursor_values_len")
    coerced = [coerce_seek_value(columns[i], raw_values[i]) for i in range(len(columns))]
    n = len(columns)

    def suffix(i: int) -> ColumnElement[bool]:
        if i >= n:
            return false()
        col = columns[i]
        d = directions[i]
        v = coerced[i]
        asc_dir = d == "asc"
        if i == n - 1:
            if v is None:
                return col.is_(None)
            return col > v if asc_dir else col < v
        sub = suffix(i + 1)
        if v is None:
            return and_(col.is_(None), sub)
        gt = col > v if asc_dir else col < v
        eq = col == v
        return or_(gt, and_(eq, sub))

    return suffix(0)


def assert_cursor_matches(
    payload: dict[str, Any],
    *,
    resource: str,
    sort_parts: list[str],
    order_parts: list[str],
    fingerprint: str,
) -> list[Any]:
    if payload.get("r") != resource:
        raise ListCursorError("cursor_resource_mismatch")
    if payload.get("fh") != fingerprint:
        raise ListCursorError("cursor_filter_mismatch")
    if payload.get("sp") != sort_parts:
        raise ListCursorError("cursor_sort_mismatch")
    if payload.get("op") != order_parts:
        raise ListCursorError("cursor_order_mismatch")
    vals = payload.get("vals")
    if not isinstance(vals, list):
        raise ListCursorError("cursor_vals_missing")
    return vals
