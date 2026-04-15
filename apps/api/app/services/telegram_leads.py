"""Server-side Telegram lead intake (polling getUpdates or HTTPS webhook).

Design goals:
- Do NOT expose bot tokens to browser.
- Токен воронки: `token_encrypted` в JSONB; в памяти — только через `telegram_config_for_runtime`.
- Persist last_update_id per funnel in Postgres (telegram_integration_state).
- Create/update deals with source='telegram' and source_chat_id=chatId.
- Emit deal.assigned so notifications/chat/WS update instantly.
"""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

import httpx
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.client import Deal
from app.models.funnel import SalesFunnel
from app.models.telegram_integration import TelegramIntegrationState
from app.models.user import User
from app.services.domain_events import emit_domain_event
from app.services.funnel_sources_crypto import telegram_config_for_runtime
from app.services.http_client import async_http_client

log = logging.getLogger("uvicorn.error")


def telegram_poll_offset_redis_key(funnel_id: str) -> str:
    from app.core.redis import redis_key

    return redis_key("integrations", "telegram_poll_offset", funnel_id)


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


async def _first_assignee_id(db: AsyncSession) -> str | None:
    result = await db.execute(select(User.id).where(User.is_archived.is_(False)).limit(1))
    uid = result.scalar_one_or_none()
    return uid if uid else None


def _telegram_raw(funnel: SalesFunnel) -> dict[str, Any] | None:
    src = funnel.sources or {}
    if not isinstance(src, dict):
        return None
    tg = src.get("telegram")
    return tg if isinstance(tg, dict) else None


def telegram_source_config(funnel: SalesFunnel) -> dict[str, Any] | None:
    """Расшифрованный конфиг для сервера (не отдавать в API)."""
    return telegram_config_for_runtime(_telegram_raw(funnel))


def should_use_webhook_only(cfg: dict[str, Any] | None) -> bool:
    """When True, polling loop must not call getUpdates for this funnel."""
    if not cfg:
        return False
    return cfg.get("useWebhook") is True


def _telegram_comment_dedup_key(msg: dict[str, Any], update_id: Any) -> str | None:
    """Стабильный ключ для дедупликации повторных webhook/getUpdates (message_id или update_id)."""
    mid = msg.get("message_id")
    if mid is not None:
        try:
            return str(int(mid))
        except (TypeError, ValueError):
            s = str(mid).strip()
            return s or None
    if update_id is not None:
        try:
            return f"update:{int(update_id)}"
        except (TypeError, ValueError):
            return None
    return None


