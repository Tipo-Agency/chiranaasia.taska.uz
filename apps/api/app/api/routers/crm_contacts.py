"""CRM-контакты — GET (список/один), POST, PATCH."""
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from sqlalchemy import asc, desc, func, nullslast, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.optimistic_version import (
    commit_or_stale_version_conflict,
    enforce_expected_version_row,
    merge_expected_version,
    parse_if_match_header,
)
from app.db import get_db
from app.models.client import CrmContact
from app.schemas.crm_contacts import (
    CrmContactCreate,
    CrmContactListResponse,
    CrmContactRead,
    CrmContactUpdate,
)
from app.services.audit_log import log_mutation
from app.services.client_contact import normalize_client_tags, normalize_email, normalize_phone
from app.services.domain_events import log_entity_mutation
from app.services.list_cursor_page import (
    ListCursorError,
    assert_cursor_matches,
    build_seek_after,
    decode_list_cursor,
    encode_list_cursor,
    filter_fingerprint,
    row_seek_values,
)

router = APIRouter(prefix="/contacts", tags=["contacts"], dependencies=[Depends(get_current_user)])

_DEFAULT_LIMIT = 50
_MAX_LIMIT = 500

_SORT_KEYS = frozenset({"name", "id"})


def _request_id(request: Request) -> str | None:
    return getattr(request.state, "request_id", None)


def _sort_key(sort: str | None) -> str:
    if sort is None or not str(sort).strip():
        return "name"
    k = str(sort).strip()
    if k not in _SORT_KEYS:
        raise HTTPException(
            status_code=422,
            detail=f"Недопустимое поле сортировки: {k}. Допустимо: {', '.join(sorted(_SORT_KEYS))}",
        )
    return k


def _sort_column(name: str):
    key = (name or "name").strip()
    return CrmContact.name if key == "name" else CrmContact.id


def _order_spec(sort: str | None, order: str | None):
    sk = _sort_key(sort)
    sort_col = _sort_column(sk)
    direction = (order or "asc").strip().lower()
    d = "desc" if direction == "desc" else "asc"
    cols = [sort_col, CrmContact.id]
    dirs = [d, d]
    sp = [sk, "id"]
    op = dirs
    return sp, op, cols, dirs


def _order_clauses(sort: str | None, order: str | None):
    _, _, cols, dirs = _order_spec(sort, order)
    out = []
    for col, d in zip(cols, dirs):
        if d == "desc":
            out.append(nullslast(desc(col)))
        else:
            out.append(nullslast(asc(col)))
    return out


def _list_conditions(
    *,
    search: str | None,
    is_archived: bool | None,
    client_id: str | None,
) -> list:
    conds: list = []
    if is_archived is not None:
        conds.append(CrmContact.is_archived.is_(bool(is_archived)))
    if client_id and str(client_id).strip():
        conds.append(CrmContact.client_id == str(client_id).strip()[:36])
    if search and search.strip():
        raw = search.strip()
        pat = f"%{raw}%"
        parts = [
            CrmContact.name.ilike(pat),
            CrmContact.email.ilike(pat),
            CrmContact.phone.ilike(pat),
            CrmContact.telegram.ilike(pat),
            CrmContact.instagram.ilike(pat),
        ]
        np = normalize_phone(raw)
        if np:
            parts.append(CrmContact.phone == np)
        conds.append(or_(*parts))
    return conds


def _list_fingerprint(*, search: str | None, is_archived: bool | None, client_id: str | None) -> str:
    arch = "any" if is_archived is None else ("true" if is_archived else "false")
    cid = (client_id or "").strip()
    return filter_fingerprint({"search": (search or "").strip(), "is_archived": arch, "client_id": cid})


def _row_to_read(row: CrmContact) -> CrmContactRead:
    tags = list(row.tags) if row.tags is not None else []
    return CrmContactRead(
        id=str(row.id),
        version=int(getattr(row, "version", 1) or 1),
        client_id=row.client_id,
        name=str(row.name or ""),
        phone=row.phone,
        email=row.email,
        telegram=row.telegram,
        instagram=row.instagram,
        job_title=row.job_title,
        notes=row.notes,
        tags=[str(x) for x in tags if x is not None],
        is_archived=bool(row.is_archived or False),
    )


@router.get("", response_model=CrmContactListResponse)
async def list_contacts(
    db: AsyncSession = Depends(get_db),
    limit: Annotated[int, Query(ge=1, le=_MAX_LIMIT)] = _DEFAULT_LIMIT,
    cursor: str | None = None,
    search: str | None = None,
    is_archived: bool | None = None,
    client_id: str | None = None,
    sort: str | None = None,
    order: str | None = None,
):
    conds = _list_conditions(search=search, is_archived=is_archived, client_id=client_id)
    cnt = select(func.count()).select_from(CrmContact)
    if conds:
        cnt = cnt.where(*conds)
    total = int((await db.execute(cnt)).scalar_one())

    sp, op, cols, dirs = _order_spec(sort, order)
    fh = _list_fingerprint(search=search, is_archived=is_archived, client_id=client_id)
    seek = None
    if cursor and cursor.strip():
        try:
            payload = decode_list_cursor(cursor)
            vals = assert_cursor_matches(
                payload,
                resource="crm_contacts",
                sort_parts=sp,
                order_parts=op,
                fingerprint=fh,
            )
            seek = build_seek_after(cols, dirs, vals)
        except ListCursorError:
            raise HTTPException(status_code=400, detail="invalid_cursor") from None

    stmt = select(CrmContact)
    if conds:
        stmt = stmt.where(*conds)
    if seek is not None:
        stmt = stmt.where(seek)
    stmt = stmt.order_by(*_order_clauses(sort, order)).limit(limit)
    rows = list((await db.execute(stmt)).scalars().all())
    items = [_row_to_read(c) for c in rows]
    next_c = None
    if rows and len(rows) == limit:
        next_c = encode_list_cursor(
            {
                "r": "crm_contacts",
                "sp": sp,
                "op": op,
                "fh": fh,
                "vals": row_seek_values(cols, rows[-1]),
            }
        )
    return CrmContactListResponse(items=items, total=total, limit=limit, next_cursor=next_c)


