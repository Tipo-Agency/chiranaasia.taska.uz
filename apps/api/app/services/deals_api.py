"""ORM ↔ схемы сделок, явное применение PATCH (без динамического setattr по ключам клиента)."""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Any

from app.core.mappers import _legacy_telegram_username
from app.models.client import Deal
from app.schemas.clients import ClientRead as ClientNestedRead
from app.schemas.deals import DealCreate, DealRead, DealUpdate


def _dec_amount(v: Any) -> Decimal:
    if v is None:
        return Decimal("0")
    try:
        return Decimal(str(v).strip())
    except (InvalidOperation, ValueError, TypeError):
        return Decimal("0")


def _norm_tags(raw: list[str] | None) -> list[str]:
    if not raw:
        return []
    out: list[str] = []
    for x in raw[:500]:
        s = str(x).strip()[:500]
        if s:
            out.append(s)
    return out


def _merge_telegram_username(cf: dict[str, Any], username: str | None) -> dict[str, Any]:
    if not username or not str(username).strip():
        return cf
    base = dict(cf)
    leg = dict(base["_legacy"]) if isinstance(base.get("_legacy"), dict) else {}
    leg["telegram_username"] = str(username).strip()[:100]
    base["_legacy"] = leg
    return base


def _paid_amount_read(row: Deal) -> str | float | int | None:
    pa = row.paid_amount
    if pa is None or pa == "":
        return pa
    s = str(pa)
    if s.replace(".", "").replace("-", "").isdigit():
        try:
            return float(s)
        except ValueError:
            return pa
    return pa


def _payment_day_read(row: Deal) -> int | str | None:
    pd = row.payment_day
    if pd is None or pd == "":
        return None
    s = str(pd)
    return int(s) if s.isdigit() else pd


def deal_row_to_read(row: Deal) -> DealRead:
    amt = row.amount
    if amt is not None:
        try:
            amount_f = float(amt)
        except (TypeError, ValueError):
            amount_f = 0.0
    else:
        amount_f = 0.0
    sch = row.source_chat_id
    tags = list(row.tags) if row.tags is not None else []
    cf = row.custom_fields if isinstance(row.custom_fields, dict) else {}
    tgun = _legacy_telegram_username(cf)
    comments = row.comments if isinstance(row.comments, list) else []
    rel = getattr(row, "client", None)
    nested_client = ClientNestedRead.model_validate(rel) if rel is not None else None
    return DealRead(
        id=row.id,
        version=int(row.version) if getattr(row, "version", None) is not None else 1,
        title=row.title or "",
        client_id=row.client_id,
        contact_name=row.contact_name,
        amount=amount_f,
        currency=row.currency or "UZS",
        stage=row.stage or "new",
        funnel_id=row.funnel_id,
        source=row.source,
        source_chat_id=sch,
        telegram_chat_id=sch,
        telegram_username=tgun,
        tags=tags,
        custom_fields=dict(cf),
        lost_reason=getattr(row, "lost_reason", None),
        assignee_id=row.assignee_id,
        created_at=row.created_at,
        updated_at=row.updated_at,
        notes=row.notes,
        project_id=row.project_id,
        comments=[c for c in comments if isinstance(c, dict)],
        is_archived=bool(row.is_archived),
        recurring=bool(row.recurring),
        number=row.number,
        status=row.status,
        description=row.description,
        date=row.date,
        due_date=row.due_date,
        paid_amount=_paid_amount_read(row),
        paid_date=row.paid_date,
        start_date=row.start_date,
        end_date=row.end_date,
        payment_day=_payment_day_read(row),
        client=nested_client,
    )


