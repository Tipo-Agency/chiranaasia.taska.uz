"""Telegram личный аккаунт (MTProto, Telethon): отправка и подтягивание истории в сделку."""
from __future__ import annotations

import io
import logging
import mimetypes
import re
import uuid
from datetime import UTC, datetime
from typing import Any

from cryptography.fernet import InvalidToken
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from telethon import TelegramClient
from telethon.errors import PhoneCodeInvalidError, SessionPasswordNeededError
from telethon.sessions import StringSession

from app.core.config import get_settings
from app.core.mappers import _legacy_telegram_username
from app.models.client import Client, Deal
from app.models.mtproto_session import (
    MtprotoSession,
    MtprotoSessionStatus,
    mtproto_can_request_code,
    mtproto_can_sign_in_code,
    mtproto_can_sign_in_password,
    mtproto_is_active,
)
from app.services.fernet_secrets import decrypt_secret, encrypt_secret
from app.services.media_storage import is_media_storage_configured, upload_deal_media_bytes

log = logging.getLogger("uvicorn.error")

_TG_STATIC_MEDIA_KINDS = frozenset({"location", "venue", "contact", "poll"})


def _now_iso() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def _telethon_session_string_from_storage(blob: str | None) -> str:
    """Расшифровка ``session_data`` → строка Telethon StringSession (в БД только ciphertext)."""
    if not blob or not str(blob).strip():
        return ""
    try:
        return decrypt_secret(str(blob).strip())
    except (InvalidToken, ValueError, TypeError) as exc:
        raise ValueError("mtproto_session_data_invalid") from exc


def mtproto_configured() -> bool:
    s = get_settings()
    return bool(s.TELEGRAM_API_ID and (s.TELEGRAM_API_HASH or "").strip())


async def mtproto_session_ready(db: AsyncSession, user_id: str) -> bool:
    """Есть активная MTProto-сессия в БД (без Telethon)."""
    row = await _get_row(db, user_id)
    return bool(row and mtproto_is_active(row.status, bool(row.session_data)))


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


async def _get_row(db: AsyncSession, user_id: str) -> MtprotoSession | None:
    r = await db.execute(select(MtprotoSession).where(MtprotoSession.user_id == user_id))
    return r.scalar_one_or_none()


