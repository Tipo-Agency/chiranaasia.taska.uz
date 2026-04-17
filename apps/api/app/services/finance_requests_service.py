"""Бизнес-логика заявок на оплату: явное применение полей, без динамического setattr."""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, time
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import ColumnElement, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.finance import FinanceRequest
from app.schemas.finance_requests import FinanceRequestCreate, FinanceRequestPatch, FinanceRequestRead
from app.services.finance_planning_funds import parse_request_amount_uzs
from app.services.finance_request_meta import (
    extract_department_id,
    extract_payment_date_tag,
    merge_comment_with_department_tag,
    strip_embedded_tags,
)
from app.services.finance_request_workflow import assert_finance_request_status_transition, normalize_status


def finance_request_row_to_dict(row: FinanceRequest) -> dict:
    """Сериализация строки ORM в dict для ``FinanceRequestRead`` (camelCase)."""
    comment = row.comment
    stripped = strip_embedded_tags(comment or "")
    dept = extract_department_id(comment)
    pay_tag = extract_payment_date_tag(comment)
    pay_col = row.payment_date.isoformat() if row.payment_date else None
    payment_date_out = pay_col or pay_tag
    created = row.created_at.isoformat() if row.created_at else None
    amt = row.amount if row.amount is not None else Decimal("0")
    amount_str = format(amt, "f")
    if "." in amount_str:
        amount_str = amount_str.rstrip("0").rstrip(".") or "0"

    decision_date = None
    if row.status == "paid" and row.paid_at:
        decision_date = row.paid_at.isoformat()
    elif row.status in ("approved", "rejected") and row.updated_at:
        decision_date = row.updated_at.isoformat()

    atts = getattr(row, "attachments", None)
    if not isinstance(atts, list):
        atts = []
    inv = getattr(row, "invoice_date", None)
    ba = getattr(row, "budget_approved_amount", None)
    budget_approved_out = None
    if ba is not None:
        bdec = ba if isinstance(ba, Decimal) else Decimal(str(ba))
        budget_approved_out = format(bdec, "f")
        if "." in budget_approved_out:
            budget_approved_out = budget_approved_out.rstrip("0").rstrip(".") or "0"
    return {
        "id": row.id,
        "version": int(row.version) if row.version is not None else 1,
        "title": row.title,
        "amount": amount_str,
        "currency": row.currency or "UZS",
        "category": row.category,
        "counterparty": row.counterparty,
        "requestedBy": row.requested_by,
        "approvedBy": row.approved_by,
        "status": row.status,
        "comment": comment,
        "paymentDate": payment_date_out,
        "paidAt": row.paid_at.isoformat() if row.paid_at else None,
        "createdAt": created,
        "updatedAt": row.updated_at.isoformat() if row.updated_at else None,
        "isArchived": row.is_archived or False,
        "requesterId": row.requested_by,
        "categoryId": row.category,
        "departmentId": dept,
        "description": stripped,
        "date": created,
        "decisionDate": decision_date,
        "attachments": atts,
        "counterpartyInn": getattr(row, "counterparty_inn", None),
        "invoiceNumber": getattr(row, "invoice_number", None),
        "invoiceDate": inv.isoformat() if inv else None,
        "budgetApprovedAmount": budget_approved_out,
    }


def finance_request_to_read(row: FinanceRequest) -> FinanceRequestRead:
    return FinanceRequestRead.model_validate(finance_request_row_to_dict(row))


def assert_finance_request_patch_respects_lock(row: FinanceRequest, data: FinanceRequestPatch) -> None:
    """
    В статусах ``approved`` и ``paid`` запрещены правки полей, кроме:
    - ``is_archived``;
    - для ``approved`` ещё переход ``status`` → ``paid``;
    - вложения и реквизиты счёта (ИНН, номер и дата счёта) для сверки с выпиской.
    """
    fs = data.model_fields_set - {"version"}
    ns = normalize_status(row.status)
    if ns not in ("approved", "paid"):
        return
    meta_fields = {
        "attachments",
        "counterparty_inn",
        "invoice_number",
        "invoice_date",
    }
    if ns == "approved":
        allowed: set[str] = set(meta_fields)
        if "is_archived" in fs:
            allowed.add("is_archived")
        if "status" in fs and data.status is not None and normalize_status(str(data.status)) == "paid":
            allowed.add("status")
        if not fs.issubset(allowed):
            raise HTTPException(status_code=400, detail="finance_request_locked")
        return
    if not fs.issubset({"is_archived", *meta_fields}):
        raise HTTPException(status_code=400, detail="finance_request_locked")


