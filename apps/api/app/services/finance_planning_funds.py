"""Проверка лимитов бюджета по фондам (ключи fund_allocations = id справочника finance_categories)."""
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


def _bucket_id_for_request(
    planning: FinancialPlanning,
    rid_s: str,
    req: FinanceRequest | None,
) -> str:
    rmap = planning.request_fund_ids if isinstance(planning.request_fund_ids, dict) else {}
    mapped = str(rmap.get(rid_s) or "").strip()
    if mapped:
        return mapped
    if req:
        return str(req.category or "").strip()
    return ""


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
    for rid in rids:
        rid_s = str(rid).strip()
        if not rid_s or (exclude_request_id and rid_s == exclude_request_id):
            continue
        req = request_by_id.get(rid_s)
        if not req or (str(req.status or "").strip().lower() != "approved"):
            continue
        bid = _bucket_id_for_request(planning, rid_s, req)
        if not bid:
            continue
        out[bid] = out.get(bid, Decimal(0)) + parse_request_amount_uzs(req.amount)
    return out


async def assert_budget_fund_allows_approval(
    db: AsyncSession,
    *,
    finance_request_id: str,
    row: FinanceRequest,
) -> None:
    """Если заявка в бюджете — нужен фонд (категория) и достаточный остаток по fund_allocations."""
    amount = parse_request_amount_uzs(row.amount)
    plannings_r = await db.execute(select(FinancialPlanning))
    plannings = [p for p in plannings_r.scalars().all() if not (p.is_archived or False)]
    containing = [p for p in plannings if finance_request_id in (p.request_ids or [])]
    if not containing:
        return
    req_rows = list((await db.execute(select(FinanceRequest))).scalars().all())
    request_by_id = {str(r.id): r for r in req_rows}
    for pl in containing:
        bid = _bucket_id_for_request(pl, finance_request_id, row)
        if not bid:
            raise HTTPException(status_code=400, detail="finance_request_budget_category_required")
        alloc = _decimal_from_json((pl.fund_allocations or {}).get(bid) if isinstance(pl.fund_allocations, dict) else 0)
        used = _approved_by_fund(pl, request_by_id=request_by_id, exclude_request_id=finance_request_id)
        used_bid = used.get(bid, Decimal(0))
        if used_bid + amount > alloc + Decimal("0.01"):
            raise HTTPException(status_code=400, detail="finance_request_budget_insufficient")
