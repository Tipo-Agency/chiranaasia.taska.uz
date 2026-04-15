"""Автосопоставление расходов по выписке с заявками из утверждённого финпланирования."""

from __future__ import annotations

from datetime import UTC, date, datetime
from decimal import Decimal, InvalidOperation

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.finance import BankStatementLine, FinanceRequest, FinancialPlanning


def _is_commission_description(desc: str | None) -> bool:
    d = (desc or "").lower()
    return any(
        x in d
        for x in (
            "комис",
            "обслужив",
            "тариф",
            "за документ",
            "съёмк",
            "съемк",
            "плата",
        )
    )


def _parse_amount(s: str | None) -> Decimal:
    if not s:
        return Decimal("0")
    try:
        return Decimal(str(s).replace(",", ".").strip()).quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError):
        return Decimal("0")


def _parse_line_date(s: str | None) -> date | None:
    if not s or len(str(s).strip()) < 8:
        return None
    try:
        return date.fromisoformat(str(s).strip()[:10])
    except ValueError:
        return None


def _inn_in_text(inn: str | None, text: str | None) -> bool:
    if not inn or not str(inn).strip():
        return True
    digits_inn = "".join(c for c in str(inn) if c.isdigit())
    if len(digits_inn) < 5:
        return True
    compact = (text or "").replace(" ", "").replace("-", "")
    return digits_inn in compact


def _date_window_ok(inv_date: date | None, line_date: date | None, days: int = 10) -> bool:
    if inv_date is None or line_date is None:
        return True
    return abs((line_date - inv_date).days) <= days


async def auto_match_fp_expenses_to_paid(db: AsyncSession) -> int:
    """
    Заявки со статусом approved, входящие в утверждённое (не архивное) финпланирование:
    если в выписке есть расход (не комиссия) с той же суммой и (если задано) ИНН/дата счёта — status → paid.
    Возвращает число переведённых в paid заявок.
    """
    pl_result = await db.execute(
        select(FinancialPlanning).where(
            FinancialPlanning.status == "approved",
            FinancialPlanning.is_archived.is_(False),
        )
    )
    plannings = pl_result.scalars().all()
    allowed_ids: set[str] = set()
    for pl in plannings:
        raw = pl.request_ids
        if isinstance(raw, list):
            for x in raw:
                if x:
                    allowed_ids.add(str(x))

    if not allowed_ids:
        return 0

    req_result = await db.execute(
        select(FinanceRequest).where(
            FinanceRequest.id.in_(allowed_ids),
            FinanceRequest.status == "approved",
            FinanceRequest.is_archived.is_(False),
        )
    )
    requests = list(req_result.scalars().all())
    if not requests:
        return 0

    lines_result = await db.execute(select(BankStatementLine))
    out_lines: list[BankStatementLine] = []
    for ln in lines_result.scalars().all():
        if (ln.line_type or "") != "out":
            continue
        if _is_commission_description(ln.description):
            continue
        out_lines.append(ln)

    if not out_lines:
        return 0

    used_line_ids: set[str] = set()
    paid_count = 0
    now = datetime.now(UTC)

    for req in sorted(requests, key=lambda r: (r.amount or Decimal("0")), reverse=True):
        req_amt = (req.amount or Decimal("0")).quantize(Decimal("0.01"))
        if req_amt <= 0:
            continue
        inv_d = req.invoice_date
        inn = req.counterparty_inn

        for ln in out_lines:
            if ln.id in used_line_ids:
                continue
            line_amt = _parse_amount(ln.amount)
            if line_amt <= 0:
                continue
            if line_amt != req_amt:
                continue
            ld = _parse_line_date(ln.line_date)
            if not _inn_in_text(inn, ln.description):
                continue
            if not _date_window_ok(inv_d, ld):
                continue

            req.status = "paid"
            req.paid_at = now
            req.updated_at = now
            used_line_ids.add(ln.id)
            paid_count += 1
            break

    if paid_count:
        await db.flush()
    return paid_count
