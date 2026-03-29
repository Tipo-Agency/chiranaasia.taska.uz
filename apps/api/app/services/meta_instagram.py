"""Instagram / Meta Messaging: Graph API + webhook business logic."""

from __future__ import annotations

import json
import logging
import uuid
from datetime import UTC, datetime
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.models.client import Deal
from app.models.funnel import SalesFunnel
from app.models.notification import NotificationPreferences as NPrefModel
from app.models.user import User
from app.services.domain_events import emit_domain_event

log = logging.getLogger("uvicorn.error")

# Кэш: Instagram Business Account id → Facebook Page id (из Graph)
_ig_entry_to_page: dict[str, str] = {}


def _page_token_pairs(settings: Settings) -> list[tuple[str, str]]:
    return [
        ("955732467617410", settings.META_TASKA or ""),
        ("773704889162097", settings.META_TIPA or ""),
        ("100028893170247", settings.META_UCHETGRAM or ""),
    ]


def page_access_token(page_id: str, settings: Settings) -> str | None:
    for pid, tok in _page_token_pairs(settings):
        if pid == page_id and tok:
            return tok
    return None


async def refresh_ig_entry_map(settings: Settings) -> dict[str, str]:
    """Заполняет маппинг id из webhook entry → Page id (для подписки на instagram)."""
    global _ig_entry_to_page
    out: dict[str, str] = {}
    async with httpx.AsyncClient(timeout=20.0) as client:
        for page_id, token in _page_token_pairs(settings):
            if not token:
                continue
            try:
                r = await client.get(
                    f"https://graph.facebook.com/v21.0/{page_id}",
                    params={"fields": "instagram_business_account", "access_token": token},
                )
            except httpx.HTTPError as e:
                log.warning("IG graph request failed page=%s: %s", page_id, e)
                continue
            if r.status_code != 200:
                log.warning("IG graph page %s: HTTP %s %s", page_id, r.status_code, r.text[:300])
                continue
            data = r.json()
            ib = (data.get("instagram_business_account") or {}) if isinstance(data, dict) else {}
            ig_id = ib.get("id")
            if ig_id:
                out[str(ig_id)] = str(page_id)
    _ig_entry_to_page = out
    return out


async def resolve_page_id_for_entry(entry_id: str, settings: Settings) -> str | None:
    if not entry_id:
        return None
    known = {p for p, t in _page_token_pairs(settings) if t}
    if entry_id in known:
        return entry_id
    await refresh_ig_entry_map(settings)
    return _ig_entry_to_page.get(entry_id)


def thread_key(page_id: str, customer_psid: str) -> str:
    return f"ig:{page_id}:{customer_psid}"


def parse_thread_key(key: str) -> tuple[str, str] | None:
    if not key or not key.startswith("ig:"):
        return None
    parts = key.split(":", 2)
    if len(parts) != 3:
        return None
    return parts[1], parts[2]


def _comment_has_mid(comments: list[Any] | None, mid: str | None) -> bool:
    if not mid or not comments:
        return False
    for c in comments:
        if isinstance(c, dict) and c.get("metaMid") == mid:
            return True
    return False


async def _default_funnel_stage(db: AsyncSession) -> tuple[str | None, str]:
    result = await db.execute(select(NPrefModel).where(NPrefModel.id == "default").limit(1))
    row = result.scalar_one_or_none()
    fid = row.default_funnel_id if row else None
    if not fid:
        return None, "new"
    funnel = await db.get(SalesFunnel, fid)
    if not funnel or not funnel.stages:
        return fid, "new"
    first = funnel.stages[0]
    sid = first.get("id") if isinstance(first, dict) else None
    return fid, (sid or "new")


async def _first_assignee_id(db: AsyncSession) -> str:
    result = await db.execute(select(User.id).where(User.is_archived.is_(False)).limit(1))
    uid = result.scalar_one_or_none()
    return uid or ""


