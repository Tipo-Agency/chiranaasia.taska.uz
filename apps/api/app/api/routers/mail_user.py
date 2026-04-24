"""Операции с подключённым ящиком пользователя (Gmail API)."""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.db import get_db
from app.models.user import User
from app.schemas.mail_integration import MailMessageItem, MailSendBody, MailSendResponse
from app.services.mail_google import list_gmail_messages, send_gmail_message

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/mail", tags=["mail"])


@router.get("/messages", response_model=list[MailMessageItem])
async def mail_list_messages(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(default=20, ge=1, le=50),
):
    try:
        raw = await list_gmail_messages(db, current_user.id, max_results=limit)
    except ValueError as e:
        if str(e) == "mail_not_connected":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="mail_not_connected")
        raise
    except Exception as e:
        logger.exception("mail list: %s", e)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="gmail_api_error")
    return [MailMessageItem.model_validate(x) for x in raw]


@router.post("/send", response_model=MailSendResponse)
async def mail_send(
    body: MailSendBody,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        out = await send_gmail_message(
            db,
            current_user.id,
            to=body.to.strip(),
            subject=body.subject.strip(),
            body_text=body.body or "",
        )
    except ValueError as e:
        code = str(e)
        if code in ("mail_not_connected", "mail_account_email_missing"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=code)
        raise
    except Exception as e:
        logger.exception("mail send: %s", e)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="gmail_send_error")
    return MailSendResponse(id=out.get("id", ""), threadId=out.get("threadId", ""))
