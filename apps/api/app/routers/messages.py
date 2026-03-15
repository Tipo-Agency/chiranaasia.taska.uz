"""Inbox/Outbox messages router."""
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.settings import InboxMessage
from app.utils import row_to_inbox_message

router = APIRouter(prefix="/messages", tags=["messages"])


@router.get("")
async def get_messages(
    folder: str = Query("inbox", description="inbox | outbox"),
    user_id: str = Query(..., description="Current user ID"),
    db: AsyncSession = Depends(get_db),
):
    """Get inbox (received) or outbox (sent) messages for user."""
    if folder == "outbox":
        result = await db.execute(
            select(InboxMessage).where(InboxMessage.sender_id == user_id).order_by(InboxMessage.created_at.desc())
        )
    else:
        result = await db.execute(
            select(InboxMessage).where(
                or_(InboxMessage.recipient_id == user_id, InboxMessage.recipient_id.is_(None))
            ).order_by(InboxMessage.created_at.desc())
        )
    rows = result.scalars().all()
    return [row_to_inbox_message(r) for r in rows]


@router.post("")
async def add_message(
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    """Create a new message. Body: senderId, recipientId?, text, attachments? (array of {entityType, entityId, label})."""
    mid = body.get("id") or str(uuid.uuid4())
    now = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
    db.add(InboxMessage(
        id=mid,
        sender_id=body.get("senderId", ""),
        recipient_id=body.get("recipientId"),
        text=body.get("text", ""),
        attachments=body.get("attachments", []),
        created_at=body.get("createdAt", now),
        read=False,
    ))
    await db.commit()
    return {"ok": True, "id": mid}


@router.patch("/{message_id}")
async def mark_read(
    message_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    """Mark message as read."""
    row = await db.get(InboxMessage, message_id)
    if row:
        row.read = body.get("read", True)
        await db.commit()
    return {"ok": True}