def _comment_has_telegram_dedup_key(comments: list[Any] | None, key: str | None) -> bool:
    if not key or not comments:
        return False
    for c in comments:
        if isinstance(c, dict) and c.get("telegramMessageId") == key:
            return True
    return False


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
    update_id: Any | None = None,
) -> bool:
    """Handle one inbound Telegram message (личка, группа или супергруппа). Returns True if deal created/updated."""
    chat = msg.get("chat")
    if not isinstance(chat, dict):
        return False
    chat_type = (chat.get("type") or "").lower()
    if chat_type not in ("private", "group", "supergroup"):
        return False

    chat_id = str(chat.get("id") or "").strip()
    if not chat_id:
        return False

    frm = msg.get("from") or {}
    sender_label = None
    if isinstance(frm, dict):
        if frm.get("username"):
            sender_label = f"@{frm.get('username')}"
        else:
            sender_label = str(frm.get("first_name") or "").strip() or None

    if chat_type == "private":
        username = str(sender_label or "Telegram").strip()
    else:
        group_title = str(chat.get("title") or "").strip() or ("Супергруппа" if chat_type == "supergroup" else "Группа")
        if sender_label:
            username = f"{group_title} · {sender_label}"
        else:
            username = group_title

    text = msg.get("text") or ""
    if not isinstance(text, str) or not text.strip():
        text = "[вложение]"

    existing = (
        await db.execute(
            select(Deal).where(
                Deal.source_chat_id == chat_id,
                Deal.source == "telegram",
                Deal.funnel_id == funnel.id,
                Deal.is_archived.is_(False),
            ).limit(1)
        )
    ).scalar_one_or_none()

    now = _now_iso()
    dedup_key = _telegram_comment_dedup_key(msg, update_id)
    if existing:
        comments = list(existing.comments or [])
        if _comment_has_telegram_dedup_key(comments, dedup_key):
            log.info(
                "telegram leads: duplicate message skipped funnel=%s chat_id=%s telegramMessageId=%r source=%s",
                funnel.id,
                chat_id,
                dedup_key,
                event_source,
            )
            return False
        row_in: dict[str, Any] = {
            "id": f"tg-{uuid.uuid4().hex[:12]}",
            "text": text[:4000],
            "authorId": "tg_user",
            "createdAt": now,
            "type": "telegram_in",
        }
        if dedup_key:
            row_in["telegramMessageId"] = dedup_key
        else:
            log.warning(
                "telegram leads: no dedup key (message_id/update_id) funnel=%s chat_id=%s source=%s",
                funnel.id,
                chat_id,
                event_source,
            )
        comments.append(row_in)
        existing.comments = comments
        existing.updated_at = now
        await db.flush()
        return True

    assignee_id = getattr(funnel, "owner_user_id", None)
    if not assignee_id:
        assignee_id = await _first_assignee_id(db)

    did = str(uuid.uuid4())
    title = f"Telegram · {username}"
    first_comment: dict[str, Any] = {
        "id": f"tg-{uuid.uuid4().hex[:12]}",
        "text": text[:4000],
        "authorId": "tg_user",
        "createdAt": now,
        "type": "telegram_in",
    }
    if dedup_key:
        first_comment["telegramMessageId"] = dedup_key
    else:
        log.warning(
            "telegram leads: no dedup key on new deal funnel=%s chat_id=%s source=%s",
            funnel.id,
            chat_id,
            event_source,
        )
    deal = Deal(
        id=did,
        title=title[:500],
        contact_name=username[:255],
        amount=Decimal("0"),
        currency="UZS",
        stage=_first_stage_id(funnel),
        funnel_id=funnel.id,
        source="telegram",
        source_chat_id=chat_id,
        tags=[],
        custom_fields={"_legacy": {"telegram_username": username[:100]}},
        assignee_id=assignee_id,
        created_at=now,
        notes=text[:2000],
        comments=[first_comment],
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
    """Process one Telegram Update object. Returns 1 if a chat message was handled, else 0."""
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

    ok = await process_private_message_for_funnel(
        db,
        funnel,
        msg,
        event_source=event_source,
        update_id=upd.get("update_id"),
    )
    return 1 if ok else 0


async def poll_once_for_funnel(
    db: AsyncSession,
    funnel: SalesFunnel,
    *,
    redis: Redis | None = None,
) -> int:
    """
    Poll Telegram updates for a single funnel. Returns processed message count.

    ``redis``: при наличии читает/пишет offset в ``taska:integrations:telegram_poll_offset:{funnel_id}``,
    синхронно с ``telegram_integration_state.last_update_id`` (max(webhook, poll)).
    """
    cfg = telegram_source_config(funnel)
    if not (cfg and cfg.get("enabled") is True):
        return 0
    if should_use_webhook_only(cfg):
        return 0
    token = str(cfg.get("botToken") or "").strip()
    if not token:
        return 0

    settings = get_settings()
    st = await _ensure_telegram_state(db, funnel.id)

    base_last = int(st.last_update_id or 0)
    if redis is not None:
        try:
            raw = await redis.get(telegram_poll_offset_redis_key(funnel.id))
            if raw is not None and str(raw).strip() != "":
                base_last = max(base_last, int(raw))
        except (TypeError, ValueError):
            pass
        except Exception as exc:
            log.warning("telegram leads: redis offset read funnel=%s: %s", funnel.id, exc)

    offset = base_last + 1
    limit = int(settings.TELEGRAM_LEADS_POLL_LIMIT or 50)
    url = f"https://api.telegram.org/bot{token}/getUpdates"
    processed = 0
    try:
        async with async_http_client(timeout=httpx.Timeout(25.0)) as client:
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

    max_update_id = base_last

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
        if await process_private_message_for_funnel(
            db,
            funnel,
            msg,
            event_source="telegram-poll",
            update_id=upd.get("update_id"),
        ):
            processed += 1

    st.last_update_id = max_update_id
    await db.flush()
    if redis is not None:
        try:
            await redis.set(telegram_poll_offset_redis_key(funnel.id), str(max_update_id))
        except Exception as exc:
            log.warning("telegram leads: redis offset write funnel=%s: %s", funnel.id, exc)
    return processed


async def poll_all_funnels(db: AsyncSession, *, redis: Redis | None = None) -> int:
    """Poll Telegram for all funnels that have telegram enabled (non-webhook mode)."""
    funnels = (await db.execute(select(SalesFunnel))).scalars().all()
    total = 0
    for f in funnels:
        try:
            total += await poll_once_for_funnel(db, f, redis=redis)
        except Exception as exc:
            log.warning("telegram leads: funnel=%s failed: %s", getattr(f, "id", "?"), exc)
    return total