@router.get("/{contact_id}", response_model=CrmContactRead)
async def get_contact(contact_id: str, db: AsyncSession = Depends(get_db)):
    row = await db.get(CrmContact, contact_id)
    if not row:
        raise HTTPException(status_code=404, detail="contact_not_found")
    return _row_to_read(row)


@router.post("", response_model=CrmContactRead, status_code=201)
async def create_contact(
    body: CrmContactCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    cid = (body.id or "").strip()
    if not cid:
        cid = str(uuid.uuid4())
    if len(cid) > 36:
        cid = str(uuid.uuid4())
    existing = await db.get(CrmContact, cid)
    if existing:
        raise HTTPException(status_code=409, detail="contact_id_already_exists")

    tags = normalize_client_tags(body.tags, max_items=200)
    client_id = (body.client_id.strip()[:36] or None) if body.client_id else None
    row = CrmContact(
        id=cid,
        version=1,
        client_id=client_id,
        name=body.name[:255],
        phone=normalize_phone(body.phone),
        email=normalize_email(body.email),
        telegram=(str(body.telegram).strip()[:100] or None) if body.telegram else None,
        instagram=(str(body.instagram).strip()[:255] or None) if body.instagram else None,
        job_title=(str(body.job_title).strip()[:255] or None) if body.job_title else None,
        notes=body.notes,
        tags=tags,
        is_archived=bool(body.is_archived),
    )
    db.add(row)
    await db.flush()
    await log_entity_mutation(
        db,
        event_type="crm_contact.created",
        entity_type="crm_contact",
        entity_id=cid,
        source="contacts-router",
        payload={"name": row.name, "clientId": row.client_id},
    )
    await log_mutation(
        db,
        "create",
        "crm_contact",
        cid,
        source="contacts-router",
        request_id=_request_id(request),
        payload={"name": row.name, "client_id": row.client_id},
    )
    await db.commit()
    await db.refresh(row)
    return _row_to_read(row)


@router.patch("/{contact_id}", response_model=CrmContactRead)
async def patch_contact(
    contact_id: str,
    body: CrmContactUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    if_match: str | None = Header(default=None, alias="If-Match"),
):
    row = await db.get(CrmContact, contact_id)
    if not row:
        raise HTTPException(status_code=404, detail="contact_not_found")

    exp = merge_expected_version(
        if_match=parse_if_match_header(if_match),
        body_version=body.version if "version" in body.model_fields_set else None,
    )
    enforce_expected_version_row(row_version=int(row.version), expected=exp)

    data = body.model_dump(exclude_unset=True, exclude={"version"})
    if "client_id" in data:
        v = data["client_id"]
        row.client_id = None if v in (None, "") else str(v).strip()[:36] or None
    if "name" in data and data["name"] is not None:
        row.name = str(data["name"])[:255]
    if "phone" in data:
        row.phone = normalize_phone(data.get("phone"))
    if "email" in data:
        row.email = normalize_email(data.get("email"))
    if "telegram" in data:
        t = data.get("telegram")
        if t is None or (isinstance(t, str) and not t.strip()):
            row.telegram = None
        else:
            row.telegram = str(t).strip()[:100] or None
    if "instagram" in data:
        ig = data.get("instagram")
        if ig is None or (isinstance(ig, str) and not ig.strip()):
            row.instagram = None
        else:
            row.instagram = str(ig).strip()[:255] or None
    if "job_title" in data:
        jt = data.get("job_title")
        if jt is None or (isinstance(jt, str) and not jt.strip()):
            row.job_title = None
        else:
            row.job_title = str(jt).strip()[:255]
    if "notes" in data:
        row.notes = data.get("notes")
    if "tags" in data:
        row.tags = normalize_client_tags(data.get("tags"), max_items=200)
    if "is_archived" in data and data["is_archived"] is not None:
        row.is_archived = bool(data["is_archived"])

    await db.flush()
    await log_entity_mutation(
        db,
        event_type="crm_contact.updated",
        entity_type="crm_contact",
        entity_id=contact_id,
        source="contacts-router",
        payload={"name": row.name, "clientId": row.client_id},
    )
    await log_mutation(
        db,
        "update",
        "crm_contact",
        contact_id,
        source="contacts-router",
        request_id=_request_id(request),
        payload={"name": row.name, "client_id": row.client_id},
    )
    await commit_or_stale_version_conflict(db)
    await db.refresh(row)
    return _row_to_read(row)
