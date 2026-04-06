"""Server-side Telegram lead intake (polling getUpdates or HTTPS webhook).

Design goals:
- Do NOT expose bot tokens to browser.
- Use funnel.sources.telegram.botToken as the token source of truth.
- Persist last_update_id per funnel in Postgres (telegram_integration_state).
- Create/update deals with source='telegram' and telegram_chat_id=chatId.
- Emit deal.assigned so notifications/chat/WS update instantly.
"""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.client import Deal
from app.models.funnel import SalesFunnel
from app.models.telegram_integration import TelegramIntegrationState
from app.models.user import User
from app.services.domain_events import emit_domain_event

log = logging.getLogger("uvicorn.error")


def _now_iso() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def _first_stage_id(funnel: SalesFunnel) -> str:
    stages = funnel.stages or []
    if isinstance(stages, list) and stages:
        first = stages[0]
        if isinstance(first, dict):
            sid = first.get("id")
            if isinstance(sid, str) and sid:
                return sid
    return "new"


async def _first_assignee_id(db: AsyncSession) -> str:
    result = await db.execute(select(User.id).where(User.is_archived.is_(False)).limit(1))
    uid = result.scalar_one_or_none()
    return uid or ""


def _telegram_cfg(funnel: SalesFunnel) -> dict[str, Any] | None:
    src = funnel.sources or {}
    if not isinstance(src, dict):
        return None
    tg = src.get("telegram")
    return tg if isinstance(tg, dict) else None


def telegram_source_config(funnel: SalesFunnel) -> dict[str, Any] | None:
    """Public alias for routers that need funnel Telegram JSON config."""
    return _telegram_cfg(funnel)


def should_use_webhook_only(cfg: dict[str, Any] | None) -> bool:
    """When True, polling loop must not call getUpdates for this funnel."""
    if not cfg:
        return False
    return cfg.get("useWebhook") is True


async def _ensure_telegram_state(
    db: AsyncSession, funnel_id: str
) -> TelegramIntegrationState:
    st = await db.get(TelegramIntegrationState, funnel_id)
    if not st:
        st = TelegramIntegrationState(funnel_id=funnel_id, last_update_id=0)
        db.add(st)
        await db.flush()
    return st


async def process_private_message_for_funnel(
    db: AsyncSession,
    funnel: SalesFunnel,
    msg: dict[str, Any],
    *,
    event_source: str,
) -> bool:
    """Handle one private chat message. Returns True if a deal row was created or updated."""
    chat = msg.get("chat")
    if not isinstance(chat, dict):
        return False
    if (chat.get("type") or "").lower() != "private":
        return False

    chat_id = str(chat.get("id") or "").strip()
    if not chat_id:
        return False

    frm = msg.get("from") or {}
    username = None
    if isinstance(frm, dict):
        if frm.get("username"):
            username = f"@{frm.get('username')}"
        else:
            username = frm.get("first_name")
    username = str(username or "Telegram").strip()

    text = msg.get("text") or ""
    if not isinstance(text, str) or not text.strip():
        text = "[вложение]"

    existing = (
        await db.execute(
            select(Deal).where(
                Deal.telegram_chat_id == chat_id,
                Deal.source == "telegram",
                Deal.funnel_id == funnel.id,
                Deal.is_archived.is_(False),
            ).limit(1)
        )
    ).scalar_one_or_none()

    now = _now_iso()
    if existing:
        comments = list(existing.comments or [])
        comments.append(
            {
                "id": f"tg-{uuid.uuid4().hex[:12]}",
                "text": text[:4000],
                "authorId": "tg_user",
                "createdAt": now,
                "type": "telegram_in",
            }
        )
        existing.comments = comments
        existing.updated_at = now
        await db.flush()
        return True

    assignee_id = getattr(funnel, "owner_user_id", None) or ""
    if not assignee_id:
        assignee_id = await _first_assignee_id(db)

    did = str(uuid.uuid4())
    title = f"Telegram · {username}"
    deal = Deal(
        id=did,
        title=title[:500],
        contact_name=username[:255],
        amount="0",
        currency="UZS",
        stage=_first_stage_id(funnel),
        funnel_id=funnel.id,
        source="telegram",
        telegram_chat_id=chat_id,
        telegram_username=username[:100],
        assignee_id=assignee_id or "",
        created_at=now,
        notes=text[:2000],
        comments=[
            {
                "id": f"tg-{uuid.uuid4().hex[:12]}",
                "text": text[:4000],
                "authorId": "tg_user",
                "createdAt": now,
                "type": "telegram_in",
            }
        ],
        is_archived=False,
    )
    db.add(deal)
    await db.flush()
    if assignee_id:
        try:
            await emit_domain_event(
                db,
                event_type="deal.assigned",
                org_id="default",
                entity_type="deal",
                entity_id=did,
                source=event_source,
                actor_id=None,
                payload={
                    "dealId": did,
                    "title": title,
                    "assigneeId": assignee_id,
                    "actorName": "Telegram",
                    "funnelName": funnel.name,
                },
            )
        except Exception as exc:
            log.warning("telegram leads: emit_domain_event failed deal=%s: %s", did, exc)
    return True


