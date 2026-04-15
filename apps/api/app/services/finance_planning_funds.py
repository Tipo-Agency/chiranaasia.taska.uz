"""Проверка лимитов фондов бюджета при одобрении заявки."""
from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.finance import FinanceRequest, FinancialPlanning


def parse_request_amount_uzs(amount: Any) -> Decimal:
    if amount is None:
        return Decimal(0)
    s = str(amount).strip().replace(" ", "").replace(",", ".")
    try:
        return Decimal(s)
    except InvalidOperation:
        return Decimal(0)


def _decimal_from_json(val: Any) -> Decimal:
    if val is None:
        return Decimal(0)
    try:
        return Decimal(str(val))
    except InvalidOperation:
        return Decimal(0)


def _approved_by_fund(
    planning: FinancialPlanning,
    *,
    request_by_id: dict[str, FinanceRequest],
    exclude_request_id: str | None = None,
) -> dict[str, Decimal]:
    out: dict[str, Decimal] = {}
    rids = planning.request_ids or []
    if not isinstance(rids, list):
        return out
    req_funds = planning.request_fund_ids if isinstance(planning.request_fund_ids, dict) else {}
    for rid in rids:
        rid_s = str(rid).strip()
        if not rid_s or (exclude_request_id and rid_s == exclude_request_id):
            continue
        req = request_by_id.get(rid_s)
        if not req or (str(req.status or "").strip().lower() != "approved"):
            continue
        fid = str(req_funds.get(rid_s) or "").strip()
        if not fid:
            continue
        out[fid] = out.get(fid, Decimal(0)) + parse_request_amount_uzs(req.amount)
    return out


async def assert_budget_fund_allows_approval(
    db: AsyncSession,
    *,
    finance_request_id: str,
    row: FinanceRequest,
) -> None:
    """Если заявка в бюджете — нужен фонд и достаточный остаток по fund_allocations."""
    amount = parse_request_amount_uzs(row.amount)
    plannings_r = await db.execute(select(FinancialPlanning))
    plannings = [p for p in plannings_r.scalars().all() if not (p.is_archived or False)]
    containing = [p for p in plannings if finance_request_id in (p.request_ids or [])]
    if not containing:
        return
    req_rows = list((await db.execute(select(FinanceRequest))).scalars().all())
    request_by_id = {str(r.id): r for r in req_rows}
    for pl in containing:
        rmap = pl.request_fund_ids if isinstance(pl.request_fund_ids, dict) else {}
        fid = str(rmap.get(finance_request_id) or "").strip()
        if not fid:
            raise HTTPException(status_code=400, detail="finance_request_budget_fund_required")
        alloc = _decimal_from_json((pl.fund_allocations or {}).get(fid) if isinstance(pl.fund_allocations, dict) else 0)
        used = _approved_by_fund(pl, request_by_id=request_by_id, exclude_request_id=finance_request_id)
        used_fid = used.get(fid, Decimal(0))
        if used_fid + amount > alloc + Decimal("0.01"):
            raise HTTPException(status_code=400, detail="finance_request_fund_insufficient")