async def _ensure_row(db: AsyncSession, user_id: str) -> MtprotoSession:
    row = await _get_row(db, user_id)
    if row:
        return row
    row = MtprotoSession(
        id=str(uuid.uuid4()),
        user_id=user_id,
        status=MtprotoSessionStatus.INACTIVE,
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
    if row.status == MtprotoSessionStatus.ACTIVE and not row.session_data:
        row.status = MtprotoSessionStatus.INACTIVE
        row.updated_at = _now_iso()
        await db.flush()
    if mtproto_is_active(row.status, bool(row.session_data)):
        return {"ok": False, "error": "already_connected"}
    if not mtproto_can_request_code(row.status):
        return {"ok": False, "error": "invalid_mtproto_state", "detail": row.status}

    client = _new_client(None)
    await client.connect()
    try:
        sent = await client.send_code_request(phone)
        sess = client.session.save()
        row.session_data = encrypt_secret(sess)
        row.pending_phone = phone
        row.pending_phone_code_hash = sent.phone_code_hash
        row.status = MtprotoSessionStatus.PENDING_CODE
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
    if (
        not row
        or not mtproto_can_sign_in_code(row.status)
        or not row.session_data
        or not row.pending_phone_code_hash
    ):
        return {"ok": False, "error": "no_pending_auth"}
    if _normalize_phone(row.pending_phone or "") != phone:
        return {"ok": False, "error": "phone_mismatch"}

    try:
        plain_sess = _telethon_session_string_from_storage(row.session_data)
    except ValueError:
        return {"ok": False, "error": "mtproto_session_corrupt"}
    client = _new_client(plain_sess)
    await client.connect()
    try:
        try:
            await client.sign_in(phone, code, phone_code_hash=row.pending_phone_code_hash)
        except SessionPasswordNeededError:
            sess = client.session.save()
            row.session_data = encrypt_secret(sess)
            row.status = MtprotoSessionStatus.PENDING_PASSWORD
            row.pending_phone_code_hash = None
            row.updated_at = _now_iso()
            await db.flush()
            return {"ok": True, "needPassword": True}
        except PhoneCodeInvalidError:
            return {"ok": False, "error": "invalid_code"}
        sess = client.session.save()
        row.session_data = encrypt_secret(sess)
        row.status = MtprotoSessionStatus.ACTIVE
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
    if not row or not mtproto_can_sign_in_password(row.status) or not row.session_data:
        return {"ok": False, "error": "no_pending_password"}

    try:
        plain_sess = _telethon_session_string_from_storage(row.session_data)
    except ValueError:
        return {"ok": False, "error": "mtproto_session_corrupt"}
    client = _new_client(plain_sess)
    await client.connect()
    try:
        await client.sign_in(password=password)
        sess = client.session.save()
        row.session_data = encrypt_secret(sess)
        row.status = MtprotoSessionStatus.ACTIVE
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
    row.session_data = None
    row.status = MtprotoSessionStatus.INACTIVE
    row.pending_phone = None
    row.pending_phone_code_hash = None
    row.phone_masked = None
    row.updated_at = _now_iso()
    await db.flush()


def _username_from_client(linked: Client | None) -> str:
    if not linked or not linked.telegram:
        return ""
    return (linked.telegram or "").strip().lstrip("@").split()[0]


async def _resolve_peer(tg: TelegramClient, deal: Deal, linked_client: Client | None = None):
    un = str(_legacy_telegram_username(deal.custom_fields) or "").strip().lstrip("@")
    if not un:
        un = _username_from_client(linked_client)
    if un:
        # Числовой peer (user/chat id) в поле username — иначе Telethon ищет @username из цифр
        if un.isdigit():
            try:
                return await tg.get_entity(int(un))
            except Exception:
                pass
        return await tg.get_entity(un)
    cid = str(deal.source_chat_id or "").strip()
    if not cid:
        raise ValueError("no_peer")
    try:
        return await tg.get_entity(int(cid))
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


def _telegram_media_attachments(msg) -> list[dict[str, Any]]:
    """Метаданные вложений Telethon для UI и скачивания по tgMessageId."""
    from telethon.tl.types import (
        DocumentAttributeAudio,
        DocumentAttributeFilename,
        DocumentAttributeSticker,
        DocumentAttributeVideo,
        MessageMediaContact,
        MessageMediaDocument,
        MessageMediaGeo,
        MessageMediaGeoLive,
        MessageMediaPhoto,
        MessageMediaPoll,
        MessageMediaVenue,
        MessageMediaWebPage,
    )

    out: list[dict[str, Any]] = []
    media = getattr(msg, "media", None)
    if not media:
        return out
    mid = getattr(msg, "id", None)

    if isinstance(media, MessageMediaPhoto):
        out.append({"kind": "image", "tgMessageId": mid})
        return out

    if isinstance(media, MessageMediaDocument):
        doc = media.document
        if not doc:
            return out
        mime = (getattr(doc, "mime_type", None) or "").strip() or "application/octet-stream"
        fname = None
        voice = False
        duration = None
        round_message = False
        sticker = False
        for attr in getattr(doc, "attributes", []) or []:
            if isinstance(attr, DocumentAttributeAudio):
                voice = bool(getattr(attr, "voice", False))
                duration = getattr(attr, "duration", None)
            elif isinstance(attr, DocumentAttributeFilename):
                fname = attr.file_name
            elif isinstance(attr, DocumentAttributeVideo):
                round_message = bool(getattr(attr, "round_message", False))
            elif isinstance(attr, DocumentAttributeSticker):
                sticker = True
        if sticker:
            kind = "sticker"
        elif voice:
            kind = "voice"
        elif round_message:
            kind = "video_note"
        elif mime.startswith("audio/"):
            kind = "audio"
        elif mime.startswith("video/"):
            kind = "video"
        elif mime.startswith("image/"):
            kind = "image"
        else:
            kind = "file"
        item: dict[str, Any] = {"kind": kind, "tgMessageId": mid, "mime": mime}
        if duration is not None:
            try:
                item["durationSec"] = int(duration)
            except (TypeError, ValueError):
                pass
        if fname:
            item["fileName"] = str(fname)[:200]
        if getattr(doc, "size", None) is not None:
            try:
                item["size"] = int(doc.size)
            except (TypeError, ValueError):
                pass
        out.append(item)
        return out

    if isinstance(media, MessageMediaGeo | MessageMediaGeoLive):
        out.append({"kind": "location", "tgMessageId": mid})
        return out

    if isinstance(media, MessageMediaVenue):
        out.append({"kind": "venue", "tgMessageId": mid})
        return out

    if isinstance(media, MessageMediaContact):
        fn = getattr(media, "first_name", "") or ""
        ln = getattr(media, "last_name", "") or ""
        phone = getattr(media, "phone_number", "") or ""
        title = " ".join(x for x in (fn, ln) if x).strip() or phone or "Контакт"
        out.append({"kind": "contact", "tgMessageId": mid, "title": title})
        return out

    if isinstance(media, MessageMediaPoll):
        out.append({"kind": "poll", "tgMessageId": mid})
        return out

    if isinstance(media, MessageMediaWebPage):
        wp = media.webpage
        if wp and getattr(wp, "photo", None):
            out.append({"kind": "image", "tgMessageId": mid})
        elif wp and getattr(wp, "document", None):
            out.append({"kind": "file", "tgMessageId": mid, "mime": "application/octet-stream"})
        return out

    return out


def _fallback_text_for_media(atts: list[dict[str, Any]]) -> str:
    labels: list[str] = []
    kind_label = {
        "image": "Фото",
        "voice": "Голосовое",
        "audio": "Аудио",
        "video": "Видео",
        "video_note": "Видеосообщение",
        "file": "Файл",
        "sticker": "Стикер",
        "location": "Геолокация",
        "venue": "Место",
        "contact": "Контакт",
        "poll": "Опрос",
    }
    for a in atts:
        k = str(a.get("kind") or "file").lower()
        labels.append(kind_label.get(k, k))
    return "[" + " · ".join(labels) + "]"


def _guess_ext(mime: str) -> str:
    ext = mimetypes.guess_extension(mime.split(";")[0].strip()) or ""
    if ext in (".jpe",):
        return ".jpg"
    return ext or ".bin"


def _telegram_media_response_meta(msg) -> tuple[str, str]:
    """Content-Type и имя файла для ответа HTTP."""
    from telethon.tl.types import DocumentAttributeFilename, MessageMediaDocument, MessageMediaPhoto

    mid = getattr(msg, "id", 0)
    media = getattr(msg, "media", None)
    if isinstance(media, MessageMediaPhoto):
        return "image/jpeg", f"telegram-{mid}.jpg"
    if isinstance(media, MessageMediaDocument) and media.document:
        doc = media.document
        mime = (getattr(doc, "mime_type", None) or "").strip() or "application/octet-stream"
        fname = None
        for attr in getattr(doc, "attributes", []) or []:
            if isinstance(attr, DocumentAttributeFilename):
                fname = attr.file_name
                break
        if fname:
            return mime, str(fname)[:200]
        return mime, f"telegram-{mid}{_guess_ext(mime)}"
    return "application/octet-stream", f"telegram-{mid}.bin"


def _msg_to_comment(msg, session_user_id: str) -> dict[str, Any] | None:
    mid = getattr(msg, "id", None)
    if mid is None:
        return None
    if getattr(msg, "action", None):
        return None
    atts = _telegram_media_attachments(msg)
    raw = (getattr(msg, "message", None) or "").strip()
    if not raw and not atts:
        return None
    display = raw[:8000] if raw else _fallback_text_for_media(atts)[:8000]
    is_out = bool(getattr(msg, "out", False))
    comment: dict[str, Any] = {
        "id": f"tg-out-{mid}" if is_out else f"tg-in-{mid}",
        "text": display,
        "authorId": session_user_id if is_out else "tg_user",
        "createdAt": _fmt_msg_time(msg),
        "type": "telegram_out" if is_out else "telegram_in",
    }
    if atts:
        comment["attachments"] = atts
        comment["tgMessageId"] = mid
    return comment


async def _hydrate_telegram_sync_comment_media(client, msg, deal_id: str, cm: dict[str, Any]) -> None:
    """Бинарные вложения → S3 (ключ в БД); без S3 остаётся скачивание по tgMessageId."""
    atts = cm.get("attachments")
    if not atts or not isinstance(atts, list) or not is_media_storage_configured():
        return
    needs_blob = False
    for a in atts:
        if not isinstance(a, dict):
            continue
        k = str(a.get("kind") or "").lower()
        if k not in _TG_STATIC_MEDIA_KINDS:
            needs_blob = True
            break
    if not needs_blob:
        return
    try:
        bio = io.BytesIO()
        await client.download_media(msg, file=bio)
        bio.seek(0)
        data = bio.getvalue()
        if not data:
            return
        content_type, filename = _telegram_media_response_meta(msg)
        key = await upload_deal_media_bytes(
            deal_id=deal_id,
            source="tg",
            body=data,
            content_type=content_type,
            filename_hint=filename,
        )
        new_atts: list[dict[str, Any]] = []
        for a in atts:
            if not isinstance(a, dict):
                continue
            aa = dict(a)
            kind = str(aa.get("kind") or "").lower()
            if kind in _TG_STATIC_MEDIA_KINDS:
                new_atts.append(aa)
                continue
            aa.pop("tgMessageId", None)
            aa["storageKey"] = key
            if not aa.get("mime"):
                aa["mime"] = content_type
            new_atts.append(aa)
        cm["attachments"] = new_atts
        if not any(isinstance(x, dict) and x.get("tgMessageId") is not None for x in new_atts):
            cm.pop("tgMessageId", None)
    except Exception as exc:
        log.warning("telegram_personal: S3 hydrate deal_id=%s: %s", deal_id, exc)


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
    linked_client: Client | None = None,
) -> dict[str, Any]:
    if not mtproto_configured():
        return {"ok": False, "error": "telegram_api_not_configured"}
    row = await _get_row(db, user_id)
    if not row or not mtproto_is_active(row.status, bool(row.session_data)):
        return {"ok": False, "error": "session_not_active"}

    try:
        plain_sess = _telethon_session_string_from_storage(row.session_data)
    except ValueError:
        return {"ok": False, "error": "mtproto_session_corrupt"}

    lim = max(1, min(limit, 100))
    client = _new_client(plain_sess)
    await client.connect()
    try:
        peer = await _resolve_peer(client, deal, linked_client)
        msgs = await client.get_messages(peer, limit=lim)
        incoming: list[dict] = []
        for m in msgs:
            if not m:
                continue
            if getattr(m, "action", None):
                continue
            cm = _msg_to_comment(m, user_id)
            if cm:
                await _hydrate_telegram_sync_comment_media(client, m, deal.id, cm)
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
    linked_client: Client | None = None,
) -> dict[str, Any]:
    if not mtproto_configured():
        return {"ok": False, "error": "telegram_api_not_configured"}
    row = await _get_row(db, user_id)
    if not row or not mtproto_is_active(row.status, bool(row.session_data)):
        return {"ok": False, "error": "session_not_active"}

    try:
        plain_sess = _telethon_session_string_from_storage(row.session_data)
    except ValueError:
        return {"ok": False, "error": "mtproto_session_corrupt"}

    client = _new_client(plain_sess)
    await client.connect()
    try:
        peer = await _resolve_peer(client, deal, linked_client)
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


