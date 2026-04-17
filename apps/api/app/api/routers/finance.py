"""Finance router - categories, funds, plan, requests, bank statements, income reports."""
from __future__ import annotations

from datetime import UTC, date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user, require_permission
from app.core.optimistic_version import (
    commit_or_stale_version_conflict,
    enforce_expected_version_row,
    merge_expected_version,
    parse_if_match_header,
)
from app.core.permissions import PERM_FINANCE_APPROVE
from app.db import get_db
from app.models.finance import (
    BankStatement,
    BankStatementLine,
    Bdr,
    FinanceCategory,
    FinancePlan,
    FinanceReconciliationGroup,
    FinanceRequest,
    FinancialPlanDocument,
    FinancialPlanning,
    Fund,
    IncomeReport,
)
from app.models.user import User
from app.schemas.common_responses import OkResponse
from app.schemas.finance_api import (
    BankStatementRead,
    BdrGetResponse,
    FinanceCategoryRead,
    FinanceFundRead,
    FinancePlanRowRead,
    FinanceReconciliationGroupRead,
    FinancialPlanDocumentRead,
    FinancialPlanningRead,
    IncomeReportRead,
)
from app.schemas.finance_bulk import (
    BankStatementItem,
    BdrPutBody,
    FinanceCategoryItem,
    FinancePlanUpsert,
    FinanceReconciliationGroupItem,
    FinancialPlanDocItem,
    FinancialPlanningItem,
    FundItem,
    IncomeReportItem,
)
from app.schemas.finance_requests import (
    FinanceRequestCreate,
    FinanceRequestListResponse,
    FinanceRequestPatch,
    FinanceRequestRead,
)
from app.services.audit_log import log_mutation
from app.services.bdr_totals import bdr_get_response, sanitize_bdr_rows
from app.services.domain_events import log_entity_mutation
from app.services.finance_fp_expense_match import auto_match_fp_expenses_to_paid
from app.services.finance_planning_funds import assert_budget_fund_allows_approval
from app.services.finance_request_workflow import normalize_status
from app.services.finance_requests_service import (
    apply_finance_request_patch,
    assert_finance_request_patch_respects_lock,
    finance_request_to_read,
    insert_finance_request_row,
    list_finance_requests,
    new_finance_request_id,
    reject_comment_provided,
)
from app.services.list_cursor_page import (
    ListCursorError,
    assert_cursor_matches,
    build_seek_after,
    decode_list_cursor,
    encode_list_cursor,
    filter_fingerprint,
    row_seek_values,
)
from app.services.past_entity_edit_guard import (
    assert_may_edit_past_dated_entity,
    calendar_year_is_strictly_past,
    guard_finance_yyyy_mm_mutation,
)

router = APIRouter(prefix="/finance", tags=["finance"], dependencies=[Depends(get_current_user)])

require_finance_approve = require_permission(PERM_FINANCE_APPROVE, detail="finance_approve_required")
require_finance_approve_mark_paid = require_permission(PERM_FINANCE_APPROVE, detail="finance_mark_paid_required")


def _norm_finance_approval_status(raw: str | None) -> str:
    return (str(raw).strip().lower() if raw is not None and str(raw).strip() != "" else "")


def _finance_plan_doc_payload_requires_approve(
    prev: FinancialPlanDocument | None,
    d: FinancialPlanDocItem,
) -> bool:
    """Смена в статус approved или выставление approvedBy/approvedAt — только с правом finance.approve."""
    data = d.model_dump(exclude_unset=True)
    if prev is None:
        if _norm_finance_approval_status(d.status) == "approved":
            return True
        if d.approvedBy or d.approvedAt:
            return True
        return False
    prev_st = _norm_finance_approval_status(prev.status)
    if "status" in data:
        if _norm_finance_approval_status(d.status) == "approved" and prev_st != "approved":
            return True
    if "approvedBy" in data:
        nb = d.approvedBy
        if nb and (not prev.approved_by or str(nb) != str(prev.approved_by)):
            return True
    if "approvedAt" in data:
        na = d.approvedAt
        if na and (not prev.approved_at or str(na) != str(prev.approved_at)):
            return True
    return False


def _financial_planning_payload_requires_approve(prev: FinancialPlanning | None, p: FinancialPlanningItem) -> bool:
    data = p.model_dump(exclude_unset=True)
    if prev is None:
        if _norm_finance_approval_status(p.status) == "approved":
            return True
        if p.approvedBy or p.approvedAt:
            return True
        return False
    prev_st = _norm_finance_approval_status(prev.status)
    if "status" in data:
        if _norm_finance_approval_status(p.status) == "approved" and prev_st != "approved":
            return True
    if "approvedBy" in data:
        nb = p.approvedBy
        if nb and (not prev.approved_by or str(nb) != str(prev.approved_by)):
            return True
    if "approvedAt" in data:
        na = p.approvedAt
        if na and (not prev.approved_at or str(na) != str(prev.approved_at)):
            return True
    return False


def _request_id(request: Request) -> str | None:
    return getattr(request.state, "request_id", None)


