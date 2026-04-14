"""Inbox/Outbox messages router."""
from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.mappers import row_to_inbox_message
from app.db import get_db
from app.models.settings import InboxMessage
from app.schemas.common_responses import MessageCreateResponse, OkResponse
from app.schemas.messages import MessageCreateBody, MessageListResponse, MessageReadPatchBody
from app.services.domain_events import log_entity_mutation
from app.services.inbox_messages_service import add_inbox_message, normalize_external_msg_id
from app.services.list_cursor_page import (
    ListCursorError,
    assert_cursor_matches,
    build_seek_after,
    decode_list_cursor,
    encode_list_cursor,
    filter_fingerprint,
    row_seek_values,
)

router = APIRouter(prefix="/messages", tags=["messages"], dependencies=[Depends(get_current_user)])


def _folder_where(folder: str, user_id: str):
    if folder == "outbox":
        return InboxMessage.sender_id == user_id
    if folder == "inbox":
        return or_(
            InboxMessage.recipient_id == user_id,
            InboxMessage.recipient_id.is_(None),
            InboxMessage.recipient_id == "",
        )
    raise HTTPException(status_code=400, detail="folder_must_be_inbox_or_outbox")


@router.get("", response_model=MessageListResponse)
async def get_messages(
    folder: str = Query("inbox", description="inbox | outbox"),
    user_id: str = Query(..., description="Current user ID"),
    deal_id: str | None = Query(None, description="Только сообщения сделки"),
    limit: int = Query(200, ge=1, le=500, description="Размер страницы"),
    cursor: str | None = None,
    order: str = Query("desc", description="Сортировка по created_at: asc | desc"),
    db: AsyncSession = Depends(get_db),
):
    """
    Список сообщений с пагинацией. Порядок: created_at, затем id (стабильно при одинаковых метках времени).
    """
    if order not in ("asc", "desc"):
        raise HTTPException(status_code=400, detail="order_must_be_asc_or_desc")

    cond = _folder_where(folder, user_id)
    did = (deal_id or "").strip()
    if did:
        cond = and_(cond, InboxMessage.deal_id == did)

    order_cols = (
        (InboxMessage.created_at.asc(), InboxMessage.id.asc())
        if order == "asc"
        else (InboxMessage.created_at.desc(), InboxMessage.id.desc())
    )
    sp = ["created_at", "id"]
    op = ["asc", "asc"] if order == "asc" else ["desc", "desc"]
    cols = [InboxMessage.created_at, InboxMessage.id]
    dirs = list(op)
    fh = filter_fingerprint(
        {"folder": folder.strip(), "user_id": user_id.strip(), "deal_id": did, "order": order}
    )

    seek = None
    if cursor and cursor.strip():
        try:
            payload = decode_list_cursor(cursor)
            vals = assert_cursor_matches(
                payload,
                resource="messages",
                sort_parts=sp,
                order_parts=op,
                fingerprint=fh,
            )
            seek = build_seek_after(cols, dirs, vals)
        except ListCursorError:
            raise HTTPException(status_code=400, detail="invalid_cursor") from None

    count_stmt = select(func.count()).select_from(InboxMessage).where(cond)
    total = int((await db.execute(count_stmt)).scalar_one())

    list_stmt = select(InboxMessage).where(cond)
    if seek is not None:
        list_stmt = list_stmt.where(seek)
    list_stmt = list_stmt.order_by(*order_cols).limit(limit)
    result = await db.execute(list_stmt)
    rows = list(result.scalars().all())
    next_c = None
    if rows and len(rows) == limit:
        next_c = encode_list_cursor(
            {
                "r": "messages",
                "sp": sp,
                "op": op,
                "fh": fh,
                "vals": row_seek_values(cols, rows[-1]),
            }
        )
    return {
        "items": [row_to_inbox_message(r) for r in rows],
        "total": total,
        "limit": limit,
        "next_cursor": next_c,
    }


@router.post("", response_model=MessageCreateResponse)
async def add_message(
    body: MessageCreateBody,
    db: AsyncSession = Depends(get_db),
):
    """Создать сообщение. text или body; при channel+externalMsgId — идемпотентная вставка."""
    mid = body.id or str(uuid.uuid4())
    now = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
    rid = body.recipientId
    if not rid:
        rid = None
    text = body.body or body.text or ""
    channel = str(body.channel or "internal").strip() or "internal"
    ext = body.externalMsgId or body.external_msg_id
    ext_norm = normalize_external_msg_id(ext)
    direction = str(body.direction or "out").strip() or "out"
    deal_id = body.dealId or body.deal_id
    funnel_id = body.funnelId or body.funnel_id
    media_url = body.mediaUrl or body.media_url

    final_id, inserted = await add_inbox_message(
        db,
        id=mid,
        deal_id=str(deal_id).strip() if deal_id else None,
        funnel_id=str(funnel_id).strip() if funnel_id else None,
        direction=direction,
        channel=channel,
        sender_id=str(body.senderId or ""),
        body=text,
        media_url=str(media_url).strip() if media_url else None,
        external_msg_id=ext_norm,
        recipient_id=str(rid).strip() if rid else None,
        attachments=body.attachments or [],
        created_at=body.createdAt or now,
        is_read=False,
    )
    if inserted:
        await log_entity_mutation(
            db,
            event_type="chat.message.sent",
            entity_type="inbox_message",
            entity_id=final_id,
            source="messages-router",
            actor_id=body.senderId or None,
            payload={
                "recipientId": rid,
                "textLen": len(text),
                "attachmentCount": len(body.attachments or []),
                "channel": channel,
                "deduplicated": False,
            },
        )
    await db.commit()
    return {"ok": True, "id": final_id, "deduplicated": not inserted}


@router.patch("/{message_id}", response_model=OkResponse)
async def mark_read(
    message_id: str,
    body: MessageReadPatchBody,
    db: AsyncSession = Depends(get_db),
):
    """Mark message as read."""
    row = await db.get(InboxMessage, message_id)
    if row:
        v = body.read if body.read is not None else body.isRead
        row.is_read = True if v is None else v
        await db.flush()
        await log_entity_mutation(
            db,
            event_type="chat.message.read",
            entity_type="inbox_message",
            entity_id=message_id,
            source="messages-router",
            payload={"read": row.is_read},
        )
        await db.commit()
    return {"ok": True}
