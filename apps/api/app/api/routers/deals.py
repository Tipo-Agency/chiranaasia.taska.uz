"""Deals router — GET/POST/PATCH с Pydantic и пагинацией (docs/API.md § Deals)."""
from __future__ import annotations

import uuid
from datetime import UTC, datetime
from decimal import Decimal, InvalidOperation
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from sqlalchemy import asc, desc, exists, func, nullslast, or_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.auth import get_current_user, require_any_permission, require_permission
from app.core.config import get_settings
from app.core.optimistic_version import (
    commit_or_stale_version_conflict,
    enforce_expected_version_row,
    merge_expected_version,
    parse_if_match_header,
)
from app.core.permissions import PERM_CRM_DEALS_EDIT, PERM_CRM_SALES_FUNNEL
from app.db import get_db
from app.models.client import Client, Deal
from app.models.funnel import SalesFunnel
from app.models.user import User
from app.schemas.common_responses import OkResponse, PresignedUrlResponse
from app.schemas.deals import DealBulkItem, DealCreate, DealListResponse, DealRead, DealUpdate
from app.services.audit_log import log_mutation
from app.services.deal_client_rules import (
    assert_deal_client_id_exists,
    assert_won_requires_client_id,
    normalize_deal_client_id,
)
from app.services.deal_related_archive import archive_entities_linked_to_deal, deal_just_archived
from app.services.deal_stage_validation import (
    assert_deal_stage_transition_allowed,
    user_may_bypass_deal_terminal_stage,
)
from app.services.deal_contact_sync import assert_contact_allowed_for_client, maybe_ensure_contact_for_deal
from app.services.deals_api import apply_deal_patch_to_row, deal_from_create, deal_row_to_read
from app.services.domain_events import emit_domain_event, log_entity_mutation
from app.services.list_cursor_page import (
    ListCursorError,
    assert_cursor_matches,
    build_seek_after,
    decode_list_cursor,
    encode_list_cursor,
    filter_fingerprint,
    row_seek_values,
)
from app.services.media_storage import (
    deal_json_contains_storage_key,
    generate_presigned_get_url_async,
    is_media_storage_configured,
    storage_key_belongs_to_deal,
)

router = APIRouter(prefix="/deals", tags=["deals"], dependencies=[Depends(get_current_user)])

require_crm_deals_edit = require_permission(PERM_CRM_DEALS_EDIT, detail="crm_deals_edit_required")
# Одна сделка (POST/PATCH/DELETE): воронка без отдельного crm.deals.edit; массовый PUT /deals — только с crm.deals.edit.
require_crm_deals_single_write = require_any_permission(
    PERM_CRM_DEALS_EDIT,
    PERM_CRM_SALES_FUNNEL,
    detail="crm_deals_write_required",
)

_DEFAULT_LIMIT = 50
_MAX_LIMIT = 500


def _request_id(request: Request) -> str | None:
    return getattr(request.state, "request_id", None)


def _dec_amount(v) -> Decimal:
    if v is None:
        return Decimal("0")
    try:
        return Decimal(str(v).strip())
    except (InvalidOperation, ValueError, TypeError):
        return Decimal("0")


def _lim(v, size: int) -> str | None:
    if v is None:
        return None
    return str(v)[:size]


def _tags_from_bulk(item: DealBulkItem, existing: Deal | None) -> list[str]:
    if "tags" not in item.model_fields_set:
        if existing and existing.tags is not None:
            return list(existing.tags)
        return []
    raw = item.tags
    if raw is None or not isinstance(raw, list):
        return []
    out: list[str] = []
    for x in raw[:500]:
        s = str(x).strip()[:500]
        if s:
            out.append(s)
    return out


