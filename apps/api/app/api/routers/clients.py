"""Clients router — GET (пагинация, поиск), POST, PATCH; PUT — массовая синхронизация (legacy)."""
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
from app.models.client import Client
from app.schemas.clients import ClientBulkItem, ClientCreate, ClientListResponse, ClientRead, ClientUpdate
from app.schemas.common_responses import OkResponse
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

router = APIRouter(prefix="/clients", tags=["clients"], dependencies=[Depends(get_current_user)])


def _request_id(request: Request) -> str | None:
    return getattr(request.state, "request_id", None)

_DEFAULT_LIMIT = 50
_MAX_LIMIT = 500


# «created_at» у clients в модели нет — сортировка только по реальным колонкам (см. Client).
_CLIENT_SORT_KEYS = frozenset({"name", "company_name", "id"})


def _client_sort_key(sort: str | None) -> str:
    if sort is None or not str(sort).strip():
        return "name"
    k = str(sort).strip()
    if k not in _CLIENT_SORT_KEYS:
        raise HTTPException(
            status_code=422,
            detail=f"Недопустимое поле сортировки: {k}. Допустимо: {', '.join(sorted(_CLIENT_SORT_KEYS))}",
        )
    return k


def _client_sort_column(name: str):
    key = (name or "name").strip()
    m = {
        "name": Client.name,
        "company_name": Client.company_name,
        "id": Client.id,
    }
    return m[key]


def _client_order_spec(sort: str | None, order: str | None):
    sk = _client_sort_key(sort)
    sort_col = _client_sort_column(sk)
    direction = (order or "asc").strip().lower()
    d = "desc" if direction == "desc" else "asc"
    cols = [sort_col, Client.id]
    dirs = [d, d]
    sp = [sk, "id"]
    op = dirs
    return sp, op, cols, dirs


def _order_clauses(sort: str | None, order: str | None):
    _, _, cols, dirs = _client_order_spec(sort, order)
    out = []
    for col, d in zip(cols, dirs):
        if d == "desc":
            out.append(nullslast(desc(col)))
        else:
            out.append(nullslast(asc(col)))
    return out


def _list_conditions(*, search: str | None, is_archived: bool | None) -> list:
    conds: list = []
    if is_archived is not None:
        conds.append(Client.is_archived.is_(bool(is_archived)))
    if search and search.strip():
        raw = search.strip()
        pat = f"%{raw}%"
        parts = [
            Client.name.ilike(pat),
            Client.email.ilike(pat),
            Client.phone.ilike(pat),
        ]
        np = normalize_phone(raw)
        if np:
            parts.append(Client.phone == np)
        conds.append(or_(*parts))
    return conds


def _clients_list_fingerprint(*, search: str | None, is_archived: bool | None) -> str:
    arch = "any" if is_archived is None else ("true" if is_archived else "false")
    return filter_fingerprint({"search": (search or "").strip(), "is_archived": arch})


def _normalize_client_tags(raw) -> list[str]:
    """ARRAY(Text) / легаси: безопасно приводим к list[str]."""
    if raw is None:
        return []
    if isinstance(raw, list | tuple):
        return [str(x) for x in raw if x is not None]
    return []


def _row_to_read(row: Client) -> ClientRead:
    return ClientRead(
        id=str(row.id),
        version=int(getattr(row, "version", 1) or 1),
        name=str(row.name or ""),
        phone=row.phone,
        email=row.email,
        telegram=row.telegram,
        instagram=row.instagram,
        company_name=row.company_name,
        notes=row.notes,
        tags=_normalize_client_tags(getattr(row, "tags", None)),
        is_archived=bool(row.is_archived or False),
    )


@router.get("", response_model=ClientListResponse)
async def list_clients(
    db: AsyncSession = Depends(get_db),
    limit: Annotated[int, Query(ge=1, le=_MAX_LIMIT)] = _DEFAULT_LIMIT,
    cursor: str | None = None,
    search: str | None = None,
    is_archived: bool | None = None,
    sort: str | None = None,
    order: str | None = None,
):
    conds = _list_conditions(search=search, is_archived=is_archived)
    cnt = select(func.count()).select_from(Client)
    if conds:
        cnt = cnt.where(*conds)
    total = int((await db.execute(cnt)).scalar_one())

    sp, op, cols, dirs = _client_order_spec(sort, order)
    fh = _clients_list_fingerprint(search=search, is_archived=is_archived)
    seek = None
    if cursor and cursor.strip():
        try:
            payload = decode_list_cursor(cursor)
            vals = assert_cursor_matches(
                payload,
                resource="clients",
                sort_parts=sp,
                order_parts=op,
                fingerprint=fh,
            )
            seek = build_seek_after(cols, dirs, vals)
        except ListCursorError:
            raise HTTPException(status_code=400, detail="invalid_cursor") from None

    stmt = select(Client)
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
                "r": "clients",
                "sp": sp,
                "op": op,
                "fh": fh,
                "vals": row_seek_values(cols, rows[-1]),
            }
        )
    return ClientListResponse(items=items, total=total, limit=limit, next_cursor=next_c)


@router.get("/{client_id}", response_model=ClientRead)
async def get_client(client_id: str, db: AsyncSession = Depends(get_db)):
    row = await db.get(Client, client_id)
    if not row:
        raise HTTPException(status_code=404, detail="Client not found")
    return _row_to_read(row)