def deal_from_create(body: DealCreate, deal_id: str, *, assignee_id: str | None) -> Deal:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
    cf = dict(body.custom_fields) if isinstance(body.custom_fields, dict) else {}
    cf = _merge_telegram_username(cf, body.telegram_username)
    return Deal(
        id=deal_id,
        version=1,
        title=body.title.strip()[:500],
        client_id=(body.client_id.strip()[:36] or None) if body.client_id else None,
        contact_name=body.contact_name[:255] if body.contact_name else None,
        amount=_dec_amount(body.amount),
        currency=(body.currency or "UZS").strip()[:10] or "UZS",
        stage=(body.stage or "new").strip()[:100] or "new",
        funnel_id=body.funnel_id[:36] if body.funnel_id else None,
        source=body.source[:50] if body.source else None,
        source_chat_id=body.source_chat_id[:255] if body.source_chat_id else None,
        tags=_norm_tags(body.tags),
        custom_fields=cf,
        lost_reason=body.lost_reason[:10000] if body.lost_reason else None,
        assignee_id=assignee_id,
        created_at=body.created_at or now,
        notes=body.notes,
        project_id=body.project_id[:36] if body.project_id else None,
        comments=list(body.comments) if isinstance(body.comments, list) else [],
        is_archived=False,
    )


def apply_deal_patch_to_row(deal: Deal, patch: DealUpdate) -> None:
    data = patch.model_dump(exclude_unset=True, exclude={"updated_by_user_id", "telegram_username", "version"})
    if "title" in data and data["title"] is not None:
        deal.title = data["title"].strip()[:500]
    if "client_id" in data:
        v = data["client_id"]
        if v is None or v == "":
            deal.client_id = None
        else:
            deal.client_id = str(v).strip()[:36] or None
    if "contact_name" in data:
        v = data["contact_name"]
        deal.contact_name = v[:255] if v else None
    if "amount" in data and data["amount"] is not None:
        deal.amount = _dec_amount(data["amount"])
    if "currency" in data and data["currency"] is not None:
        deal.currency = str(data["currency"]).strip()[:10] or "UZS"
    if "stage" in data and data["stage"] is not None:
        deal.stage = str(data["stage"]).strip()[:100] or deal.stage
    if "funnel_id" in data:
        v = data["funnel_id"]
        deal.funnel_id = v[:36] if v else None
    if "source" in data:
        v = data["source"]
        deal.source = v[:50] if v else None
    if "source_chat_id" in data:
        v = data["source_chat_id"]
        deal.source_chat_id = v[:255] if v else None
    if "tags" in data and data["tags"] is not None:
        deal.tags = _norm_tags(data["tags"])
    if "custom_fields" in data and data["custom_fields"] is not None:
        deal.custom_fields = dict(data["custom_fields"])
    if "lost_reason" in data:
        v = data["lost_reason"]
        deal.lost_reason = v[:10000] if v else None
    if "assignee_id" in data:
        deal.assignee_id = data["assignee_id"]
    if "notes" in data:
        deal.notes = data["notes"]
    if "project_id" in data:
        v = data["project_id"]
        deal.project_id = v[:36] if v else None
    if "comments" in data and data["comments"] is not None:
        deal.comments = list(data["comments"])
    if "is_archived" in data and data["is_archived"] is not None:
        deal.is_archived = data["is_archived"]
    if "recurring" in data and data["recurring"] is not None:
        deal.recurring = data["recurring"]
    if "number" in data:
        v = data["number"]
        deal.number = v[:100] if v else None
    if "status" in data:
        v = data["status"]
        deal.status = v[:30] if v else None
    if "description" in data:
        deal.description = data["description"]
    if "date" in data:
        v = data["date"]
        deal.date = v[:50] if v else None
    if "due_date" in data:
        v = data["due_date"]
        deal.due_date = v[:50] if v else None
    if "paid_amount" in data:
        v = data["paid_amount"]
        deal.paid_amount = str(v) if v is not None else None
    if "paid_date" in data:
        v = data["paid_date"]
        deal.paid_date = v[:50] if v else None
    if "start_date" in data:
        v = data["start_date"]
        deal.start_date = v[:50] if v else None
    if "end_date" in data:
        v = data["end_date"]
        deal.end_date = v[:50] if v else None
    if "payment_day" in data:
        v = data["payment_day"]
        deal.payment_day = str(v)[:10] if v is not None else None
    if "updated_at" in data:
        deal.updated_at = data["updated_at"]

    if patch.telegram_username is not None:
        cf = deal.custom_fields if isinstance(deal.custom_fields, dict) else {}
        deal.custom_fields = _merge_telegram_username(cf, patch.telegram_username)