def _custom_fields_from_bulk(item: DealBulkItem, existing: Deal | None) -> dict[str, object]:
    base: dict[str, object] = {}
    if existing and isinstance(existing.custom_fields, dict):
        base = dict(existing.custom_fields)
    if "customFields" in item.model_fields_set and isinstance(item.customFields, dict):
        base = {**base, **item.customFields}
    if "telegramUsername" in item.model_fields_set and item.telegramUsername:
        tu = _lim(item.telegramUsername, 100)
        if tu:
            leg = dict(base.get("_legacy")) if isinstance(base.get("_legacy"), dict) else {}
            leg["telegram_username"] = tu
            base["_legacy"] = leg
    return base


def _contact_id_from_bulk(item: DealBulkItem, existing: Deal | None):
    if "contactId" not in item.model_fields_set:
        return existing.contact_id if existing else None
    raw = item.contactId
    if raw is None or raw == "":
        return None
    return str(raw).strip()[:36] or None


def _assignee_from_bulk(item: DealBulkItem, existing: Deal | None):
    if "assigneeId" not in item.model_fields_set:
        return existing.assignee_id if existing else None
    raw = item.assigneeId
    if raw is None or raw == "":
        return None
    s = str(raw).strip()[:36]
    return s or None


def _source_chat_from_bulk(item: DealBulkItem, existing: Deal | None):
    if "sourceChatId" not in item.model_fields_set and "telegramChatId" not in item.model_fields_set:
        return existing.source_chat_id if existing else None
    raw = item.sourceChatId if item.sourceChatId is not None else item.telegramChatId
    if raw is None or raw == "":
        return None
    return str(raw).strip()[:255] or None


def _lost_reason_from_bulk(item: DealBulkItem, existing: Deal | None):
    if "lostReason" not in item.model_fields_set:
        return existing.lost_reason if existing else None
    v = item.lostReason
    if v is None or v == "":
        return None
    return str(v)[:10000]


async def _validate_stage_change_for_put(
    db: AsyncSession,
    *,
    existing: Deal | None,
    new_stage: str,
    new_lost_reason: str | None,
    current_user: User | None,
) -> None:
    is_admin = await user_may_bypass_deal_terminal_stage(db, current_user)
    assert_deal_stage_transition_allowed(
        from_stage=existing.stage if existing else None,
        to_stage=new_stage,
        lost_reason_effective=new_lost_reason,
        is_admin=is_admin,
    )


_DEAL_SORT_FIELDS = frozenset({"created_at", "updated_at", "amount", "stage", "title"})


def _sort_column(name: str):
    key = (name or "created_at").strip()
    m = {
        "created_at": Deal.created_at,
        "updated_at": Deal.updated_at,
        "amount": Deal.amount,
        "stage": Deal.stage,
        "title": Deal.title,
    }
    return m[key]


def _deal_order_spec(sort: str | None, order: str | None):
    sort_parts = [s.strip() for s in (sort or "created_at").split(",") if s.strip()]
    if not sort_parts:
        sort_parts = ["created_at"]
    for sf in sort_parts:
        if sf not in _DEAL_SORT_FIELDS:
            raise HTTPException(
                status_code=422,
                detail=f"Недопустимое поле сортировки: {sf}. Допустимо: {', '.join(sorted(_DEAL_SORT_FIELDS))}",
            )
    order_parts = [o.strip().lower() for o in (order or "desc").split(",") if o.strip()]
    while len(order_parts) < len(sort_parts):
        order_parts.append(order_parts[-1] if order_parts else "desc")
    cols = []
    dirs = []
    for sf, of in zip(sort_parts, order_parts):
        cols.append(_sort_column(sf))
        dirs.append("asc" if of == "asc" else "desc")
    cols.append(Deal.id)
    dirs.append("desc")
    sp = sort_parts + ["id"]
    op = dirs
    return sp, op, cols, dirs


def _order_by_clauses(sort: str | None, order: str | None):
    _, _, cols, dirs = _deal_order_spec(sort, order)
    clauses = []
    for col, d in zip(cols, dirs):
        if d == "asc":
            clauses.append(nullslast(asc(col)))
        else:
            clauses.append(nullslast(desc(col)))
    return clauses