def row_to_category(row):
    return {
        "id": row.id,
        "name": row.name,
        "type": row.type,
        "value": float(row.value) if row.value and str(row.value).replace(".", "").isdigit() else row.value,
        "color": row.color,
    }


def row_to_fund(row):
    return {
        "id": row.id,
        "name": row.name,
        "order": int(row.order_val) if row.order_val and str(row.order_val).isdigit() else row.order_val,
        "isArchived": row.is_archived or False,
    }


def row_to_plan(row):
    return {
        "id": row.id,
        "period": row.period,
        "salesPlan": float(row.sales_plan) if row.sales_plan and str(row.sales_plan).replace(".", "").isdigit() else row.sales_plan,
        "currentIncome": float(row.current_income) if row.current_income and str(row.current_income).replace(".", "").isdigit() else row.current_income,
    }


def row_to_plan_doc(row):
    wb = getattr(row, "week_breakdown", None)
    return {
        "id": row.id,
        "departmentId": row.department_id,
        "period": row.period,
        "income": float(row.income) if row.income and str(row.income).replace(".", "").isdigit() else row.income,
        "expenses": row.expenses or {},
        "status": row.status,
        "createdAt": row.created_at,
        "updatedAt": row.updated_at,
        "approvedBy": row.approved_by,
        "approvedAt": row.approved_at,
        "isArchived": row.is_archived or False,
        "periodStart": getattr(row, "period_start", None),
        "periodEnd": getattr(row, "period_end", None),
        "planSeriesId": getattr(row, "plan_series_id", None),
        "periodLabel": getattr(row, "period_label", None),
        "weekBreakdown": wb if isinstance(wb, list) else None,
    }


def _planning_merged_document_ids(row: FinancialPlanning) -> list[str]:
    raw = list(row.plan_document_ids or []) if getattr(row, "plan_document_ids", None) is not None else []
    pid = (row.plan_document_id or "").strip()
    if pid and pid not in raw:
        return [pid, *raw]
    if not raw and pid:
        return [pid]
    return raw


def _planning_merged_income_report_ids(row: FinancialPlanning | None) -> list[str]:
    if row is None:
        return []
    raw = list(row.income_report_ids or []) if getattr(row, "income_report_ids", None) is not None else []
    out: list[str] = []
    for x in raw:
        s = str(x).strip()
        if s and s not in out:
            out.append(s)
    single = (getattr(row, "income_report_id", None) or "").strip()
    if single and single not in out:
        out.insert(0, single)
    return out


def row_to_planning(row):
    return {
        "id": row.id,
        "departmentId": row.department_id,
        "period": row.period,
        "planDocumentId": row.plan_document_id,
        "income": float(row.income) if row.income and str(row.income).replace(".", "").isdigit() else row.income,
        "fundAllocations": row.fund_allocations or {},
        "requestFundIds": row.request_fund_ids or {},
        "requestIds": row.request_ids or [],
        "status": row.status,
        "createdAt": row.created_at,
        "updatedAt": row.updated_at,
        "approvedBy": row.approved_by,
        "approvedAt": row.approved_at,
        "notes": row.notes,
        "isArchived": row.is_archived or False,
        "periodStart": getattr(row, "period_start", None),
        "periodEnd": getattr(row, "period_end", None),
        "planDocumentIds": _planning_merged_document_ids(row),
        "incomeReportId": getattr(row, "income_report_id", None),
        "incomeReportIds": _planning_merged_income_report_ids(row),
        "fundMovements": list(getattr(row, "fund_movements", None) or []),
        "expenseDistribution": getattr(row, "expense_distribution", None) or {},
    }


def _planning_status_locks_income_report(st: str | None) -> bool:
    return (st or "").strip().lower() in ("conducted", "approved")


async def _validate_income_reports_for_planning(db: AsyncSession, *, planning_id: str, report_ids: list[str]) -> None:
    for rid in report_ids:
        ir = await db.get(IncomeReport, rid)
        if not ir:
            raise HTTPException(status_code=400, detail="income_report_not_found")
        lock = (ir.locked_by_planning_id or "").strip()
        if lock and lock != planning_id:
            raise HTTPException(status_code=400, detail="income_report_already_used_in_budget")


async def _sync_income_report_locks_for_planning(
    db: AsyncSession,
    *,
    planning_id: str,
    row: FinancialPlanning,
) -> None:
    new_st = (row.status or "").strip().lower()
    locks = _planning_status_locks_income_report(new_st)
    new_ids = set(_planning_merged_income_report_ids(row))

    if not locks:
        await db.execute(
            update(IncomeReport)
            .where(IncomeReport.locked_by_planning_id == planning_id)
            .values(locked_by_planning_id=None)
        )
        return

    stray_r = await db.execute(select(IncomeReport).where(IncomeReport.locked_by_planning_id == planning_id))
    for ir in stray_r.scalars().all():
        if ir.id not in new_ids:
            ir.locked_by_planning_id = None

    for rid in sorted(new_ids):
        ir = await db.get(IncomeReport, rid)
        if ir:
            ir.locked_by_planning_id = planning_id