def reject_comment_provided(data: FinanceRequestPatch) -> bool:
    """Текст отклонения: непустой ``comment`` или ``description`` в теле PATCH."""
    fs = data.model_fields_set
    if "comment" in fs and data.comment is not None and str(data.comment).strip():
        return True
    if "description" in fs and data.description is not None and str(data.description).strip():
        return True
    return False


async def list_finance_requests(
    db: AsyncSession,
    *,
    status: str | None,
    category: str | None,
    date_from: date | None,
    date_to: date | None,
    limit: int,
    seek_after: ColumnElement[bool] | None = None,
) -> tuple[list[FinanceRequest], int]:
    conds: list = []
    if status is not None and str(status).strip():
        conds.append(FinanceRequest.status == normalize_status(str(status).strip()))
    if category is not None and str(category).strip():
        conds.append(FinanceRequest.category == str(category).strip())
    if date_from is not None:
        conds.append(FinanceRequest.created_at >= datetime.combine(date_from, time.min, tzinfo=UTC))
    if date_to is not None:
        conds.append(FinanceRequest.created_at <= datetime.combine(date_to, time.max, tzinfo=UTC))

    cnt_q = select(func.count()).select_from(FinanceRequest)
    if conds:
        cnt_q = cnt_q.where(*conds)
    total = int((await db.execute(cnt_q)).scalar_one())

    stmt = select(FinanceRequest)
    if conds:
        stmt = stmt.where(*conds)
    if seek_after is not None:
        stmt = stmt.where(seek_after)
    stmt = stmt.order_by(FinanceRequest.created_at.desc(), FinanceRequest.id.desc()).limit(limit)
    rows = list((await db.execute(stmt)).scalars().all())
    return rows, total


def insert_finance_request_row(
    *,
    new_id: str,
    data: FinanceRequestCreate,
    now: datetime,
) -> FinanceRequest:
    new_status = normalize_status(str(data.status))
    assert_finance_request_status_transition(
        old_status=None,
        new_status=new_status,
        is_new_row=True,
    )

    user_comment = data.comment if data.comment is not None else data.description
    user_comment = (str(user_comment).strip() if user_comment is not None else "")
    dept = str(data.department_id).strip() if data.department_id else None
    comment = merge_comment_with_department_tag(user_comment=user_comment, department_id=dept)

    cat_raw = data.category if data.category is not None else data.category_id
    category = (str(cat_raw).strip()[:100] if cat_raw is not None and str(cat_raw).strip() else None)

    cp_raw = data.counterparty
    counterparty = (str(cp_raw).strip()[:255] if cp_raw is not None and str(cp_raw).strip() else None)

    req_by = data.requested_by if data.requested_by is not None else data.requester_id
    requested_by = str(req_by).strip()[:36] if req_by is not None and str(req_by).strip() else None

    pay_raw = data.payment_date
    payment_date = pay_raw
    if payment_date is None:
        payment_date = _parse_iso_date_from_str(extract_payment_date_tag(comment))

    currency = str(data.currency or "UZS").strip()[:10] or "UZS"
    title = data.title.strip()[:500]

    approved_by = None
    if new_status == "approved":
        ab = data.approved_by
        if ab:
            approved_by = str(ab).strip()[:36]
    paid_at = now if new_status == "paid" else None

    atts_payload = [a.model_dump(mode="python", by_alias=True) for a in (data.attachments or [])]

    inn = str(data.counterparty_inn).strip()[:32] if data.counterparty_inn else None
    inv_num = str(data.invoice_number).strip()[:100] if data.invoice_number else None
    inv_dt = data.invoice_date

    return FinanceRequest(
        id=new_id,
        version=1,
        title=title,
        amount=data.amount,
        currency=currency,
        category=category,
        counterparty=counterparty,
        requested_by=requested_by,
        approved_by=approved_by,
        status=new_status,
        comment=comment or None,
        payment_date=payment_date,
        paid_at=paid_at,
        is_archived=bool(data.is_archived),
        created_at=now,
        updated_at=now,
        attachments=atts_payload or [],
        counterparty_inn=inn,
        invoice_number=inv_num,
        invoice_date=inv_dt,
    )


