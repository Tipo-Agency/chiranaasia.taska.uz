"""Личный Telegram (MTProto): привязка аккаунта, синхрон сообщений в сделку, отправка от своего имени."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models.client import Deal
from app.models.telegram_personal import TelegramPersonalSession
from app.models.user import User
from app.services import telegram_personal as tgp
from app.utils import row_to_deal

router = APIRouter(prefix="/integrations/telegram-personal", tags=["integrations-telegram-personal"])


def _peer_ok(deal: Deal) -> bool:
    return bool(str(deal.telegram_chat_id or "").strip() or str(deal.telegram_username or "").strip())


@router.get("/status")
async def personal_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    r = await db.execute(select(TelegramPersonalSession).where(TelegramPersonalSession.user_id == current_user.id))
    row = r.scalar_one_or_none()
    out = tgp.status_dict(row)
    out["apiConfigured"] = tgp.mtproto_configured()
    return out


@router.post("/auth/send-code")
async def auth_send_code(
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    phone = str(body.get("phone") or "").strip()
    if not phone:
        raise HTTPException(status_code=400, detail="phone_required")
    res = await tgp.send_code_request(db, current_user.id, phone)
    if not res.get("ok"):
        _raise_tgp(res)
    await db.commit()
    return {"ok": True, "phoneMasked": res.get("phoneMasked")}


@router.post("/auth/sign-in")
async def auth_sign_in(
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    phone = str(body.get("phone") or "").strip()
    code = str(body.get("code") or "").strip()
    if not phone or not code:
        raise HTTPException(status_code=400, detail="phone_and_code_required")
    res = await tgp.sign_in_with_code(db, current_user.id, phone, code)
    if not res.get("ok"):
        _raise_tgp(res)
    await db.commit()
    if res.get("needPassword"):
        return {"ok": True, "needPassword": True}
    return {"ok": True, "needPassword": False}


@router.post("/auth/password")
async def auth_password(
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    password = str(body.get("password") or "").strip()
    if not password:
        raise HTTPException(status_code=400, detail="password_required")
    res = await tgp.sign_in_with_password(db, current_user.id, password)
    if not res.get("ok"):
        _raise_tgp(res)
    await db.commit()
    return {"ok": True}


@router.delete("/session")
async def delete_session(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await tgp.disconnect_session(db, current_user.id)
    await db.commit()
    return {"ok": True}


@router.post("/deals/{deal_id}/sync-messages")
async def sync_messages(
    deal_id: str,
    body: dict | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    deal = await db.get(Deal, deal_id)
    if not deal or deal.is_archived:
        raise HTTPException(status_code=404, detail="deal_not_found")
    if not _peer_ok(deal):
        raise HTTPException(status_code=400, detail="no_telegram_peer")
    limit = 50
    if isinstance(body, dict) and body.get("limit") is not None:
        try:
            limit = int(body["limit"])
        except Exception:
            pass
    res = await tgp.sync_deal_messages(db, current_user.id, deal, limit=limit)
    if not res.get("ok"):
        _raise_tgp(res)
    await db.commit()
    await db.refresh(deal)
    return row_to_deal(deal)


@router.post("/deals/{deal_id}/send")
async def send_personal(
    deal_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    text = str(body.get("text") or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="text_required")
    deal = await db.get(Deal, deal_id)
    if not deal or deal.is_archived:
        raise HTTPException(status_code=404, detail="deal_not_found")
    if not _peer_ok(deal):
        raise HTTPException(status_code=400, detail="no_telegram_peer")
    res = await tgp.send_deal_message(db, current_user.id, deal, text)
    if not res.get("ok"):
        _raise_tgp(res)
    await db.commit()
    await db.refresh(deal)
    return row_to_deal(deal)


def _raise_tgp(res: dict):
    err = res.get("error") or "unknown"
    detail = res.get("detail")
    if err == "telegram_api_not_configured":
        raise HTTPException(status_code=503, detail="telegram_api_not_configured")
    if err == "session_not_active":
        raise HTTPException(status_code=400, detail="telegram_personal_session_required")
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
    raise HTTPException(status_code=502, detail=f"{err}:{detail or ''}")
