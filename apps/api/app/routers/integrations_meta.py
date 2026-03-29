"""Отправка сообщений в Instagram (Graph API) из CRM."""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.config import get_settings
from app.database import get_db
from app.models.client import Deal
from app.models.user import User
from app.services.meta_instagram import parse_thread_key, send_instagram_text
from app.utils import row_to_deal

router = APIRouter(prefix="/integrations/meta", tags=["integrations-meta"])


@router.post("/instagram/send")
async def instagram_send(
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Ответ клиенту в Instagram: тело { dealId, text }."""
    deal_id = body.get("dealId")
    text = (body.get("text") or "").strip()
    if not deal_id or not text:
        raise HTTPException(status_code=400, detail="dealId и text обязательны")
    deal = await db.get(Deal, deal_id)
    if not deal or deal.is_archived:
        raise HTTPException(status_code=404, detail="Сделка не найдена")
    if deal.source != "instagram":
        raise HTTPException(status_code=400, detail="Сделка не из Instagram")
    parsed = parse_thread_key(deal.telegram_chat_id or "")
    if not parsed:
        raise HTTPException(status_code=400, detail="У сделки нет привязки Instagram (telegramChatId)")
    page_id, recipient_psid = parsed
    settings = get_settings()
    try:
        await send_instagram_text(page_id, recipient_psid, text, settings)
    except ValueError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

    comments = list(deal.comments or [])
    now = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
    comments.append(
        {
            "id": f"ig-out-{int(datetime.now(UTC).timestamp() * 1000)}",
            "text": text,
            "authorId": current_user.id,
            "createdAt": now,
            "type": "instagram_out",
        }
    )
    deal.comments = comments
    deal.updated_at = now
    await db.commit()
    fresh = await db.get(Deal, deal_id)
    return row_to_deal(fresh) if fresh else {"ok": True}