def _parse_iso_date_from_str(s: str | None) -> date | None:
    if not s or not str(s).strip():
        return None
    try:
        return date.fromisoformat(str(s).strip()[:10])
    except ValueError:
        return None


def apply_finance_request_patch(
    row: FinanceRequest,
    data: FinanceRequestPatch,
    *,
    now: datetime,
    actor_user_id: str | None = None,
) -> None:
    """Явное применение полей PATCH (ветвление по ``model_fields_set``)."""
    fs = data.model_fields_set - {"version"}
    if not fs:
        return

    if "title" in fs and data.title is not None:
        t = data.title.strip()
        if t:
            row.title = t[:500]

    if "amount" in fs and data.amount is not None:
        row.amount = data.amount

    if "currency" in fs and data.currency is not None:
        row.currency = str(data.currency).strip()[:10] or "UZS"

    if "category" in fs:
        v = data.category
        row.category = None if v is None else (str(v).strip()[:100] or None)
    elif "category_id" in fs:
        v = data.category_id
        row.category = None if v is None else (str(v).strip()[:100] or None)

    if "counterparty" in fs:
        v = data.counterparty
        row.counterparty = None if v is None else (str(v).strip()[:255] or None)

    if "requested_by" in fs or "requester_id" in fs:
        v = data.requested_by if "requested_by" in fs else data.requester_id
        row.requested_by = None if v is None else (str(v).strip()[:36] or None)

    if "comment" in fs or "description" in fs or "department_id" in fs:
        if "comment" in fs or "description" in fs:
            raw = data.comment if data.comment is not None else data.description
            uc = (str(raw).strip() if raw is not None else "")
        else:
            uc = strip_embedded_tags(row.comment or "")
        if "department_id" in fs:
            dept = str(data.department_id).strip() if data.department_id else None
        else:
            dept = extract_department_id(row.comment)
        merged = merge_comment_with_department_tag(user_comment=uc, department_id=dept)
        row.comment = merged or None

    if "payment_date" in fs:
        row.payment_date = data.payment_date
        if data.payment_date is None and row.comment:
            pass

    if "is_archived" in fs and data.is_archived is not None:
        row.is_archived = bool(data.is_archived)

    if "status" in fs and data.status is not None:
        new_s = normalize_status(str(data.status))
        assert_finance_request_status_transition(
            old_status=row.status,
            new_status=new_s,
            is_new_row=False,
        )
        prev_n = normalize_status(row.status)
        if new_s != prev_n:
            if new_s == "paid":
                row.paid_at = now
            if new_s == "approved" and actor_user_id:
                row.approved_by = str(actor_user_id).strip()[:36]
            if prev_n == "approved" and new_s not in ("approved", "paid"):
                row.budget_approved_amount = None
            if new_s == "approved":
                cap = parse_request_amount_uzs(row.amount)
                ba_val = None
                if "budget_approved_uzs" in fs and data.budget_approved_uzs is not None:
                    want = parse_request_amount_uzs(data.budget_approved_uzs)
                    eff = min(want, cap) if want > 0 else cap
                    if eff > 0 and eff < cap:
                        ba_val = eff
                row.budget_approved_amount = ba_val
        row.status = new_s

    if "attachments" in fs and data.attachments is not None:
        row.attachments = [a.model_dump(mode="python", by_alias=True) for a in data.attachments]

    if "counterparty_inn" in fs:
        v = data.counterparty_inn
        row.counterparty_inn = None if v is None else (str(v).strip()[:32] or None)

    if "invoice_number" in fs:
        v = data.invoice_number
        row.invoice_number = None if v is None else (str(v).strip()[:100] or None)

    if "invoice_date" in fs:
        row.invoice_date = data.invoice_date

    row.updated_at = now


def new_finance_request_id(data: FinanceRequestCreate) -> str:
    if data.id and str(data.id).strip():
        return str(data.id).strip()[:36]
    return str(uuid.uuid4())
