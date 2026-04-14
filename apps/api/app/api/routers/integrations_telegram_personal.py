"""Личный Telegram (MTProto): привязка аккаунта, синхрон сообщений в сделку, отправка от своего имени."""

from __future__ import annotations

import io

from fastapi import APIRouter, Body, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user, require_crm_messaging_access
from app.core.mappers import _legacy_telegram_username, deal_row_to_camel_read
from app.core.redis import get_redis_client
from app.db import get_db
from app.models.client import Client, Deal
from app.models.mtproto_session import MtprotoSession
from app.models.user import User
from app.schemas.common_responses import OkResponse
from app.schemas.integrations import (
    DealCamelRead,
    TelegramPersonalDealSendBody,
    TelegramPersonalPasswordBody,
    TelegramPersonalSendCodeBody,
    TelegramPersonalSendCodeResponse,
    TelegramPersonalSignInBody,
    TelegramPersonalSignInResponse,
    TelegramPersonalStatusResponse,
    TelegramPersonalSyncMessagesBody,
    TelegramPersonalSyncQueuedResponse,
)
from app.services import telegram_personal as tgp
from app.services.integrations_stream import ensure_integrations_stream, xadd_telegram_personal_sync_job

router = APIRouter(prefix="/integrations/telegram-personal", tags=["integrations-telegram-personal"])


def _peer_ok(deal: Deal, linked: Client | None = None) -> bool:
    if str(deal.source_chat_id or "").strip():
        return True
    if str(_legacy_telegram_username(deal.custom_fields) or "").strip().lstrip("@"):
        return True
    if linked and str(linked.telegram or "").strip().lstrip("@"):
        return True
    return False


@router.get("/status", response_model=TelegramPersonalStatusResponse)
async def personal_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    r = await db.execute(select(MtprotoSession).where(MtprotoSession.user_id == current_user.id))
    row = r.scalar_one_or_none()
    out = dict(tgp.status_dict(row))
    out["apiConfigured"] = tgp.mtproto_configured()
    return TelegramPersonalStatusResponse.model_validate(out)