@router.post("", response_model=ClientRead)
async def create_client(
    body: ClientCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    cid = (body.id or "").strip()
    if not cid:
        cid = str(uuid.uuid4())
    if len(cid) > 36:
        cid = str(uuid.uuid4())
    existing = await db.get(Client, cid)
    if existing:
        raise HTTPException(status_code=409, detail="Client id already exists")

    tags = normalize_client_tags(body.tags)
    row = Client(
        id=cid,
        version=1,
        name=body.name[:255],
        phone=normalize_phone(body.phone),
        email=normalize_email(body.email),
        telegram=(str(body.telegram).strip()[:100] or None) if body.telegram else None,
        instagram=(str(body.instagram).strip()[:255] or None) if body.instagram else None,
        company_name=(str(body.company_name).strip()[:255] or None) if body.company_name else None,
        notes=body.notes,
        tags=tags,
        is_archived=bool(body.is_archived),
    )
    db.add(row)
    await db.flush()
    await log_entity_mutation(
        db,
        event_type="client.created",
        entity_type="client",
        entity_id=cid,
        source="clients-router",
        payload={"name": row.name, "isArchived": row.is_archived},
    )
    await log_mutation(
        db,
        "create",
        "client",
        cid,
        source="clients-router",
        request_id=_request_id(request),
        payload={"name": row.name, "is_archived": row.is_archived},
    )
    await db.commit()
    await db.refresh(row)
    return _row_to_read(row)


@router.patch("/{client_id}", response_model=ClientRead)
async def patch_client(
    client_id: str,
    body: ClientUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    if_match: str | None = Header(default=None, alias="If-Match"),
):
    row = await db.get(Client, client_id)
    if not row:
        raise HTTPException(status_code=404, detail="Client not found")

    exp = merge_expected_version(
        if_match=parse_if_match_header(if_match),
        body_version=body.version if "version" in body.model_fields_set else None,
    )
    enforce_expected_version_row(row_version=int(row.version), expected=exp)

    data = body.model_dump(exclude_unset=True, exclude={"version"})
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
    if "company_name" in data:
        cn = data.get("company_name")
        if cn is None or (isinstance(cn, str) and not cn.strip()):
            row.company_name = None
        else:
            row.company_name = str(cn).strip()[:255]
    if "notes" in data:
        row.notes = data.get("notes")
    if "tags" in data:
        row.tags = normalize_client_tags(data.get("tags"))
    if "is_archived" in data and data["is_archived"] is not None:
        row.is_archived = bool(data["is_archived"])

    await db.flush()
    await log_entity_mutation(
        db,
        event_type="client.updated",
        entity_type="client",
        entity_id=client_id,
        source="clients-router",
        payload={"name": row.name, "isArchived": row.is_archived},
    )
    await log_mutation(
        db,
        "update",
        "client",
        client_id,
        source="clients-router",
        request_id=_request_id(request),
        payload={"name": row.name, "is_archived": row.is_archived},
    )
    await commit_or_stale_version_conflict(db)
    await db.refresh(row)
    return _row_to_read(row)


@router.put("", response_model=OkResponse)
async def update_clients(clients: list[ClientBulkItem], request: Request, db: AsyncSession = Depends(get_db)):
    for c in clients:
        cid = c.id
        if not cid:
            continue
        fs = c.model_fields_set
        existing = await db.get(Client, cid)
        is_new = existing is None
        tags_in = c.tags if "tags" in fs else None
        tags = normalize_client_tags(tags_in)
        if existing:
            existing.name = c.name or existing.name
            if "phone" in fs:
                existing.phone = normalize_phone(c.phone)
            if "email" in fs:
                existing.email = normalize_email(c.email)
            if "telegram" in fs:
                t = c.telegram
                existing.telegram = str(t).strip()[:100] or None if t else None
            if "instagram" in fs:
                ig = c.instagram
                existing.instagram = str(ig).strip()[:255] or None if ig else None
            if "companyName" in fs:
                cn = c.companyName
                existing.company_name = str(cn).strip()[:255] or None if cn else None
            if "notes" in fs:
                existing.notes = c.notes
            if tags_in is not None:
                existing.tags = tags
            if "isArchived" in fs:
                existing.is_archived = bool(c.isArchived)
        else:
            db.add(
                Client(
                    id=cid,
                    version=1,
                    name=c.name or "",
                    phone=normalize_phone(c.phone),
                    email=normalize_email(c.email),
                    telegram=(str(c.telegram).strip()[:100] or None) if c.telegram else None,
                    instagram=(str(c.instagram).strip()[:255] or None) if c.instagram else None,
                    company_name=(str(c.companyName).strip()[:255] or None) if c.companyName else None,
                    notes=c.notes,
                    tags=tags,
                    is_archived=c.isArchived,
                )
            )
        await db.flush()
        row = await db.get(Client, cid)
        await log_mutation(
            db,
            "create" if is_new else "update",
            "client",
            cid,
            source="clients-router",
            request_id=_request_id(request),
            payload={
                "name": row.name if row else c.name,
                "is_archived": row.is_archived if row else bool(c.isArchived),
            },
        )
        await log_entity_mutation(
            db,
            event_type="client.created" if is_new else "client.updated",
            entity_type="client",
            entity_id=cid,
            source="clients-router",
            payload={
                "name": row.name if row else c.name,
                "isArchived": getattr(row, "is_archived", False) if row else c.isArchived,
            },
        )
    await commit_or_stale_version_conflict(db)
    return {"ok": True}
