"""Telegram личный аккаунт (MTProto, Telethon): отправка и подтягивание истории в сделку."""
from __future__ import annotations

import base64
import hashlib
import logging
import re
import uuid
from datetime import UTC, datetime
from typing import Any

from cryptography.fernet import Fernet
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from telethon import TelegramClient
from telethon.errors import PhoneCodeInvalidError, SessionPasswordNeededError
from telethon.sessions import StringSession

from app.config import get_settings
from app.models.client import Deal
from app.models.telegram_personal import TelegramPersonalSession

log = logging.getLogger("uvicorn.error")


def _now_iso() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def _fernet() -> Fernet:
    settings = get_settings()
    key = base64.urlsafe_b64encode(hashlib.sha256(settings.SECRET_KEY.encode()).digest())
    return Fernet(key)


def _encrypt(plain: str) -> str:
    return _fernet().encrypt(plain.encode()).decode()


def _decrypt(token: str) -> str:
    return _fernet().decrypt(token.encode()).decode()


def mtproto_configured() -> bool:
    s = get_settings()
    return bool(s.TELEGRAM_API_ID and (s.TELEGRAM_API_HASH or "").strip())


def _normalize_phone(phone: str) -> str:
    p = (phone or "").strip().replace(" ", "")
    if not p.startswith("+"):
        p = "+" + re.sub(r"^\+*", "", p)
    return p


def _mask_phone(phone: str) -> str:
    p = _normalize_phone(phone)
    if len(p) < 5:
        return "****"
    return f"…{p[-4:]}"


async def _get_row(db: AsyncSession, user_id: str) -> TelegramPersonalSession | None:
    r = await db.execute(select(TelegramPersonalSession).where(TelegramPersonalSession.user_id == user_id))
    return r.scalar_one_or_none()


async def _ensure_row(db: AsyncSession, user_id: str) -> TelegramPersonalSession:
    row = await _get_row(db, user_id)
    if row:
        return row
    row = TelegramPersonalSession(
        id=str(uuid.uuid4()),
        user_id=user_id,
        status="inactive",
        created_at=_now_iso(),
        updated_at=_now_iso(),
    )
    db.add(row)
    await db.flush()
    return row


def _new_client(session: str | None) -> TelegramClient:
    s = get_settings()
    return TelegramClient(StringSession(session or ""), s.TELEGRAM_API_ID, s.TELEGRAM_API_HASH)


async def send_code_request(db: AsyncSession, user_id: str, phone: str) -> dict[str, Any]:
    if not mtproto_configured():
        return {"ok": False, "error": "telegram_api_not_configured"}
    phone = _normalize_phone(phone)
    if len(phone) < 8:
        return {"ok": False, "error": "invalid_phone"}
    row = await _ensure_row(db, user_id)
    if row.status == "active" and row.encrypted_session:
        return {"ok": False, "error": "already_connected"}

    client = _new_client(None)
    await client.connect()
    try:
        sent = await client.send_code_request(phone)
        sess = client.session.save()
        row.encrypted_session = _encrypt(sess)
        row.pending_phone = phone
        row.pending_phone_code_hash = sent.phone_code_hash
        row.status = "pending_code"
        row.phone_masked = _mask_phone(phone)
        row.updated_at = _now_iso()
        await db.flush()
        return {"ok": True, "phoneMasked": row.phone_masked}
    except Exception as exc:
        log.warning("telegram_personal send_code: %s", exc)
        return {"ok": False, "error": "send_code_failed", "detail": str(exc)[:200]}
    finally:
        await client.disconnect()


async def sign_in_with_code(db: AsyncSession, user_id: str, phone: str, code: str) -> dict[str, Any]:
    if not mtproto_configured():
        return {"ok": False, "error": "telegram_api_not_configured"}
    phone = _normalize_phone(phone)
    code = (code or "").strip()
    if not code:
        return {"ok": False, "error": "code_required"}
    row = await _get_row(db, user_id)
    if not row or row.status != "pending_code" or not row.encrypted_session or not row.pending_phone_code_hash:
        return {"ok": False, "error": "no_pending_auth"}
    if _normalize_phone(row.pending_phone or "") != phone:
        return {"ok": False, "error": "phone_mismatch"}

    client = _new_client(_decrypt(row.encrypted_session))
    await client.connect()
    try:
        try:
            await client.sign_in(phone, code, phone_code_hash=row.pending_phone_code_hash)
        except SessionPasswordNeededError:
            sess = client.session.save()
            row.encrypted_session = _encrypt(sess)
            row.status = "pending_password"
            row.pending_phone_code_hash = None
            row.updated_at = _now_iso()
            await db.flush()
            return {"ok": True, "needPassword": True}
        except PhoneCodeInvalidError:
            return {"ok": False, "error": "invalid_code"}
        sess = client.session.save()
        row.encrypted_session = _encrypt(sess)
        row.status = "active"
        row.pending_phone = None
        row.pending_phone_code_hash = None
        row.updated_at = _now_iso()
        await db.flush()
        return {"ok": True, "needPassword": False}
    except Exception as exc:
        log.warning("telegram_personal sign_in: %s", exc)
        return {"ok": False, "error": "sign_in_failed", "detail": str(exc)[:200]}
    finally:
        await client.disconnect()