async def download_deal_message_media(
    db: AsyncSession,
    user_id: str,
    deal: Deal,
    message_id: int,
    linked_client: Client | None = None,
) -> dict[str, Any]:
    """Скачать медиа сообщения из диалога сделки (личная сессия MTProto)."""
    if not mtproto_configured():
        return {"ok": False, "error": "telegram_api_not_configured"}
    row = await _get_row(db, user_id)
    if not row or not mtproto_is_active(row.status, bool(row.session_data)):
        return {"ok": False, "error": "session_not_active"}

    try:
        plain_sess = _telethon_session_string_from_storage(row.session_data)
    except ValueError:
        return {"ok": False, "error": "mtproto_session_corrupt"}

    client = _new_client(plain_sess)
    await client.connect()
    try:
        peer = await _resolve_peer(client, deal, linked_client)
        msgs = await client.get_messages(peer, ids=message_id)
        if not msgs:
            return {"ok": False, "error": "message_not_found"}
        msg = msgs[0]
        if not getattr(msg, "media", None):
            return {"ok": False, "error": "no_media"}
        bio = io.BytesIO()
        await client.download_media(msg, file=bio)
        bio.seek(0)
        data = bio.getvalue()
        if not data:
            return {"ok": False, "error": "download_empty"}
        content_type, filename = _telegram_media_response_meta(msg)
        return {"ok": True, "data": data, "content_type": content_type, "filename": filename}
    except Exception as exc:
        log.warning("telegram_personal download: %s", exc)
        return {"ok": False, "error": "download_failed", "detail": str(exc)[:200]}
    finally:
        await client.disconnect()


def status_dict(row: MtprotoSession | None) -> dict[str, Any]:
    if not row:
        return {"connected": False, "status": MtprotoSessionStatus.INACTIVE}
    return {
        "connected": mtproto_is_active(row.status, bool(row.session_data)),
        "status": row.status,
        "phoneMasked": row.phone_masked,
    }