@router.get("/categories", response_model=list[FinanceCategoryRead])
async def get_categories(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(FinanceCategory))
    rows = result.scalars().all()
    if not rows:
        from app.core.seed_data import DEFAULT_FINANCE_CATEGORIES
        return DEFAULT_FINANCE_CATEGORIES
    return [row_to_category(r) for r in rows]


@router.put("/categories", response_model=OkResponse)
async def update_categories(categories: list[FinanceCategoryItem], db: AsyncSession = Depends(get_db)):
    for c in categories:
        cid = c.id
        if not cid:
            continue
        existing = await db.get(FinanceCategory, cid)
        is_new = existing is None
        if existing:
            existing.name = c.name or existing.name
            existing.type = c.type or existing.type
            existing.value = str(c.value) if c.value is not None else None
            existing.color = c.color
        else:
            db.add(FinanceCategory(
                id=cid,
                name=c.name or "",
                type=c.type or "fixed",
                value=str(c.value) if c.value is not None else None,
                color=c.color,
            ))
        await db.flush()
        await log_entity_mutation(
            db,
            event_type="finance.category.created" if is_new else "finance.category.updated",
            entity_type="finance_category",
            entity_id=cid,
            source="finance-router",
            payload={"name": c.name},
        )
    await db.commit()
    return {"ok": True}


@router.get("/funds", response_model=list[FinanceFundRead])
async def get_funds(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Fund).where(Fund.is_archived.is_(False)))
    rows = result.scalars().all()
    if not rows:
        from app.core.seed_data import DEFAULT_FUNDS
        return sorted(DEFAULT_FUNDS, key=lambda x: x.get("order", 0))
    return sorted([row_to_fund(r) for r in rows], key=lambda x: x.get("order", 0))


@router.put("/funds", response_model=OkResponse)
async def update_funds(funds: list[FundItem], db: AsyncSession = Depends(get_db)):
    for f in funds:
        fid = f.id
        if not fid:
            continue
        existing = await db.get(Fund, fid)
        is_new = existing is None
        if existing:
            existing.name = f.name or existing.name
            existing.order_val = str(f.order)
            existing.is_archived = f.isArchived
        else:
            db.add(Fund(
                id=fid,
                name=f.name or "",
                order_val=str(f.order),
                is_archived=f.isArchived,
            ))
        await db.flush()
        await log_entity_mutation(
            db,
            event_type="finance.fund.created" if is_new else "finance.fund.updated",
            entity_type="fund",
            entity_id=fid,
            source="finance-router",
            payload={"name": f.name},
        )
    await db.commit()
    return {"ok": True}


@router.get("/plan", response_model=FinancePlanRowRead | None)
async def get_plan(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(FinancePlan).limit(1))
    row = result.scalar_one_or_none()
    if not row:
        return None
    return row_to_plan(row)


@router.put("/plan", response_model=OkResponse)
async def update_plan(plan: FinancePlanUpsert, db: AsyncSession = Depends(get_db)):
    pid = plan.id or "default"
    result = await db.execute(select(FinancePlan).limit(1))
    row = result.scalar_one_or_none()
    if row:
        row.period = plan.period or row.period
        row.sales_plan = str(plan.salesPlan if plan.salesPlan is not None else row.sales_plan)
        row.current_income = str(plan.currentIncome if plan.currentIncome is not None else row.current_income)
        entity_id = row.id
    else:
        db.add(FinancePlan(
            id=pid,
            period=plan.period or "month",
            sales_plan=str(plan.salesPlan if plan.salesPlan is not None else 0),
            current_income=str(plan.currentIncome if plan.currentIncome is not None else 0),
        ))
        entity_id = pid
    await db.flush()
    await log_entity_mutation(
        db,
        event_type="finance.plan.updated",
        entity_type="finance_plan",
        entity_id=entity_id,
        source="finance-router",
        payload={"period": plan.period},
    )
    await db.commit()
    return {"ok": True}


_DEFAULT_REQ_LIMIT = 50
_MAX_REQ_LIMIT = 500


def _finance_requests_fingerprint(
    *,
    status: str | None,
    category: str | None,
    date_from: date | None,
    date_to: date | None,
) -> str:
    return filter_fingerprint(
        {
            "status": (status or "").strip(),
            "category": (category or "").strip(),
            "date_from": date_from.isoformat() if date_from else "",
            "date_to": date_to.isoformat() if date_to else "",
        }
    )