def _deals_list_fingerprint(
    *,
    funnel_id: str | None,
    stage: str | None,
    assignee_id: str | None,
    client_id: str | None,
    source: str | None,
    is_archived: bool | None,
    search: str | None,
) -> str:
    arch = "false" if is_archived is None or not is_archived else "true"
    return filter_fingerprint(
        {
            "funnel_id": (funnel_id or "").strip(),
            "stage": (stage or "").strip(),
            "assignee_id": (assignee_id or "").strip(),
            "client_id": (client_id or "").strip(),
            "source": (source or "").strip(),
            "is_archived": arch,
            "search": (search or "").strip(),
        }
    )


def _deal_list_conditions(
    *,
    funnel_id: str | None,
    stage: str | None,
    assignee_id: str | None,
    client_id: str | None,
    source: str | None,
    is_archived: bool | None,
    search: str | None,
) -> list:
    conds: list = []
    if funnel_id:
        conds.append(Deal.funnel_id == funnel_id)
    if stage is not None:
        conds.append(Deal.stage == stage)
    if assignee_id is not None:
        conds.append(Deal.assignee_id == assignee_id)
    if client_id is not None:
        conds.append(Deal.client_id == client_id)
    if source is not None:
        conds.append(Deal.source == source)
    if is_archived is None:
        conds.append(Deal.is_archived.is_(False))
    else:
        conds.append(Deal.is_archived.is_(bool(is_archived)))
    if search and search.strip():
        pat = f"%{search.strip()}%"
        client_match = exists(
            select(1).where(
                Client.id == Deal.client_id,
                or_(Client.name.ilike(pat), Client.notes.ilike(pat), Client.company_name.ilike(pat)),
            )
        )
        conds.append(or_(Deal.title.ilike(pat), client_match))
    return conds


@router.get("", response_model=DealListResponse)
async def list_deals(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
    limit: Annotated[int, Query(ge=1, le=_MAX_LIMIT)] = _DEFAULT_LIMIT,
    cursor: str | None = None,
    funnel_id: str | None = None,
    stage: str | None = None,
    assignee_id: str | None = None,
    client_id: str | None = None,
    source: str | None = None,
    is_archived: bool | None = None,
    search: str | None = None,
    sort: str | None = None,
    order: str | None = None,
):
    conds = _deal_list_conditions(
        funnel_id=funnel_id,
        stage=stage,
        assignee_id=assignee_id,
        client_id=client_id,
        source=source,
        is_archived=is_archived,
        search=search,
    )
    cnt = select(func.count()).select_from(Deal)
    if conds:
        cnt = cnt.where(*conds)
    total = int((await db.execute(cnt)).scalar_one())

    sp, op, cols, dirs = _deal_order_spec(sort, order)
    fh = _deals_list_fingerprint(
        funnel_id=funnel_id,
        stage=stage,
        assignee_id=assignee_id,
        client_id=client_id,
        source=source,
        is_archived=is_archived,
        search=search,
    )
    seek = None
    if cursor and cursor.strip():
        try:
            payload = decode_list_cursor(cursor)
            vals = assert_cursor_matches(
                payload,
                resource="deals",
                sort_parts=sp,
                order_parts=op,
                fingerprint=fh,
            )
            seek = build_seek_after(cols, dirs, vals)
        except ListCursorError:
            raise HTTPException(status_code=400, detail="invalid_cursor") from None

    stmt = select(Deal).options(selectinload(Deal.client), selectinload(Deal.contact))
    if conds:
        stmt = stmt.where(*conds)
    if seek is not None:
        stmt = stmt.where(seek)
    stmt = stmt.order_by(*_order_by_clauses(sort, order)).limit(limit)
    rows = list((await db.execute(stmt)).scalars().all())
    items = [deal_row_to_read(d) for d in rows]
    next_c = None
    if rows and len(rows) == limit:
        next_c = encode_list_cursor(
            {
                "r": "deals",
                "sp": sp,
                "op": op,
                "fh": fh,
                "vals": row_seek_values(cols, rows[-1]),
            }
        )
    return DealListResponse(items=items, total=total, limit=limit, next_cursor=next_c)