async def sign_in_with_password(db: AsyncSession, user_id: str, password: str) -> dict[str, Any]:
    if not mtproto_configured():
        return {"ok": False, "error": "telegram_api_not_configured"}
    password = (password or "").strip()
    if not password:
        return {"ok": False, "error": "password_required"}
    row = await _get_row(db, user_id)
    if not row or row.status != "pending_password" or not row.encrypted_session:
        return {"ok": False, "error": "no_pending_password"}

    client = _new_client(_decrypt(row.encrypted_session))
    await client.connect()
    try:
        await client.sign_in(password=password)
        sess = client.session.save()
        row.encrypted_session = _encrypt(sess)
        row.status = "active"
        row.pending_phone = None
        row.updated_at = _now_iso()
        await db.flush()
        return {"ok": True}
    except Exception as exc:
        log.warning("telegram_personal password: %s", exc)
        return {"ok": False, "error": "password_failed", "detail": str(exc)[:200]}
    finally:
        await client.disconnect()


async def disconnect_session(db: AsyncSession, user_id: str) -> None:
    row = await _get_row(db, user_id)
    if not row:
        return
    row.encrypted_session = None
    row.status = "inactive"
    row.pending_phone = None
    row.pending_phone_code_hash = None
    row.phone_masked = None
    row.updated_at = _now_iso()
    await db.flush()


async def _resolve_peer(client: TelegramClient, deal: Deal):
    un = (deal.telegram_username or "").strip().lstrip("@")
    if un:
        return await client.get_entity(un)
    cid = str(deal.telegram_chat_id or "").strip()
    if not cid:
        raise ValueError("no_peer")
    try:
        return await client.get_entity(int(cid))
    except Exception as exc:
        raise ValueError("invalid_peer") from exc


def _fmt_msg_time(msg) -> str:
    d = getattr(msg, "date", None)
    if d is None:
        return _now_iso()
    if hasattr(d, "isoformat"):
        s = d.isoformat()
        return s if s.endswith("Z") or "+" in s else s + "Z"
    return _now_iso()


def _msg_to_comment(msg, session_user_id: str) -> dict[str, Any] | None:
    mid = getattr(msg, "id", None)
    if mid is None:
        return None
    raw = (getattr(msg, "message", None) or "").strip()
    if not raw and getattr(msg, "media", None):
        raw = "[вложение]"
    if not raw:
        return None
    if getattr(msg, "out", False):
        return {
            "id": f"tg-out-{mid}",
            "text": raw[:8000],
            "authorId": session_user_id,
            "createdAt": _fmt_msg_time(msg),
            "type": "telegram_out",
        }
    return {
        "id": f"tg-in-{mid}",
        "text": raw[:8000],
        "authorId": "tg_user",
        "createdAt": _fmt_msg_time(msg),
        "type": "telegram_in",
    }


def _merge_comments(existing: list, incoming: list[dict]) -> list:
    ids = {c.get("id") for c in existing if isinstance(c, dict) and c.get("id")}
    out = list(existing)
    for c in incoming:
        cid = c.get("id")
        if cid and cid not in ids:
            ids.add(cid)
            out.append(c)
    return sorted(out, key=lambda x: (x.get("createdAt") or ""))


async def sync_deal_messages(
    db: AsyncSession,
    user_id: str,
    deal: Deal,
    limit: int = 50,
) -> dict[str, Any]:
    if not mtproto_configured():
        return {"ok": False, "error": "telegram_api_not_configured"}
    row = await _get_row(db, user_id)
    if not row or row.status != "active" or not row.encrypted_session:
        return {"ok": False, "error": "session_not_active"}

    lim = max(1, min(limit, 100))
    client = _new_client(_decrypt(row.encrypted_session))
    await client.connect()
    try:
        peer = await _resolve_peer(client, deal)
        msgs = await client.get_messages(peer, limit=lim)
        incoming: list[dict] = []
        for m in msgs:
            if not m:
                continue
            if getattr(m, "action", None):
                continue
            cm = _msg_to_comment(m, user_id)
            if cm:
                incoming.append(cm)
        before = len(deal.comments or [])
        merged = _merge_comments(list(deal.comments or []), incoming)
        deal.comments = merged
        deal.updated_at = _now_iso()
        await db.flush()
        added = len(merged) - before
        return {"ok": True, "imported": added}
    except Exception as exc:
        log.warning("telegram_personal sync: %s", exc)
        return {"ok": False, "error": "sync_failed", "detail": str(exc)[:200]}
    finally:
        await client.disconnect()


async def send_deal_message(
    db: AsyncSession,
    user_id: str,
    deal: Deal,
    text: str,
) -> dict[str, Any]:
    if not mtproto_configured():
        return {"ok": False, "error": "telegram_api_not_configured"}
    row = await _get_row(db, user_id)
    if not row or row.status != "active" or not row.encrypted_session:
        return {"ok": False, "error": "session_not_active"}

    client = _new_client(_decrypt(row.encrypted_session))
    await client.connect()
    try:
        peer = await _resolve_peer(client, deal)
        sent = await client.send_message(peer, text[:4000])
        mid = getattr(sent, "id", None)
        cid = f"tg-out-{mid}" if mid else f"tg-out-{int(datetime.now(UTC).timestamp() * 1000)}"
        comments = list(deal.comments or [])
        comments.append(
            {
                "id": cid,
                "text": text[:4000],
                "authorId": user_id,
                "createdAt": _now_iso(),
                "type": "telegram_out",
            }
        )
        deal.comments = comments
        deal.updated_at = _now_iso()
        await db.flush()
        return {"ok": True}
    except Exception as exc:
        log.warning("telegram_personal send: %s", exc)
        return {"ok": False, "error": "send_failed", "detail": str(exc)[:200]}
    finally:
        await client.disconnect()


def status_dict(row: TelegramPersonalSession | None) -> dict[str, Any]:
    if not row:
        return {"connected": False, "status": "inactive"}
    return {
        "connected": row.status == "active" and bool(row.encrypted_session),
        "status": row.status,
        "phoneMasked": row.phone_masked,
    }