@router.get("/requests", response_model=FinanceRequestListResponse)
async def list_finance_requests_endpoint(
    db: AsyncSession = Depends(get_db),
    status: str | None = None,
    category: str | None = None,
    on_date: Annotated[date | None, Query(alias="date")] = None,
    date_from: Annotated[date | None, Query(alias="dateFrom")] = None,
    date_to: Annotated[date | None, Query(alias="dateTo")] = None,
    limit: Annotated[int, Query(ge=1, le=_MAX_REQ_LIMIT)] = _DEFAULT_REQ_LIMIT,
    cursor: str | None = None,
):
    """Список заявок с фильтрами и пагинацией. Параметр ``date`` — один календарный день по ``created_at`` (UTC)."""
    d0 = d1 = None
    if on_date is not None:
        d0 = d1 = on_date
    else:
        d0 = date_from
        d1 = date_to
    sp = ["created_at", "id"]
    op = ["desc", "desc"]
    cols = [FinanceRequest.created_at, FinanceRequest.id]
    dirs = ["desc", "desc"]
    fh = _finance_requests_fingerprint(status=status, category=category, date_from=d0, date_to=d1)
    seek = None
    if cursor and cursor.strip():
        try:
            payload = decode_list_cursor(cursor)
            vals = assert_cursor_matches(
                payload,
                resource="finance_requests",
                sort_parts=sp,
                order_parts=op,
                fingerprint=fh,
            )
            seek = build_seek_after(cols, dirs, vals)
        except ListCursorError:
            raise HTTPException(status_code=400, detail="invalid_cursor") from None
    rows, total = await list_finance_requests(
        db,
        status=status,
        category=category,
        date_from=d0,
        date_to=d1,
        limit=limit,
        seek_after=seek,
    )
    items = [finance_request_to_read(r) for r in rows]
    next_c = None
    if rows and len(rows) == limit:
        next_c = encode_list_cursor(
            {
                "r": "finance_requests",
                "sp": sp,
                "op": op,
                "fh": fh,
                "vals": row_seek_values(cols, rows[-1]),
            }
        )
    return FinanceRequestListResponse(items=items, total=total, limit=limit, next_cursor=next_c)


