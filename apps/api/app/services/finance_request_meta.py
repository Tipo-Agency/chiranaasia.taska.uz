"""Встраивание departmentId / legacy paymentDate в текст comment (до выделенных колонок)."""

from __future__ import annotations

import re

_DEPARTMENT_RE = re.compile(r"\[departmentId:([0-9a-fA-F-]{36})\]\s*")
_PAYMENT_DATE_RE = re.compile(r"\[paymentDate:([0-9]{4}-[0-9]{2}-[0-9]{2})\]\s*")


def strip_embedded_tags(comment: str | None) -> str:
    s = (comment or "").strip()
    s = _DEPARTMENT_RE.sub("", s)
    s = _PAYMENT_DATE_RE.sub("", s)
    return s.strip()


def extract_department_id(comment: str | None) -> str | None:
    m = _DEPARTMENT_RE.search(comment or "")
    return m.group(1) if m else None


def extract_payment_date_tag(comment: str | None) -> str | None:
    m = _PAYMENT_DATE_RE.search(comment or "")
    return m.group(1) if m else None


def merge_comment_with_department_tag(*, user_comment: str | None, department_id: str | None) -> str:
    base = strip_embedded_tags(user_comment)
    parts: list[str] = []
    if base:
        parts.append(base)
    if department_id and str(department_id).strip():
        parts.append(f"[departmentId:{str(department_id).strip()}]")
    return "\n".join(parts).strip()
