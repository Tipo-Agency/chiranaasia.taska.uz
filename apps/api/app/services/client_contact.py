"""Нормализация телефона и email для клиентов."""
from __future__ import annotations

import re


def normalize_phone(raw: str | None) -> str | None:
    """Убирает пробелы, скобки, дефисы; сохраняет ведущий +; обрезает до 50 символов."""
    if raw is None:
        return None
    s = str(raw).strip()
    if not s:
        return None
    s = re.sub(r"[\s().\-]", "", s)
    if not s:
        return None
    if s.startswith("+"):
        body = re.sub(r"\+", "", s[1:])
        if not body:
            return None
        s = "+" + body
    else:
        s = re.sub(r"\+", "", s)
    return s[:50] if s else None


def normalize_email(raw: str | None) -> str | None:
    if raw is None:
        return None
    s = str(raw).strip().lower()
    return s[:255] if s else None


def normalize_client_tags(raw: list | None, *, max_items: int = 200) -> list[str]:
    if not raw or not isinstance(raw, list):
        return []
    out: list[str] = []
    for x in raw[:max_items]:
        t = str(x).strip()[:200]
        if t and t not in out:
            out.append(t)
    return out
