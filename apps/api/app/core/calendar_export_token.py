"""Генерация и разбор токена публичного iCal-фида (долгий случайный секрет, без перебора)."""

from __future__ import annotations

import re
import secrets

from fastapi import HTTPException

# 48 байт → base64url без padding ~64 символа, ~384 бита энтропии (перебор практически невозможен).
_EXPORT_TOKEN_BYTES = 48

_LEGACY_UUID_RE = re.compile(
    r"^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$",
    re.IGNORECASE,
)
# Длина token_urlsafe(n) = ceil(4n/3) без padding; 32..64 байт → 43..86 символов.
_STRONG_TOKEN_RE = re.compile(r"^[A-Za-z0-9_-]{43,86}$")


def generate_calendar_export_token() -> str:
    return secrets.token_urlsafe(_EXPORT_TOKEN_BYTES)


def parse_calendar_feed_token_segment(raw: str) -> str:
    """
    Нормализует сегмент пути (с опциональным суффиксом .ics).
    Любая ошибка формата — 404 feed_not_found (без утечки «неверный формат» vs «нет пользователя»).
    """
    base = (raw or "").strip()
    if base.endswith(".ics"):
        base = base[:-4]
    if not base or len(base) > 128:
        raise HTTPException(status_code=404, detail="feed_not_found")
    if _LEGACY_UUID_RE.fullmatch(base):
        return base
    if _STRONG_TOKEN_RE.fullmatch(base):
        return base
    raise HTTPException(status_code=404, detail="feed_not_found")
