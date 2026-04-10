"""Instagram / Meta Messaging: Graph API + webhook business logic."""

from __future__ import annotations

import json
import logging
import time
import uuid
from datetime import UTC, datetime
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.models.client import Client as ClientRow
from app.models.client import Deal
from app.models.funnel import SalesFunnel
from app.models.notification import NotificationPreferences as NPrefModel
from app.models.user import User
from app.services.domain_events import emit_domain_event

log = logging.getLogger("uvicorn.error")

# Кэш: Instagram Business Account id → Facebook Page id (из Graph)
_ig_entry_to_page: dict[str, str] = {}
_ig_map_fetched_at: float = 0.0
IG_MAP_TTL_SEC = 300.0


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
    global _ig_entry_to_page, _ig_map_fetched_at
    now = time.time()
    if _ig_entry_to_page and (now - _ig_map_fetched_at) < IG_MAP_TTL_SEC:
        return _ig_entry_to_page
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
    _ig_map_fetched_at = time.time()
    return out


async def resolve_page_id_for_entry(entry_id: str, settings: Settings) -> str | None:
    if not entry_id:
        return None
    known = {p for p, t in _page_token_pairs(settings) if t}
    if entry_id in known:
        return entry_id
    await refresh_ig_entry_map(settings)
    resolved = _ig_entry_to_page.get(entry_id)
    if not resolved:
        log.warning(
            "meta IG: entry_id=%s не найден в маппинге. Известные Page id: %s. "
            "Ключи IG→Page из Graph: %s. Проверьте токены META_TASKA/META_TIPA/META_UCHETGRAM.",
            entry_id,
            sorted(known),
            list(_ig_entry_to_page.keys()),
        )
    return resolved


def thread_key(page_id: str, customer_psid: str) -> str:
    return f"ig:{page_id}:{customer_psid}"


def parse_thread_key(key: str) -> tuple[str, str] | None:
    if not key or not key.startswith("ig:"):
        return None
    parts = key.split(":", 2)
    if len(parts) != 3:
        return None
    return parts[1], parts[2]


def _attachments_from_meta_message(msg: dict[str, Any]) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    for att in msg.get("attachments") or []:
        if not isinstance(att, dict):
            continue
        typ = str(att.get("type") or "file").strip().lower()
        payload = att.get("payload")
        if not isinstance(payload, dict):
            payload = {}
        url = str(payload.get("url") or "").strip()
        if not url:
            continue
        title = str(payload.get("title") or "").strip()
        item: dict[str, str] = {"type": typ, "url": url}
        if title:
            item["title"] = title
        out.append(item)
    return out


def _message_text_and_attachments(msg: dict[str, Any]) -> tuple[str, list[dict[str, str]]]:
    text = (msg.get("text") or "").strip()
    attachments = _attachments_from_meta_message(msg)
    if text:
        return text, attachments
    if attachments:
        labels = [f"[{a.get('type') or 'file'}]" for a in attachments]
        return (" ".join(labels) if labels else "[вложение]"), attachments
    return "", []


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


async def _ensure_instagram_client(
    db: AsyncSession,
    *,
    customer_psid: str,
    page_id: str,
    funnel_id: str | None,
) -> str:
    """Один клиент на PSID (ig:psid), чтобы не плодить дубли при повторных диалогах."""
    marker = f"ig:{customer_psid}"
    result = await db.execute(
        select(ClientRow).where(ClientRow.instagram == marker, ClientRow.is_archived.is_(False)).limit(1)
    )
    row = result.scalar_one_or_none()
    if row:
        return row.id
    cid = str(uuid.uuid4())
    short = customer_psid[-8:] if len(customer_psid) >= 8 else customer_psid
    cl = ClientRow(
        id=cid,
        name=f"Instagram · {short}",
        instagram=marker,
        notes=f"Instagram Direct, PSID {customer_psid}, страница {page_id}",
        funnel_id=funnel_id,
    )
    db.add(cl)
    await db.flush()
    return cid


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


def _normalize_messaging_events(entry: dict[str, Any]) -> list[dict[str, Any]]:
    """Messenger-формат `messaging` и запасной вариант через `changes` (поле messages)."""
    raw = entry.get("messaging") or []
    if isinstance(raw, list) and raw:
        return [x for x in raw if isinstance(x, dict)]
    out: list[dict[str, Any]] = []
    for ch in entry.get("changes") or []:
        if not isinstance(ch, dict):
            continue
        field = (ch.get("field") or "").lower()
        if field not in ("messages", "messaging", "message"):
            continue
        val = ch.get("value")
        if isinstance(val, dict):
            if "sender" in val and "message" in val:
                out.append(val)
            elif "from" in val and "message" in val:
                out.append(
                    {
                        "sender": val.get("from"),
                        "recipient": val.get("to"),
                        "timestamp": val.get("timestamp"),
                        "message": val.get("message"),
                    }
                )
    return out