@router.get(
    "/{deal_id}/media/signed",
    response_model=PresignedUrlResponse,
    dependencies=[Depends(require_crm_deals_edit)],
)
async def deal_media_signed_url(
    deal_id: str,
    key: Annotated[str, Query(min_length=1)],
    db: AsyncSession = Depends(get_db),
):
    """Presigned GET на объект в S3 (ключ хранится в JSON комментариев сделки)."""
    if not is_media_storage_configured():
        raise HTTPException(status_code=503, detail="media_storage_unavailable")
    res = await db.execute(select(Deal).where(Deal.id == deal_id))
    deal = res.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="deal_not_found")
    k = key.strip()
    if not storage_key_belongs_to_deal(deal_id, k):
        raise HTTPException(status_code=400, detail="invalid_media_key")
    if not deal_json_contains_storage_key(deal.comments, k):
        raise HTTPException(status_code=404, detail="media_not_found")
    sec = int(get_settings().S3_SIGNED_URL_EXPIRE_SECONDS)
    url = await generate_presigned_get_url_async(k, sec)
    if not url:
        raise HTTPException(status_code=502, detail="presign_failed")
    return PresignedUrlResponse(url=url, expiresIn=sec)


@router.put("", response_model=OkResponse, dependencies=[Depends(require_crm_deals_edit)])
async def update_deals(
    deals: list[DealBulkItem],
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    def str_val(v):
        return str(v) if v is not None else None

    def safe_id(raw):
        if not raw:
            return str(uuid.uuid4())
        sid = str(raw)
        if len(sid) > 36:
            return str(uuid.uuid4())
        return sid

    for deal_item in deals:
        d = deal_item.model_dump(exclude_unset=True)
        did = safe_id(deal_item.id)
        existing = await db.get(Deal, did)
        prev_assignee = existing.assignee_id if existing else None
        prev_stage = existing.stage if existing else None
        payload = {
            "id": did,
            "title": _lim(d.get("title", ""), 500) or "",
            "client_id": _lim(d.get("clientId"), 36),
            "contact_id": _contact_id_from_bulk(deal_item, existing),
            "contact_name": _lim(d.get("contactName"), 255),
            "amount": _dec_amount(d.get("amount")),
            "currency": _lim(d.get("currency", "UZS"), 10) or "UZS",
            "stage": _lim(d.get("stage", "new"), 100) or "new",
            "funnel_id": _lim(d.get("funnelId"), 36),
            "source": _lim(d.get("source"), 50),
            "source_chat_id": _source_chat_from_bulk(deal_item, existing),
            "tags": _tags_from_bulk(deal_item, existing),
            "custom_fields": _custom_fields_from_bulk(deal_item, existing),
            "lost_reason": _lost_reason_from_bulk(deal_item, existing),
            "assignee_id": _assignee_from_bulk(deal_item, existing),
            "created_at": d.get("createdAt", existing.created_at if existing else datetime.utcnow().isoformat()),
            "notes": d.get("notes"),
            "project_id": _lim(d.get("projectId"), 36),
            "comments": d.get("comments", existing.comments if existing else []) or [],
            "is_archived": d.get("isArchived", False),
            "recurring": d.get("recurring", False),
            "number": _lim(d.get("number"), 100),
            "status": _lim(d.get("status"), 30),
            "description": d.get("description"),
            "date": _lim(d.get("date"), 50),
            "due_date": _lim(d.get("dueDate"), 50),
            "paid_amount": str_val(d.get("paidAmount")),
            "paid_date": _lim(d.get("paidDate"), 50),
            "start_date": _lim(d.get("startDate"), 50),
            "end_date": _lim(d.get("endDate"), 50),
            "payment_day": str(d.get("paymentDay"))[:10] if d.get("paymentDay") is not None else None,
            "updated_at": d.get("updatedAt"),
        }
        cid_put = normalize_deal_client_id(payload["client_id"])
        await assert_deal_client_id_exists(db, cid_put)
        await assert_contact_allowed_for_client(db, contact_id=payload["contact_id"], client_id=cid_put)
        assert_won_requires_client_id(payload["stage"], cid_put)
        await _validate_stage_change_for_put(
            db,
            existing=existing,
            new_stage=payload["stage"],
            new_lost_reason=payload["lost_reason"],
            current_user=current_user,
        )
        stmt = insert(Deal).values(**payload)
        stmt = stmt.on_conflict_do_update(
            index_elements=[Deal.id],
            set_={
                "title": payload["title"],
                "client_id": payload["client_id"],
                "contact_id": payload["contact_id"],
                "contact_name": payload["contact_name"],
                "amount": payload["amount"],
                "currency": payload["currency"],
                "stage": payload["stage"],
                "funnel_id": payload["funnel_id"],
                "source": payload["source"],
                "source_chat_id": payload["source_chat_id"],
                "tags": payload["tags"],
                "custom_fields": payload["custom_fields"],
                "lost_reason": payload["lost_reason"],
                "assignee_id": payload["assignee_id"],
                "notes": payload["notes"],
                "project_id": payload["project_id"],
                "comments": payload["comments"],
                "is_archived": payload["is_archived"],
                "recurring": payload["recurring"],
                "number": payload["number"],
                "status": payload["status"],
                "description": payload["description"],
                "date": payload["date"],
                "due_date": payload["due_date"],
                "paid_amount": payload["paid_amount"],
                "paid_date": payload["paid_date"],
                "start_date": payload["start_date"],
                "end_date": payload["end_date"],
                "payment_day": payload["payment_day"],
                "updated_at": payload["updated_at"],
                "version": Deal.__table__.c.version + 1,
            },
        )
        await db.execute(stmt)
        await db.flush()
        deal_row = await db.get(Deal, did)
        if deal_row:
            await maybe_ensure_contact_for_deal(db, deal_row)
            await db.flush()
        if deal_just_archived(existing=existing, row=deal_row):
            await archive_entities_linked_to_deal(db, did)
        if existing is not None and deal_row and prev_stage is not None and deal_row.stage != prev_stage:
            await log_entity_mutation(
                db,
                event_type="deal.stage.changed",
                entity_type="deal",
                entity_id=did,
                source="deals-router",
                actor_id=d.get("createdByUserId"),
                payload={
                    "dealId": did,
                    "title": deal_row.title or payload["title"],
                    "fromStage": prev_stage,
                    "toStage": deal_row.stage,
                    "assigneeId": deal_row.assignee_id or payload["assignee_id"] or None,
                },
            )
        if deal_row:
            await log_entity_mutation(
                db,
                event_type="deal.updated" if existing is not None else "deal.created",
                entity_type="deal",
                entity_id=did,
                source="deals-router",
                actor_id=d.get("createdByUserId"),
                payload={"title": deal_row.title or payload["title"], "stage": deal_row.stage},
            )

        mut_payload: dict = {
            "title": (deal_row.title if deal_row else payload.get("title")),
            "stage": deal_row.stage if deal_row else payload.get("stage"),
        }
        if (
            existing is not None
            and deal_row
            and prev_stage is not None
            and deal_row.stage != prev_stage
        ):
            mut_payload["stage_transition"] = {
                "from_stage": prev_stage,
                "to_stage": deal_row.stage,
                "lost_reason": deal_row.lost_reason,
            }
        await log_mutation(
            db,
            "create" if existing is None else "update",
            "deal",
            did,
            actor_id=d.get("createdByUserId") or current_user.id,
            source="deals-router",
            request_id=_request_id(request),
            payload=mut_payload,
        )

        assignee = payload["assignee_id"] or (existing.assignee_id if existing else None)
        actor_id = d.get("createdByUserId")
        if existing is None and assignee:
            await emit_domain_event(
                db,
                event_type="deal.assigned",
                org_id="default",
                entity_type="deal",
                entity_id=did,
                source="deals-router",
                actor_id=actor_id,
                payload={
                    "dealId": did,
                    "title": payload["title"],
                    "assigneeId": assignee,
                },
            )
        elif existing and assignee and assignee != prev_assignee:
            await emit_domain_event(
                db,
                event_type="deal.assigned",
                org_id="default",
                entity_type="deal",
                entity_id=did,
                source="deals-router",
                actor_id=actor_id,
                payload={
                    "dealId": did,
                    "title": payload["title"] or existing.title,
                    "assigneeId": assignee,
                },
            )
    await db.commit()
    return OkResponse()


@router.post("", response_model=DealRead, status_code=201, dependencies=[Depends(require_crm_deals_single_write)])
async def create_deal(
    body: DealCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    did = body.id or str(uuid.uuid4())
    if len(did) > 36:
        did = str(uuid.uuid4())
    assignee_id = body.assignee_id
    if assignee_id == "":
        assignee_id = None
    if not assignee_id and body.funnel_id:
        funnel = await db.get(SalesFunnel, body.funnel_id)
        if funnel and getattr(funnel, "owner_user_id", None):
            assignee_id = funnel.owner_user_id
    is_admin = await user_may_bypass_deal_terminal_stage(db, current_user)
    assert_deal_stage_transition_allowed(
        from_stage=None,
        to_stage=body.stage,
        lost_reason_effective=body.lost_reason,
        is_admin=is_admin,
    )
    cid_create = normalize_deal_client_id(body.client_id)
    await assert_deal_client_id_exists(db, cid_create)
    await assert_contact_allowed_for_client(db, contact_id=body.contact_id, client_id=cid_create)
    assert_won_requires_client_id(body.stage, cid_create)
    row = deal_from_create(body, did, assignee_id=assignee_id)
    db.add(row)
    await db.flush()
    await maybe_ensure_contact_for_deal(db, row)
    await db.flush()
    await log_mutation(
        db,
        "create",
        "deal",
        did,
        actor_id=body.created_by_user_id,
        source="deals-router",
        request_id=_request_id(request),
        payload={"title": row.title, "stage": row.stage},
    )
    if assignee_id:
        await emit_domain_event(
            db,
            event_type="deal.assigned",
            org_id="default",
            entity_type="deal",
            entity_id=did,
            source="deals-router",
            actor_id=body.created_by_user_id,
            payload={
                "dealId": did,
                "title": row.title,
                "assigneeId": assignee_id,
            },
        )
    await db.commit()
    res = await db.execute(
        select(Deal).options(selectinload(Deal.client), selectinload(Deal.contact)).where(Deal.id == did)
    )
    row_out = res.scalar_one()
    return deal_row_to_read(row_out)


@router.get("/{deal_id}", response_model=DealRead)
async def get_deal(deal_id: str, db: AsyncSession = Depends(get_db)):
    res = await db.execute(
        select(Deal).options(selectinload(Deal.client), selectinload(Deal.contact)).where(Deal.id == deal_id)
    )
    deal = res.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="deal_not_found")
    return deal_row_to_read(deal)


@router.patch("/{deal_id}", response_model=DealRead, dependencies=[Depends(require_crm_deals_single_write)])
async def patch_deal(
    deal_id: str,
    patch: DealUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    if_match: str | None = Header(default=None, alias="If-Match"),
):
    deal = await db.get(Deal, deal_id)
    if not deal:
        raise HTTPException(status_code=404, detail="deal_not_found")
    exp = merge_expected_version(
        if_match=parse_if_match_header(if_match),
        body_version=patch.version if "version" in patch.model_fields_set else None,
    )
    enforce_expected_version_row(row_version=int(deal.version), expected=exp)
    prev_stage = deal.stage
    dump = patch.model_dump(exclude_unset=True)
    prev_keys = sorted(k for k in dump.keys() if k != "updated_by_user_id")
    to_stage = dump["stage"] if "stage" in dump else deal.stage
    to_lost_reason = dump["lost_reason"] if "lost_reason" in dump else deal.lost_reason
    is_admin = await user_may_bypass_deal_terminal_stage(db, current_user)
    assert_deal_stage_transition_allowed(
        from_stage=deal.stage,
        to_stage=to_stage,
        lost_reason_effective=to_lost_reason,
        is_admin=is_admin,
    )
    next_cid = deal.client_id
    if "client_id" in dump:
        v = dump["client_id"]
        next_cid = None if v in (None, "") else (str(v).strip()[:36] or None)
    next_contact_id = deal.contact_id
    if "contact_id" in dump:
        v = dump["contact_id"]
        next_contact_id = None if v in (None, "") else (str(v).strip()[:36] or None)
    await assert_deal_client_id_exists(db, next_cid)
    await assert_contact_allowed_for_client(db, contact_id=next_contact_id, client_id=next_cid)
    assert_won_requires_client_id(str(to_stage) if to_stage is not None else None, next_cid)
    was_archived = bool(deal.is_archived)
    apply_deal_patch_to_row(deal, patch)
    deal.updated_at = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
    await db.flush()
    await maybe_ensure_contact_for_deal(db, deal)
    await db.flush()
    if bool(deal.is_archived) and not was_archived:
        await archive_entities_linked_to_deal(db, deal_id)
    if "stage" in dump and deal.stage != prev_stage:
        await log_entity_mutation(
            db,
            event_type="deal.stage.changed",
            entity_type="deal",
            entity_id=deal_id,
            source="deals-router-patch",
            actor_id=patch.updated_by_user_id,
            payload={
                "dealId": deal_id,
                "title": deal.title,
                "fromStage": prev_stage,
                "toStage": deal.stage,
                "assigneeId": deal.assignee_id,
            },
        )
    await log_entity_mutation(
        db,
        event_type="deal.patched",
        entity_type="deal",
        entity_id=deal_id,
        source="deals-router-patch",
        actor_id=patch.updated_by_user_id,
        payload={"fields": prev_keys},
    )
    patch_payload: dict = {"title": deal.title, "stage": deal.stage, "fields": prev_keys}
    if "stage" in dump and deal.stage != prev_stage:
        patch_payload["stage_transition"] = {
            "from_stage": prev_stage,
            "to_stage": deal.stage,
            "lost_reason": deal.lost_reason,
        }
    await log_mutation(
        db,
        "update",
        "deal",
        deal_id,
        actor_id=patch.updated_by_user_id or (current_user.id if current_user else None),
        source="deals-router-patch",
        request_id=_request_id(request),
        payload=patch_payload,
    )
    await commit_or_stale_version_conflict(db)
    res = await db.execute(
        select(Deal).options(selectinload(Deal.client), selectinload(Deal.contact)).where(Deal.id == deal_id)
    )
    row_out = res.scalar_one()
    return deal_row_to_read(row_out)


@router.delete("/{deal_id}", response_model=OkResponse, dependencies=[Depends(require_crm_deals_single_write)])
async def delete_deal(
    deal_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    deal = await db.get(Deal, deal_id)
    if deal:
        deal.is_archived = True
        await db.flush()
        await archive_entities_linked_to_deal(db, deal_id)
        await log_entity_mutation(
            db,
            event_type="deal.archived",
            entity_type="deal",
            entity_id=deal_id,
            source="deals-router",
            payload={"title": deal.title},
        )
        await log_mutation(
            db,
            "update",
            "deal",
            deal_id,
            source="deals-router",
            request_id=_request_id(request),
            payload={"title": deal.title, "is_archived": True},
        )
        await db.commit()
    return OkResponse()