@router.post("/auth/send-code", response_model=TelegramPersonalSendCodeResponse)
async def auth_send_code(
    body: TelegramPersonalSendCodeBody,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    phone = body.phone
    res = await tgp.send_code_request(db, current_user.id, phone)
    if not res.get("ok"):
        _raise_tgp(res)
    await db.commit()
    pm = res.get("phoneMasked")
    return TelegramPersonalSendCodeResponse(
        phoneMasked=str(pm) if pm is not None else None,
    )


@router.post("/auth/sign-in", response_model=TelegramPersonalSignInResponse)
async def auth_sign_in(
    body: TelegramPersonalSignInBody,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    res = await tgp.sign_in_with_code(db, current_user.id, body.phone, body.code)
    if not res.get("ok"):
        _raise_tgp(res)
    await db.commit()
    if res.get("needPassword"):
        return TelegramPersonalSignInResponse(needPassword=True)
    return TelegramPersonalSignInResponse(needPassword=False)


@router.post("/auth/password", response_model=OkResponse)
async def auth_password(
    body: TelegramPersonalPasswordBody,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    res = await tgp.sign_in_with_password(db, current_user.id, body.password)
    if not res.get("ok"):
        _raise_tgp(res)
    await db.commit()
    return OkResponse()


@router.delete("/session", response_model=OkResponse)
async def delete_session(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await tgp.disconnect_session(db, current_user.id)
    await db.commit()
    return OkResponse()


@router.post(
    "/deals/{deal_id}/sync-messages",
    status_code=202,
    response_model=TelegramPersonalSyncQueuedResponse,
)
async def sync_messages(
    deal_id: str,
    body: TelegramPersonalSyncMessagesBody | None = Body(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_crm_messaging_access),
):
    """
    Синхронизация истории в сделку — только постановка в ``queue.integrations``; Telethon во воркере, HTTP не ждёт.
    """
    deal = await db.get(Deal, deal_id)
    if not deal or deal.is_archived:
        raise HTTPException(status_code=404, detail="deal_not_found")
    linked = await db.get(Client, deal.client_id) if deal.client_id else None
    if not _peer_ok(deal, linked):
        raise HTTPException(status_code=400, detail="no_telegram_peer")
    if not tgp.mtproto_configured():
        raise HTTPException(status_code=503, detail="telegram_api_not_configured")
    if not await tgp.mtproto_session_ready(db, current_user.id):
        raise HTTPException(status_code=400, detail="telegram_personal_session_required")

    limit = 50 if body is None or body.limit is None else body.limit

    redis = await get_redis_client()
    if not redis:
        raise HTTPException(status_code=503, detail="redis_unavailable")
    await ensure_integrations_stream(redis)
    stream_id = await xadd_telegram_personal_sync_job(
        redis, user_id=current_user.id, deal_id=deal_id, limit=limit
    )
    return TelegramPersonalSyncQueuedResponse(dealId=deal_id, streamId=str(stream_id))


@router.post("/deals/{deal_id}/send", response_model=DealCamelRead)
async def send_personal(
    deal_id: str,
    body: TelegramPersonalDealSendBody,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_crm_messaging_access),
):
    text = body.text
    deal = await db.get(Deal, deal_id)
    if not deal or deal.is_archived:
        raise HTTPException(status_code=404, detail="deal_not_found")
    linked = await db.get(Client, deal.client_id) if deal.client_id else None
    if not _peer_ok(deal, linked):
        raise HTTPException(status_code=400, detail="no_telegram_peer")
    res = await tgp.send_deal_message(db, current_user.id, deal, text, linked_client=linked)
    if not res.get("ok"):
        _raise_tgp(res)
    await db.commit()
    await db.refresh(deal)
    return deal_row_to_camel_read(deal)


@router.get("/deals/{deal_id}/media/{message_id}")
async def download_deal_media(
    deal_id: str,
    message_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_crm_messaging_access),
):
    deal = await db.get(Deal, deal_id)
    if not deal or deal.is_archived:
        raise HTTPException(status_code=404, detail="deal_not_found")
    linked = await db.get(Client, deal.client_id) if deal.client_id else None
    if not _peer_ok(deal, linked):
        raise HTTPException(status_code=400, detail="no_telegram_peer")
    res = await tgp.download_deal_message_media(
        db, current_user.id, deal, message_id, linked_client=linked
    )
    if not res.get("ok"):
        _raise_tgp(res)
    return StreamingResponse(
        io.BytesIO(res["data"]),
        media_type=res["content_type"],
        headers={
            "Content-Disposition": f'attachment; filename="{res["filename"]}"',
        },
    )


def _raise_tgp(res: dict[str, object]):
    err = res.get("error") or "unknown"
    detail = res.get("detail")
    if err == "telegram_api_not_configured":
        raise HTTPException(status_code=503, detail="telegram_api_not_configured")
    if err == "session_not_active":
        raise HTTPException(status_code=400, detail="telegram_personal_session_required")
    if err == "invalid_mtproto_state":
        raise HTTPException(status_code=409, detail=err)
    if err == "mtproto_session_corrupt":
        raise HTTPException(status_code=400, detail=err)
    if err == "already_connected":
        raise HTTPException(status_code=400, detail=err)
    if err == "invalid_code":
        raise HTTPException(status_code=400, detail=err)
    if err == "no_pending_auth":
        raise HTTPException(status_code=400, detail=err)
    if err == "no_pending_password":
        raise HTTPException(status_code=400, detail=err)
    if err == "phone_mismatch":
        raise HTTPException(status_code=400, detail=err)
    if err == "invalid_phone":
        raise HTTPException(status_code=400, detail=err)
    if err == "message_not_found":
        raise HTTPException(status_code=404, detail=err)
    if err == "no_media":
        raise HTTPException(status_code=400, detail=err)
    if err == "download_empty":
        raise HTTPException(status_code=502, detail=err)
    if err == "download_failed":
        raise HTTPException(status_code=502, detail=f"{err}:{detail or ''}")
    raise HTTPException(status_code=502, detail=f"{err}:{detail or ''}")