async def process_instagram_webhook(db: AsyncSession, body: dict[str, Any]) -> int:
    """Разбор вебхука Meta (object instagram или page). Возвращает число обработанных сообщений."""
    obj = body.get("object")
    entries = [e for e in (body.get("entry") or []) if isinstance(e, dict)]
    if not entries:
        log.warning("meta webhook: пустой entry — тело не похоже на вебхук сообщений")
        return 0

    if obj not in ("instagram", "page"):
        has_msg = any(
            (e.get("messaging") or _normalize_messaging_events(e)) for e in entries
        )
        if not has_msg:
            log.warning(
                "meta webhook: object=%r не instagram/page и нет messaging — игнор (полный тест см. META_WEBHOOK_LOG_BODY)",
                obj,
            )
            return 0
        log.warning("meta webhook: object=%r нестандартный, но есть messaging — разбираем", obj)

    settings = get_settings()
    log.info("meta webhook: object=%r entries=%s", obj, len(entries))
    n = 0
    for entry in entries:
        entry_id = str(entry.get("id") or "")
        page_id = await resolve_page_id_for_entry(entry_id, settings)
        if not page_id:
            continue
        if not page_access_token(page_id, settings):
            log.warning("meta webhook: нет токена для page_id=%s", page_id)
            continue

        messaging_list = entry.get("messaging") or []
        if not messaging_list:
            messaging_list = _normalize_messaging_events(entry)
        if not messaging_list:
            log.info(
                "meta webhook: entry id=%s без messaging/changes — ключи entry: %s",
                entry_id,
                list(entry.keys()),
            )

        for m in messaging_list:
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
            sender = m.get("sender") or m.get("from") or {}
            if not isinstance(sender, dict):
                continue
            customer_psid = str(sender.get("id") or "")
            if not customer_psid:
                continue

            text, attachments = _message_text_and_attachments(msg)
            if not text:
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
                if not deal.client_id:
                    cid = await _ensure_instagram_client(
                        db,
                        customer_psid=customer_psid,
                        page_id=page_id,
                        funnel_id=deal.funnel_id,
                    )
                    deal.client_id = cid
                    if not (deal.contact_name or "").strip():
                        deal.contact_name = f"Instagram · {customer_psid[-8:]}"
                comments = list(deal.comments or [])
                if _comment_has_mid(comments, mid):
                    continue
                row: dict[str, Any] = {
                    "id": f"ig-{mid or uuid.uuid4().hex[:12]}",
                    "text": text,
                    "authorId": f"ig_user:{customer_psid}",
                    "createdAt": created_at,
                    "type": "instagram_in",
                    "metaMid": mid,
                }
                if attachments:
                    row["attachments"] = attachments
                comments.append(row)
                deal.comments = comments
                deal.updated_at = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
                await db.flush()
                n += 1
                continue

            # Новый диалог → клиент + сделка (поток = thread_key, дублей сделок по тому же PSID+странице нет)
            funnel_id, stage_id = await _default_funnel_stage(db)
            assignee_id = None
            funnel = None
            if funnel_id:
                funnel = await db.get(SalesFunnel, funnel_id)
                if funnel and getattr(funnel, "owner_user_id", None):
                    assignee_id = funnel.owner_user_id
            if not assignee_id:
                assignee_id = await _first_assignee_id(db)
            client_id = await _ensure_instagram_client(
                db,
                customer_psid=customer_psid,
                page_id=page_id,
                funnel_id=funnel_id,
            )
            did = str(uuid.uuid4())
            title = f"Instagram · {customer_psid[-8:]}"
            now = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
            first_comment: dict[str, Any] = {
                "id": f"ig-{mid or uuid.uuid4().hex[:12]}",
                "text": text,
                "authorId": f"ig_user:{customer_psid}",
                "createdAt": created_at,
                "type": "instagram_in",
                "metaMid": mid,
            }
            if attachments:
                first_comment["attachments"] = attachments
            deal = Deal(
                id=did,
                title=title,
                client_id=client_id,
                contact_name=f"Instagram · {customer_psid[-8:]}",
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
                comments=[first_comment],
                is_archived=False,
            )
            db.add(deal)
            await db.flush()
            try:
                await emit_domain_event(
                    db,
                    event_type="deal.assigned",
                    org_id="default",
                    entity_type="deal",
                    entity_id=did,
                    source="meta-webhook",
                    payload={
                        "dealId": did,
                        "title": title,
                        "source": "instagram",
                        "assigneeId": assignee_id,
                        "actorName": "Instagram",
                        "funnelName": funnel.name if funnel else None,
                    },
                )
            except Exception as exc:
                log.warning(
                    "meta webhook: сделка %s создана, но emit_domain_event не удался: %s",
                    did,
                    exc,
                )
            n += 1

    return n
