"""Запрет правок «задним числом» для финпланирования и складских документов (кроме полного доступа)."""
from __future__ import annotations

from datetime import date, datetime
from typing import Any
from zoneinfo import ZoneInfo

from fastapi import HTTPException, status

from app.core.config import get_settings


def org_today() -> date:
    tzid = (get_settings().CALENDAR_EXPORT_TZID or "UTC").strip() or "UTC"
    try:
        tz = ZoneInfo(tzid)
    except Exception:
        tz = ZoneInfo("UTC")
    return datetime.now(tz).date()


def parse_yyyy_mm(period: str | None) -> tuple[int, int] | None:
    if not period:
        return None
    s = str(period).strip()
    if len(s) < 7:
        return None
    try:
        y = int(s[0:4])
        mo = int(s[5:7])
        if mo < 1 or mo > 12:
            return None
        return y, mo
    except ValueError:
        return None


def yyyy_mm_period_is_strictly_past(period: str | None) -> bool:
    """Период YYYY-MM строго раньше текущего календарного месяца (часовой пояс — CALENDAR_EXPORT_TZID)."""
    parsed = parse_yyyy_mm(period)
    if not parsed:
        return False
    t = org_today()
    return parsed < (t.year, t.month)


def calendar_year_is_strictly_past(year: str | None) -> bool:
    y_raw = str(year).strip()[:4] if year else ""
    if len(y_raw) != 4 or not y_raw.isdigit():
        return False
    return int(y_raw) < org_today().year


def parse_inventory_document_date(raw: str | None) -> date | None:
    if raw is None:
        return None
    s = str(raw).strip()
    if not s:
        return None
    head = s[:10]
    if len(head) == 7 and head[4] == "-":
        head = f"{head}-01"
    try:
        return date.fromisoformat(head)
    except ValueError:
        return None


def inventory_doc_date_is_strictly_past(raw: str | None) -> bool:
    d = parse_inventory_document_date(raw)
    if d is None:
        return False
    return d < org_today()


async def assert_may_edit_past_dated_entity(db, user) -> None:
    """
    Разрешает мутации сущностей в прошлом периоде/дате только при полном доступе RBAC
    (роль ``admin`` или право ``system.full_access``).
    """
    from app.services.rbac import user_has_permission

    if await user_has_permission(db, user, "system.full_access"):
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="past_dated_entity_edit_requires_full_access",
    )


async def guard_finance_yyyy_mm_mutation(
    db,
    user,
    *,
    is_new: bool,
    existing_period: str | None,
    payload_period: str | None,
    period_explicit_in_payload: bool,
) -> None:
    """Документы с периодом YYYY-MM: прошлые месяцы — только полный доступ."""
    if not is_new and existing_period and yyyy_mm_period_is_strictly_past(existing_period):
        await assert_may_edit_past_dated_entity(db, user)
        return
    if is_new and payload_period and yyyy_mm_period_is_strictly_past(payload_period):
        await assert_may_edit_past_dated_entity(db, user)
        return
    if (
        not is_new
        and period_explicit_in_payload
        and payload_period
        and yyyy_mm_period_is_strictly_past(payload_period)
    ):
        await assert_may_edit_past_dated_entity(db, user)


async def guard_inventory_dated_mutation(db, user, *, existing_date: str | None, effective_date: str | None) -> None:
    """Движения и ревизии: дата документа раньше «сегодня» в TZ организации — только полный доступ."""
    if existing_date and inventory_doc_date_is_strictly_past(existing_date):
        await assert_may_edit_past_dated_entity(db, user)
        return
    if effective_date and inventory_doc_date_is_strictly_past(effective_date):
        await assert_may_edit_past_dated_entity(db, user)


def stock_movement_effective_date_field(m: Any, existing: Any) -> str:
    fs = getattr(m, "model_fields_set", frozenset())
    if "date" in fs and str(getattr(m, "date", "") or "").strip():
        return str(m.date).strip()
    if existing is not None:
        return (getattr(existing, "date", None) or "").strip()
    return str(getattr(m, "date", "") or "").strip()


def inventory_revision_effective_date_field(r: Any, existing: Any) -> str:
    fs = getattr(r, "model_fields_set", frozenset())
    if "date" in fs and str(getattr(r, "date", "") or "").strip():
        return str(r.date).strip()
    if existing is not None:
        return (getattr(existing, "date", None) or "").strip()
    return str(getattr(r, "date", "") or "").strip()
