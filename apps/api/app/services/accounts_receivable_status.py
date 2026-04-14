"""Авто-статус дебиторки: pending / partial / paid / overdue (только расчёт на бэкенде)."""

from __future__ import annotations

from datetime import UTC, date, datetime
from decimal import Decimal, InvalidOperation


def utc_today() -> date:
    return datetime.now(UTC).date()


def parse_money_decimal(raw: object | None) -> Decimal:
    if raw is None:
        return Decimal("0")
    if isinstance(raw, Decimal):
        return raw.quantize(Decimal("0.01"))
    s = str(raw).strip().replace(" ", "").replace(",", ".")
    if not s:
        return Decimal("0")
    try:
        return Decimal(s).quantize(Decimal("0.01"))
    except InvalidOperation:
        return Decimal("0")


def parse_due_date(raw: object | None) -> date | None:
    if raw is None:
        return None
    s = str(raw).strip()
    if not s:
        return None
    try:
        return date.fromisoformat(s[:10])
    except ValueError:
        return None


def compute_accounts_receivable_status(
    *,
    amount: Decimal,
    paid_amount: Decimal,
    due: date | None,
    today: date | None = None,
) -> str:
    """
    Правила (один итоговый статус):
    - ``paid`` — оплачено полностью (остаток <= 0).
    - ``overdue`` — есть долг и срок погашения уже прошёл (по календарной дате UTC).
    - ``partial`` — частично оплачено, срок ещё не наступил или сегодня / без даты.
    - ``pending`` — не оплачено, срок не просрочен (или дата срока не задана).
    """
    day = today if today is not None else utc_today()
    remaining = amount - paid_amount
    if remaining <= 0:
        return "paid"
    if due is not None and due < day:
        return "overdue"
    if paid_amount > 0:
        return "partial"
    return "pending"


def compute_ar_status_from_row_values(
    amount_raw: object | None,
    paid_amount_raw: object | None,
    due_date_raw: object | None,
    *,
    today: date | None = None,
) -> str:
    return compute_accounts_receivable_status(
        amount=parse_money_decimal(amount_raw),
        paid_amount=parse_money_decimal(paid_amount_raw),
        due=parse_due_date(due_date_raw),
        today=today,
    )