async def process_telegram_update_dict(
    db: AsyncSession,
    funnel: SalesFunnel,
    upd: dict[str, Any],
    *,
    event_source: str,
) -> int:
    """Process one Telegram Update object. Returns 1 if a private message was handled, else 0."""
    st = await _ensure_telegram_state(db, funnel.id)

    uid = upd.get("update_id")
    if uid is not None:
        try:
            st.last_update_id = max(int(st.last_update_id or 0), int(uid))
        except Exception:
            pass
        await db.flush()

    msg = upd.get("message")
    if not isinstance(msg, dict):
        return 0

    ok = await process_private_message_for_funnel(db, funnel, msg, event_source=event_source)
    return 1 if ok else 0


async def poll_once_for_funnel(db: AsyncSession, funnel: SalesFunnel) -> int:
    """Poll Telegram updates for a single funnel. Returns processed message count."""
    cfg = _telegram_cfg(funnel)
    if not (cfg and cfg.get("enabled") is True):
        return 0
    if should_use_webhook_only(cfg):
        return 0
    token = str(cfg.get("botToken") or "").strip()
    if not token:
        return 0

    settings = get_settings()
    st = await _ensure_telegram_state(db, funnel.id)

    offset = int(st.last_update_id or 0) + 1
    limit = int(settings.TELEGRAM_LEADS_POLL_LIMIT or 50)
    url = f"https://api.telegram.org/bot{token}/getUpdates"
    processed = 0
    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            r = await client.get(url, params={"offset": offset, "limit": limit})
        if r.status_code != 200:
            log.warning("telegram leads: funnel=%s getUpdates HTTP %s %s", funnel.id, r.status_code, r.text[:200])
            return 0
        data = r.json()
    except Exception as exc:
        log.warning("telegram leads: funnel=%s getUpdates failed: %s", funnel.id, exc)
        return 0

    if not (isinstance(data, dict) and data.get("ok") is True):
        return 0
    updates = data.get("result") or []
    if not isinstance(updates, list) or not updates:
        return 0

    max_update_id = int(st.last_update_id or 0)

    for upd in updates:
        if not isinstance(upd, dict):
            continue
        uid = upd.get("update_id")
        try:
            if uid is not None:
                max_update_id = max(max_update_id, int(uid))
        except Exception:
            pass

        msg = upd.get("message")
        if not isinstance(msg, dict):
            continue
        if await process_private_message_for_funnel(db, funnel, msg, event_source="telegram-poll"):
            processed += 1

    st.last_update_id = max_update_id
    await db.flush()
    return processed


async def poll_all_funnels(db: AsyncSession) -> int:
    """Poll Telegram for all funnels that have telegram enabled (non-webhook mode)."""
    funnels = (await db.execute(select(SalesFunnel))).scalars().all()
    total = 0
    for f in funnels:
        try:
            total += await poll_once_for_funnel(db, f)
        except Exception as exc:
            log.warning("telegram leads: funnel=%s failed: %s", getattr(f, "id", "?"), exc)
    return total