@router.post("/requests", response_model=FinanceRequestRead, status_code=201)
async def create_finance_request_endpoint(
    body: FinanceRequestCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(UTC)
    new_id = new_finance_request_id(body)
    existing = await db.get(FinanceRequest, new_id)
    if existing:
        raise HTTPException(status_code=409, detail="finance_request_id_conflict")
    row = insert_finance_request_row(new_id=new_id, data=body, now=now)
    db.add(row)
    await db.flush()
    await log_entity_mutation(
        db,
        event_type="purchase_request.created",
        entity_type="purchase_request",
        entity_id=new_id,
        source="finance-router",
        actor_id=body.requester_id or body.requested_by,
        payload={"title": row.title, "amount": str(row.amount), "status": row.status, "requesterId": row.requested_by or body.requester_id},
    )
    await log_mutation(
        db,
        "create",
        "finance_request",
        new_id,
        actor_id=body.requester_id or body.requested_by,
        source="finance-router",
        request_id=_request_id(request),
        payload={"status": row.status, "amount": str(row.amount), "is_archived": row.is_archived},
    )
    await db.commit()
    await db.refresh(row)
    return finance_request_to_read(row)


@router.patch("/requests/{finance_request_id}", response_model=FinanceRequestRead)
async def patch_finance_request_endpoint(
    finance_request_id: str,
    body: FinanceRequestPatch,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    if_match: str | None = Header(default=None, alias="If-Match"),
):
    row = await db.get(FinanceRequest, finance_request_id)
    if not row:
        raise HTTPException(status_code=404, detail="finance_request_not_found")
    exp = merge_expected_version(
        if_match=parse_if_match_header(if_match),
        body_version=body.version if "version" in body.model_fields_set else None,
    )
    enforce_expected_version_row(row_version=int(row.version), expected=exp)
    assert_finance_request_patch_respects_lock(row, body)
    if not (body.model_fields_set - {"version"}):
        return finance_request_to_read(row)

    prev_status = row.status
    prev_n = normalize_status(prev_status)
    fs = body.model_fields_set
    if "status" in fs and body.status is not None:
        new_n = normalize_status(str(body.status))
        if prev_n == "pending" and new_n in ("approved", "rejected"):
            await require_finance_approve(current_user=current_user, db=db)
            if new_n == "rejected" and not reject_comment_provided(body):
                raise HTTPException(status_code=400, detail="finance_request_reject_comment_required")
        if prev_n == "approved" and new_n == "paid":
            await require_finance_approve_mark_paid(current_user=current_user, db=db)

    now = datetime.now(UTC)
    apply_finance_request_patch(row, body, now=now, actor_user_id=current_user.id)
    if prev_n == "pending" and normalize_status(row.status) == "approved":
        await assert_budget_fund_allows_approval(db, finance_request_id=finance_request_id, row=row)
    await db.flush()
    await log_entity_mutation(
        db,
        event_type="purchase_request.updated",
        entity_type="purchase_request",
        entity_id=finance_request_id,
        source="finance-router",
        actor_id=current_user.id,
        payload={"title": row.title, "amount": str(row.amount), "status": row.status},
    )
    if normalize_status(prev_status) != normalize_status(row.status):
        await log_entity_mutation(
            db,
            event_type="purchase_request.status.changed",
            entity_type="purchase_request",
            entity_id=finance_request_id,
            source="finance-router",
            actor_id=current_user.id,
            payload={"fromStatus": prev_status, "toStatus": row.status, "title": row.title, "requesterId": row.requested_by},
        )
    audit_payload: dict = {
        "status": row.status,
        "amount": str(row.amount),
        "is_archived": row.is_archived,
    }
    if prev_n != normalize_status(row.status):
        audit_payload["previous_status"] = prev_status
        audit_payload["new_status"] = row.status
        cur_n = normalize_status(row.status)
        if prev_n == "pending" and cur_n == "approved":
            audit_payload["decision"] = "approved"
        elif prev_n == "pending" and cur_n == "rejected":
            audit_payload["decision"] = "rejected"
            if reject_comment_provided(body):
                c = body.comment if "comment" in fs and body.comment is not None else body.description
                preview = (str(c).strip()[:500] if c is not None else "")
                if preview:
                    audit_payload["reject_comment_preview"] = preview
        elif prev_n == "approved" and cur_n == "paid":
            audit_payload["decision"] = "marked_paid"
    await log_mutation(
        db,
        "update",
        "finance_request",
        finance_request_id,
        actor_id=current_user.id,
        source="finance-router",
        request_id=_request_id(request),
        payload=audit_payload,
    )
    await commit_or_stale_version_conflict(db)
    await db.refresh(row)
    return finance_request_to_read(row)


@router.get("/financial-plan-documents", response_model=list[FinancialPlanDocumentRead])
async def get_financial_plan_documents(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(FinancialPlanDocument))
    return [row_to_plan_doc(r) for r in result.scalars().all()]


@router.put("/financial-plan-documents", response_model=OkResponse)
async def update_financial_plan_documents(
    docs: list[FinancialPlanDocItem],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    items: list[tuple[FinancialPlanDocItem, FinancialPlanDocument | None]] = []
    for d in docs:
        did = d.id
        if not did:
            continue
        existing = await db.get(FinancialPlanDocument, did)
        items.append((d, existing))
    if any(_finance_plan_doc_payload_requires_approve(ex, d) for d, ex in items):
        await require_finance_approve(current_user=current_user, db=db)
    for d, existing in items:
        did = d.id
        is_new = existing is None
        await guard_finance_yyyy_mm_mutation(
            db,
            current_user,
            is_new=is_new,
            existing_period=existing.period if existing else None,
            payload_period=(d.period or "").strip() or None,
            period_explicit_in_payload="period" in d.model_fields_set,
        )
        prev_status = existing.status if existing else None
        if existing:
            existing.department_id = d.departmentId or existing.department_id
            existing.period = d.period or existing.period
            existing.income = str(d.income if d.income is not None else existing.income)
            existing.expenses = d.expenses if d.expenses is not None else (existing.expenses or {})
            existing.status = d.status or existing.status
            existing.created_at = d.createdAt or existing.created_at
            existing.updated_at = d.updatedAt
            existing.approved_by = d.approvedBy
            existing.approved_at = d.approvedAt
            existing.is_archived = d.isArchived
            dfs = d.model_fields_set
            if "periodStart" in dfs:
                existing.period_start = d.periodStart
            if "periodEnd" in dfs:
                existing.period_end = d.periodEnd
            if "planSeriesId" in dfs:
                existing.plan_series_id = d.planSeriesId
            if "periodLabel" in dfs:
                existing.period_label = d.periodLabel
            if "weekBreakdown" in dfs:
                if d.weekBreakdown is None or len(d.weekBreakdown) == 0:
                    existing.week_breakdown = None
                else:
                    existing.week_breakdown = [s.model_dump(mode="json") for s in d.weekBreakdown]
        else:
            db.add(FinancialPlanDocument(
                id=did,
                department_id=d.departmentId or "",
                period=d.period or "",
                income=str(d.income if d.income is not None else 0),
                expenses=d.expenses or {},
                status=d.status or "created",
                created_at=d.createdAt or "",
                updated_at=d.updatedAt,
                approved_by=d.approvedBy,
                approved_at=d.approvedAt,
                is_archived=d.isArchived,
                period_start=d.periodStart,
                period_end=d.periodEnd,
                plan_series_id=d.planSeriesId,
                period_label=d.periodLabel,
                week_breakdown=(
                    [s.model_dump(mode="json") for s in d.weekBreakdown]
                    if d.weekBreakdown and len(d.weekBreakdown) > 0
                    else None
                ),
            ))
        await db.flush()
        doc_row = await db.get(FinancialPlanDocument, did)
        st = doc_row.status if doc_row else d.status
        await log_entity_mutation(
            db,
            event_type="financial_plan_document.created" if is_new else "financial_plan_document.updated",
            entity_type="financial_plan_document",
            entity_id=did,
            source="finance-router",
            payload={"departmentId": d.departmentId, "period": d.period, "status": st},
        )
        if not is_new and doc_row and prev_status is not None and doc_row.status != prev_status:
            await log_entity_mutation(
                db,
                event_type="financial_plan_document.status.changed",
                entity_type="financial_plan_document",
                entity_id=did,
                source="finance-router",
                payload={"fromStatus": prev_status, "toStatus": doc_row.status},
            )
    await db.commit()
    return {"ok": True}


@router.get("/financial-plannings", response_model=list[FinancialPlanningRead])
async def get_financial_plannings(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(FinancialPlanning))
    return [row_to_planning(r) for r in result.scalars().all()]


@router.put("/financial-plannings", response_model=OkResponse)
async def update_financial_plannings(
    plannings: list[FinancialPlanningItem],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    items: list[tuple[FinancialPlanningItem, FinancialPlanning | None]] = []
    for p in plannings:
        pid = p.id
        if not pid:
            continue
        existing = await db.get(FinancialPlanning, pid)
        items.append((p, existing))
    if any(_financial_planning_payload_requires_approve(ex, p) for p, ex in items):
        await require_finance_approve(current_user=current_user, db=db)
    for p, existing in items:
        pid = p.id
        is_new = existing is None
        await guard_finance_yyyy_mm_mutation(
            db,
            current_user,
            is_new=is_new,
            existing_period=existing.period if existing else None,
            payload_period=(p.period or "").strip() or None,
            period_explicit_in_payload="period" in p.model_fields_set,
        )
        prev_status = existing.status if existing else None
        fs = p.model_fields_set
        if existing:
            if "departmentId" in fs:
                existing.department_id = p.departmentId or existing.department_id
            if "period" in fs:
                existing.period = p.period or existing.period
            if "planDocumentId" in fs:
                existing.plan_document_id = p.planDocumentId
            if "planDocumentIds" in fs:
                existing.plan_document_ids = [str(x).strip() for x in (p.planDocumentIds or []) if str(x).strip()]
            if "income" in fs:
                existing.income = str(p.income) if p.income is not None else None
            if "fundAllocations" in fs:
                existing.fund_allocations = p.fundAllocations or {}
            if "requestFundIds" in fs:
                existing.request_fund_ids = p.requestFundIds or {}
            if "requestIds" in fs:
                existing.request_ids = p.requestIds or []
            if "status" in fs:
                existing.status = p.status or existing.status
            if "createdAt" in fs:
                existing.created_at = p.createdAt or existing.created_at
            if "updatedAt" in fs:
                existing.updated_at = p.updatedAt
            if "approvedBy" in fs:
                existing.approved_by = p.approvedBy
            if "approvedAt" in fs:
                existing.approved_at = p.approvedAt
            if "notes" in fs:
                existing.notes = p.notes
            if "isArchived" in fs:
                existing.is_archived = p.isArchived
            if "periodStart" in fs:
                existing.period_start = p.periodStart
            if "periodEnd" in fs:
                existing.period_end = p.periodEnd
            if "incomeReportId" in fs:
                existing.income_report_id = p.incomeReportId
            if "incomeReportIds" in fs:
                existing.income_report_ids = [str(x).strip() for x in (p.incomeReportIds or []) if str(x).strip()]
            if "fundMovements" in fs:
                existing.fund_movements = p.fundMovements or []
            if "expenseDistribution" in fs:
                existing.expense_distribution = p.expenseDistribution or {}
            if "planDocumentIds" in fs or "planDocumentId" in fs:
                ids = list(existing.plan_document_ids or [])
                doc_id = (existing.plan_document_id or "").strip() if existing.plan_document_id else ""
                if doc_id and doc_id not in ids:
                    ids = [doc_id, *ids]
                    existing.plan_document_ids = ids
                elif not doc_id and ids:
                    existing.plan_document_id = ids[0]
                elif doc_id and not ids:
                    existing.plan_document_ids = [doc_id]
            if "incomeReportIds" in fs or "incomeReportId" in fs:
                ids_ir = list(existing.income_report_ids or []) if getattr(existing, "income_report_ids", None) is not None else []
                single_ir = (existing.income_report_id or "").strip() if existing.income_report_id else ""
                if single_ir and single_ir not in ids_ir:
                    ids_ir = [single_ir, *ids_ir]
                    existing.income_report_ids = ids_ir
                elif not single_ir and ids_ir:
                    existing.income_report_id = ids_ir[0]
                elif single_ir and not ids_ir:
                    existing.income_report_ids = [single_ir]
        else:
            doc_ids = [str(x).strip() for x in (p.planDocumentIds or []) if str(x).strip()]
            primary = (p.planDocumentId or "").strip() if p.planDocumentId else ""
            if primary and primary not in doc_ids:
                doc_ids = [primary, *doc_ids]
            if not primary and doc_ids:
                primary = doc_ids[0]
            inc_ids = [str(x).strip() for x in (p.incomeReportIds or []) if str(x).strip()]
            inc_primary = (p.incomeReportId or "").strip() if p.incomeReportId else ""
            if inc_primary and inc_primary not in inc_ids:
                inc_ids = [inc_primary, *inc_ids]
            if not inc_primary and inc_ids:
                inc_primary = inc_ids[0]
            db.add(FinancialPlanning(
                id=pid,
                department_id=p.departmentId or "",
                period=p.period or "",
                plan_document_id=primary or None,
                plan_document_ids=doc_ids,
                income=str(p.income) if p.income is not None else None,
                fund_allocations=p.fundAllocations or {},
                request_fund_ids=p.requestFundIds or {},
                request_ids=p.requestIds or [],
                status=p.status or "created",
                created_at=p.createdAt or "",
                updated_at=p.updatedAt,
                approved_by=p.approvedBy,
                approved_at=p.approvedAt,
                notes=p.notes,
                is_archived=p.isArchived,
                period_start=p.periodStart,
                period_end=p.periodEnd,
                income_report_id=inc_primary or None,
                income_report_ids=inc_ids,
                fund_movements=p.fundMovements or [],
                expense_distribution=p.expenseDistribution or {},
            ))
        await db.flush()
        pl_row = await db.get(FinancialPlanning, pid)
        if pl_row is None:
            continue
        ids_ir = list(pl_row.income_report_ids or []) if getattr(pl_row, "income_report_ids", None) is not None else []
        single_ir = (pl_row.income_report_id or "").strip() if pl_row.income_report_id else ""
        if single_ir and single_ir not in ids_ir:
            ids_ir = [single_ir, *ids_ir]
            pl_row.income_report_ids = ids_ir
        elif not single_ir and ids_ir:
            pl_row.income_report_id = ids_ir[0]
        elif single_ir and not ids_ir:
            pl_row.income_report_ids = [single_ir]
        await db.flush()
        eff_reports = _planning_merged_income_report_ids(pl_row)
        await _validate_income_reports_for_planning(db, planning_id=pid, report_ids=eff_reports)
        await _sync_income_report_locks_for_planning(db, planning_id=pid, row=pl_row)
        st = pl_row.status if pl_row else p.status
        await log_entity_mutation(
            db,
            event_type="financial_planning.created" if is_new else "financial_planning.updated",
            entity_type="financial_planning",
            entity_id=pid,
            source="finance-router",
            payload={"departmentId": p.departmentId, "period": p.period, "status": st},
        )
        if not is_new and pl_row and prev_status is not None and pl_row.status != prev_status:
            await log_entity_mutation(
                db,
                event_type="financial_planning.status.changed",
                entity_type="financial_planning",
                entity_id=pid,
                source="finance-router",
                payload={"fromStatus": prev_status, "toStatus": pl_row.status},
            )
    await db.commit()
    return {"ok": True}


# --- Bank statements (выписки) ---

def _row_to_statement(row, lines=None):
    return {
        "id": row.id,
        "name": row.name,
        "period": row.period,
        "createdAt": row.created_at,
        "lines": lines or [],
    }


def _row_to_statement_line(row):
    return {
        "id": row.id,
        "statementId": row.statement_id,
        "lineDate": row.line_date,
        "description": row.description,
        "amount": float(row.amount) if row.amount and str(row.amount).replace(".", "").replace("-", "").isdigit() else row.amount,
        "lineType": row.line_type,
    }


@router.get("/bank-statements", response_model=list[BankStatementRead])
async def get_bank_statements(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(BankStatement).order_by(BankStatement.created_at))
    statements = result.scalars().all()
    out = []
    for st in statements:
        lines_r = await db.execute(select(BankStatementLine).where(BankStatementLine.statement_id == st.id))
        lines = [_row_to_statement_line(line) for line in lines_r.scalars().all()]
        out.append(_row_to_statement(st, lines))
    return out


@router.put("/bank-statements", response_model=OkResponse)
async def update_bank_statements(payload: list[BankStatementItem], db: AsyncSession = Depends(get_db)):
    for s in payload:
        sid = s.id
        if not sid:
            continue
        existing = await db.get(BankStatement, sid)
        is_new = existing is None
        if existing:
            existing.name = s.name if s.name is not None else existing.name
            existing.period = s.period if s.period is not None else existing.period
            existing.created_at = s.createdAt or existing.created_at
        else:
            db.add(BankStatement(
                id=sid,
                name=s.name,
                period=s.period,
                created_at=s.createdAt or "",
            ))
        await db.flush()
        lines = s.lines
        await db.execute(delete(BankStatementLine).where(BankStatementLine.statement_id == sid))
        for ln in lines:
            lid = ln.id or __import__("uuid").uuid4().__str__()
            db.add(BankStatementLine(
                id=lid,
                statement_id=sid,
                line_date=ln.lineDate or "",
                description=ln.description,
                amount=str(ln.amount if ln.amount is not None else 0),
                line_type=ln.lineType or "in",
            ))
        await db.flush()
        await log_entity_mutation(
            db,
            event_type="bank_statement.created" if is_new else "bank_statement.updated",
            entity_type="bank_statement",
            entity_id=sid,
            source="finance-router",
            payload={"name": s.name, "period": s.period, "lineCount": len(lines)},
        )
    await auto_match_fp_expenses_to_paid(db)
    await db.commit()
    return {"ok": True}


@router.get("/expense-reconciliation-groups", response_model=list[FinanceReconciliationGroupRead])
async def get_expense_reconciliation_groups(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(FinanceReconciliationGroup))
    out = []
    for g in result.scalars().all():
        lids = g.line_ids if isinstance(g.line_ids, list) else []
        out.append(
            FinanceReconciliationGroupRead(
                id=g.id,
                lineIds=[str(x) for x in lids],
                requestId=g.request_id,
                manualResolved=bool(g.manual_resolved),
                updatedAt=g.updated_at,
            )
        )
    return out


@router.put("/expense-reconciliation-groups", response_model=OkResponse)
async def put_expense_reconciliation_groups(
    payload: list[FinanceReconciliationGroupItem],
    db: AsyncSession = Depends(get_db),
):
    await db.execute(delete(FinanceReconciliationGroup))
    now = datetime.now(UTC).isoformat()
    for it in payload:
        db.add(
            FinanceReconciliationGroup(
                id=it.id,
                line_ids=list(it.lineIds or []),
                request_id=it.requestId,
                manual_resolved=bool(it.manualResolved),
                updated_at=now,
            )
        )
    await db.flush()
    await log_entity_mutation(
        db,
        event_type="finance.expense_reconciliation_groups.updated",
        entity_type="finance_reconciliation",
        entity_id="all",
        source="finance-router",
        payload={"count": len(payload)},
        actor_id=None,
    )
    await db.commit()
    return {"ok": True}


@router.delete("/bank-statements/{statement_id}", response_model=OkResponse)
async def delete_bank_statement(statement_id: str, db: AsyncSession = Depends(get_db)):
    await db.execute(delete(BankStatementLine).where(BankStatementLine.statement_id == statement_id))
    st = await db.get(BankStatement, statement_id)
    if st:
        await db.delete(st)
    await db.flush()
    await log_entity_mutation(
        db,
        event_type="bank_statement.deleted",
        entity_type="bank_statement",
        entity_id=statement_id,
        source="finance-router",
        payload={},
    )
    await db.commit()
    return {"ok": True}


# --- Income reports (отчёты по приходам) ---

def _row_to_income_report(row):
    return {
        "id": row.id,
        "period": row.period,
        "data": row.data or {},
        "createdAt": row.created_at,
        "updatedAt": row.updated_at,
        "lockedByPlanningId": getattr(row, "locked_by_planning_id", None),
    }


@router.get("/income-reports", response_model=list[IncomeReportRead])
async def get_income_reports(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(IncomeReport))
    return [_row_to_income_report(r) for r in result.scalars().all()]


@router.put("/income-reports", response_model=OkResponse)
async def update_income_reports(
    payload: list[IncomeReportItem],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    for r in payload:
        rid = r.id
        if not rid:
            continue
        existing = await db.get(IncomeReport, rid)
        is_new = existing is None
        await guard_finance_yyyy_mm_mutation(
            db,
            current_user,
            is_new=is_new,
            existing_period=existing.period if existing else None,
            payload_period=(r.period or "").strip() or None,
            period_explicit_in_payload="period" in r.model_fields_set,
        )
        if existing:
            existing.period = r.period or existing.period
            existing.data = r.data if r.data is not None else (existing.data or {})
            existing.created_at = r.createdAt or existing.created_at
            existing.updated_at = r.updatedAt
            # locked_by_planning_id задаётся только через сохранение бюджета (проведение/утверждение)
        else:
            db.add(IncomeReport(
                id=rid,
                period=r.period or "",
                data=r.data or {},
                created_at=r.createdAt or "",
                updated_at=r.updatedAt,
                locked_by_planning_id=None,
            ))
        await db.flush()
        await log_entity_mutation(
            db,
            event_type="income_report.created" if is_new else "income_report.updated",
            entity_type="income_report",
            entity_id=rid,
            source="finance-router",
            payload={"period": r.period},
        )
    await db.commit()
    return {"ok": True}


# --- БДР (бюджет доходов и расходов) ---

@router.get("/bdr", response_model=BdrGetResponse)
async def get_bdr(year: str | None = None, db: AsyncSession = Depends(get_db)):
    """Один документ на год: ``rows`` в JSONB; итоги ``totals`` считаются на сервере и не хранятся в БД."""
    raw_y = year or str(date.today().year)
    y = str(raw_y).strip()[:4]
    if len(y) != 4 or not y.isdigit():
        y = str(date.today().year)
    result = await db.execute(select(Bdr).where(Bdr.year == y))
    row = result.scalar_one_or_none()
    raw = row.rows if row and isinstance(row.rows, list) else []
    return bdr_get_response(y, raw)


@router.put("/bdr", response_model=BdrGetResponse)
async def update_bdr(
    payload: BdrPutBody,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Сохранить БДР за год. В БД пишутся только ``year`` + ``rows`` (JSONB); итоги возвращаются в ответе."""
    y = str(payload.year).strip()[:4]
    if not y or not y.isdigit():
        raise HTTPException(status_code=400, detail="year required")
    if calendar_year_is_strictly_past(y):
        await assert_may_edit_past_dated_entity(db, current_user)
    rows_in = payload.rows
    if not isinstance(rows_in, list):
        rows_in = []
    rows_clean = sanitize_bdr_rows(rows_in, year=y)
    result = await db.execute(select(Bdr).where(Bdr.year == y))
    existing = result.scalar_one_or_none()
    now = datetime.now(UTC).isoformat().replace("+00:00", "Z")
    is_new = existing is None
    if existing:
        existing.rows = rows_clean
        existing.updated_at = now
    else:
        db.add(Bdr(id=y, year=y, rows=rows_clean, updated_at=now))
    await db.flush()
    await log_entity_mutation(
        db,
        event_type="bdr.created" if is_new else "bdr.updated",
        entity_type="bdr",
        entity_id=y,
        source="finance-router",
        payload={"year": y, "rowCount": len(rows_clean)},
    )
    await db.commit()
    return bdr_get_response(y, rows_clean)
