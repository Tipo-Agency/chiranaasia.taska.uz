"""Отправка сообщений в Instagram (Graph API) из CRM."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_crm_messaging_access
from app.core.config import get_settings
from app.core.mappers import deal_row_to_camel_read
from app.db import get_db
from app.models.client import Deal
from app.models.user import User
from app.schemas.integrations import DealCamelRead, IntegrationDealSendBody, IntegrationMessagingOk
from app.services.messages import send_message

router = APIRouter(prefix="/integrations/meta", tags=["integrations-meta"])


@router.post(
    "/instagram/send",
    response_model=DealCamelRead | IntegrationMessagingOk,
)
async def instagram_send(
    body: IntegrationDealSendBody,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_crm_messaging_access),
):
    """Ответ клиенту в Instagram: тело { dealId, text }. Та же send_message(), что и для Telegram."""
    settings = get_settings()
    result = await send_message(
        db,
        deal_id=body.dealId,
        text=body.text,
        author_user_id=current_user.id,
        settings=settings,
    )
    if not result.success:
        raise HTTPException(status_code=result.status_code, detail=result.detail)
    await db.commit()
    did = result.deal.id if result.deal else body.dealId
    fresh = await db.get(Deal, did)
    return deal_row_to_camel_read(fresh) if fresh else IntegrationMessagingOk()