async def send_instagram_text(page_id: str, recipient_psid: str, text: str, settings: Settings) -> dict[str, Any]:
    token = page_access_token(page_id, settings)
    if not token:
        raise ValueError("Нет Page Access Token для этой страницы (META_TASKA / META_TIPA / META_UCHETGRAM)")
    url = f"https://graph.facebook.com/v21.0/{page_id}/messages"
    body = {
        "recipient": {"id": recipient_psid},
        "messaging_type": "RESPONSE",
        "message": {"text": text[:2000]},
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post(url, params={"access_token": token}, json=body)
    try:
        data = r.json()
    except json.JSONDecodeError:
        data = {"raw": r.text}
    if r.status_code >= 400:
        raise ValueError(data.get("error", {}).get("message", r.text) if isinstance(data, dict) else r.text)
    return data if isinstance(data, dict) else {"ok": True}


async def process_instagram_webhook(db: AsyncSession, body: dict[str, Any]) -> int:
    """Разбор вебхука Meta (object instagram или page). Возвращает число обработанных сообщений."""
    obj = body.get("object")
    if obj not in ("instagram", "page"):
        return 0
    settings = get_settings()
    n = 0
    for entry in body.get("entry") or []:
        if not isinstance(entry, dict):
            continue
        entry_id = str(entry.get("id") or "")
        page_id = await resolve_page_id_for_entry(entry_id, settings)
        if not page_id:
            log.warning("meta webhook: не удалось сопоставить entry id=%s с Page", entry_id)
            continue
        if not page_access_token(page_id, settings):
            log.warning("meta webhook: нет токена для page_id=%s", page_id)
            continue

        for m in entry.get("messaging") or []:
            if not isinstance(m, dict):
                continue
            if "message" not in m:
                continue
            msg = m.get("message") or {}
            if not isinstance(msg, dict):
                continue
            if msg.get("is_echo"):
                continue
            mid = msg.get("mid")
            sender = m.get("sender") or {}
            if not isinstance(sender, dict):
                continue
            customer_psid = str(sender.get("id") or "")
            if not customer_psid:
                continue

            text = (msg.get("text") or "").strip()
            if not text:
                atts = msg.get("attachments") or []
                if atts:
                    text = "[вложение]"
                else:
                    continue

            ts = m.get("timestamp")
            try:
                ts_ms = int(ts) if ts is not None else int(datetime.now(UTC).timestamp() * 1000)
            except (TypeError, ValueError):
                ts_ms = int(datetime.now(UTC).timestamp() * 1000)
            created_at = datetime.fromtimestamp(ts_ms / 1000.0, tz=UTC).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"

            tk = thread_key(page_id, customer_psid)
            result = await db.execute(
                select(Deal).where(
                    Deal.telegram_chat_id == tk,
                    Deal.source == "instagram",
                    Deal.is_archived.is_(False),
                ).limit(1)
            )
            deal = result.scalar_one_or_none()

            if deal:
                comments = list(deal.comments or [])
                if _comment_has_mid(comments, mid):
                    continue
                comments.append(
                    {
                        "id": f"ig-{mid or uuid.uuid4().hex[:12]}",
                        "text": text,
                        "authorId": f"ig_user:{customer_psid}",
                        "createdAt": created_at,
                        "type": "instagram_in",
                        "metaMid": mid,
                    }
                )
                deal.comments = comments
                deal.updated_at = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
                await db.flush()
                n += 1
                continue

            # Новый диалог → новая сделка
            funnel_id, stage_id = await _default_funnel_stage(db)
            assignee_id = await _first_assignee_id(db)
            did = str(uuid.uuid4())
            title = f"Instagram · {customer_psid[-8:]}"
            now = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
            deal = Deal(
                id=did,
                title=title,
                contact_name=f"Instagram {customer_psid}",
                amount="0",
                currency="UZS",
                stage=stage_id,
                funnel_id=funnel_id,
                source="instagram",
                telegram_chat_id=tk,
                telegram_username=f"ig:{customer_psid}",
                assignee_id=assignee_id,
                created_at=now,
                notes=f"Автоматически из Instagram (page {page_id})",
                comments=[
                    {
                        "id": f"ig-{mid or uuid.uuid4().hex[:12]}",
                        "text": text,
                        "authorId": f"ig_user:{customer_psid}",
                        "createdAt": created_at,
                        "type": "instagram_in",
                        "metaMid": mid,
                    }
                ],
                is_archived=False,
            )
            db.add(deal)
            await db.flush()
            await emit_domain_event(
                db,
                event_type="deal.created",
                org_id="default",
                entity_type="deal",
                entity_id=did,
                source="meta-webhook",
                payload={"title": title, "source": "instagram"},
            )
            n += 1

    return n
