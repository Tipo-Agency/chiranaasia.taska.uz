"""Notification hub: маршрутизация доменных событий → уведомления и побочные эффекты (чат, realtime)."""
from __future__ import annotations

import logging
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Deal
from app.models.funnel import SalesFunnel
from app.models.settings import InboxMessage
from app.services.notifications import (
    channel_flags_from_prefs,
    create_notification,
    create_notification_delivery,
    email_recipient_from,
    load_user_and_notification_pref_row,
    prefs_dict_from_pref_row,
    telegram_recipient_from,
)
from app.services.notifications_realtime import realtime_hub

SYSTEM_SENDER_ID = "system"
_hub_log = logging.getLogger("uvicorn.error")


def _format_deal_assigned_body(payload: dict[str, Any]) -> str:
    """Human-readable assignment text for in-app/chat/email (plain text)."""
    actor = str(payload.get("actorName") or "Система")
    title = str(payload.get("title") or "Без названия")
    head = f'{actor} назначил вам сделку: "{title}"'

    lines: list[str] = []
    fn = payload.get("funnelName")
    if fn:
        lines.append(f"Воронка: {fn}")
    sl = payload.get("stageLabel")
    if sl:
        lines.append(f"Этап: {sl}")
    cn = payload.get("contactName")
    if cn:
        lines.append(f"Имя: {cn}")
    ph = payload.get("phone")
    if ph:
        lines.append(f"Телефон: {ph}")
    em = payload.get("email")
    if em:
        lines.append(f"Email: {em}")
    msg = payload.get("message")
    if msg:
        m = str(msg).strip()
        if len(m) > 600:
            m = m[:597] + "..."
        lines.append(f"Сообщение: {m}")

    if not lines:
        return head
    return head + "\n\n" + "\n".join(lines)


def _route_event(event: dict[str, Any]) -> list[dict[str, Any]]:
    """
    Return recipient notifications.
    Event shape follows DomainEventIn.
    """
    et = event.get("type")
    payload = event.get("payload") or {}
    actor_name = payload.get("actorName") or "Система"
    routes: list[dict[str, Any]] = []

    if et == "task.assigned":
        uid = payload.get("assigneeId")
        if uid:
            routes.append(
                {
                    "recipient_id": uid,
                    "title": "Новая задача",
                    "body": f'{actor_name} поставил вам задачу: "{payload.get("title") or "Без названия"}"',
                }
            )
    elif et == "task.status.changed":
        for uid in [payload.get("assigneeId"), payload.get("createdByUserId")]:
            if uid:
                routes.append(
                    {
                        "recipient_id": uid,
                        "title": "Статус задачи изменен",
                        "body": f'Задача "{payload.get("title") or "Без названия"}" -> {payload.get("status") or "Новый статус"}',
                    }
                )
    elif et == "deal.assigned":
        uid = payload.get("assigneeId")
        if uid:
            body = _format_deal_assigned_body(payload)
            routes.append(
                {
                    "recipient_id": uid,
                    "title": "Новая сделка",
                    "body": body,
                }
            )
    elif et == "meeting.created":
        for uid in payload.get("participantIds") or []:
            routes.append(
                {
                    "recipient_id": uid,
                    "title": "Календарь: новое событие",
                    "body": f'"{payload.get("title") or "Без названия"}" — {payload.get("date") or ""} {payload.get("time") or ""}'.strip(),
                }
            )
    elif et == "document.shared":
        for uid in payload.get("recipientIds") or []:
            routes.append(
                {
                    "recipient_id": uid,
                    "title": "Документ открыт вам",
                    "body": f'Документ "{payload.get("title") or "Без названия"}" доступен для просмотра',
                }
            )

    # dedupe recipient per event
    uniq: dict[str, dict[str, Any]] = {}
    for r in routes:
        uniq[r["recipient_id"]] = r
    return list(uniq.values())


def _flatten_payload_for_templates(payload: dict[str, Any]) -> dict[str, str]:
    out: dict[str, str] = {}
    for k, v in payload.items():
        if isinstance(v, bool | int | float):
            out[k] = str(v)
        elif v is None:
            out[k] = ""
        elif isinstance(v, str):
            out[k] = v
    return out


def _render_deal_template(tpl: str, flat: dict[str, str]) -> str:
    if not tpl:
        return ""
    out = tpl
    for k, v in flat.items():
        out = out.replace("{{" + k + "}}", v)
    return out


async def _enrich_deal_assigned_event(db: AsyncSession, event: dict[str, Any]) -> None:
    if event.get("type") != "deal.assigned":
        return
    payload = dict(event.get("payload") or {})
    eid = event.get("entityId")
    if not eid:
        event["payload"] = payload
        return
    deal = await db.get(Deal, eid)
    if not deal:
        event["payload"] = payload
        return
    payload.setdefault("funnelId", deal.funnel_id)
    payload.setdefault("title", deal.title or "")
    if deal.contact_name:
        payload.setdefault("contactName", deal.contact_name)
    if deal.funnel_id:
        funnel = await db.get(SalesFunnel, deal.funnel_id)
        if funnel:
            payload.setdefault("funnelName", funnel.name or "")
            st = funnel.stages or []
            stage_label = str(deal.stage or "")
            if isinstance(st, list):
                for s in st:
                    if isinstance(s, dict) and (s.get("id") == deal.stage or s.get("label") == deal.stage):
                        stage_label = str(s.get("label") or deal.stage or "")
                        break
            payload.setdefault("stageLabel", stage_label)
    event["payload"] = payload


async def _apply_funnel_deal_templates(
    db: AsyncSession, event: dict[str, Any], routes: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    if event.get("type") != "deal.assigned" or not routes:
        return routes
    payload = event.get("payload") or {}
    fid = payload.get("funnelId")
    if not fid:
        return routes
    funnel = await db.get(SalesFunnel, fid)
    if not funnel:
        return routes
    raw = getattr(funnel, "notification_templates", None) or {}
    if not isinstance(raw, dict):
        return routes
    da = raw.get("dealAssigned")
    if not isinstance(da, dict):
        return routes
    chat_tpl = (da.get("chatBody") or da.get("chat") or "").strip()
    title_tpl = (da.get("title") or "").strip()
    if not chat_tpl and not title_tpl:
        return routes
    flat = _flatten_payload_for_templates(payload)
    out: list[dict[str, Any]] = []
    for r in routes:
        nr = dict(r)
        if title_tpl:
            nr["title"] = _render_deal_template(title_tpl, flat)[:500]
        if chat_tpl:
            nr["body"] = _render_deal_template(chat_tpl, flat)
            if len(nr["body"]) > 4000:
                nr["body"] = nr["body"][:3997] + "..."
        out.append(nr)
    return out


async def process_domain_event(db: AsyncSession, event: dict[str, Any]) -> int:
    """
    Для каждого получателя: одно `Notification`, затем отдельно — `NotificationDelivery` (telegram/email),
    опционально зеркало в internal chat и realtime.
    Returns created notifications count.
    """
    if event.get("type") == "deal.assigned":
        await _enrich_deal_assigned_event(db, event)
    routes = _route_event(event)
    if event.get("type") == "deal.assigned":
        routes = await _apply_funnel_deal_templates(db, event, routes)
    created = 0
    for r in routes:
        user, pref_row = await load_user_and_notification_pref_row(db, r["recipient_id"])
        prefs = prefs_dict_from_pref_row(pref_row)
        flags = channel_flags_from_prefs(prefs)

        n = create_notification(
            user_id=r["recipient_id"],
            notification_type=event["type"],
            title=r["title"],
            body=r["body"],
            entity_type=event.get("entityType"),
            entity_id=event.get("entityId"),
        )
        db.add(n)
        await db.flush()

        try:
            from app.core.redis import get_redis_client
            from app.services.notifications_stream import ensure_notifications_stream, xadd_notification_job

            redis = await get_redis_client()
            if redis:
                await ensure_notifications_stream(redis)
                await xadd_notification_job(redis, n.id)
        except Exception as exc:
            _hub_log.warning("notification_hub: queue.notifications XADD failed: %s", exc)

        if flags["chat"]:
            msg = InboxMessage(
                id=str(uuid.uuid4()),
                deal_id=None,
                funnel_id=None,
                direction="in",
                channel="internal",
                sender_id=SYSTEM_SENDER_ID,
                body=r["body"],
                media_url=None,
                external_msg_id=None,
                is_read=False,
                recipient_id=r["recipient_id"],
                attachments=[
                    {
                        "entityType": event.get("entityType"),
                        "entityId": event.get("entityId"),
                        "label": r["title"],
                    }
                ],
                created_at=datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z",
            )
            db.add(msg)

        if flags["telegram"]:
            tid = telegram_recipient_from(user, pref_row)
            if tid:
                db.add(create_notification_delivery(notification_id=n.id, channel="telegram", recipient=tid))
        if flags["email"]:
            em = email_recipient_from(user)
            if em:
                db.add(create_notification_delivery(notification_id=n.id, channel="email", recipient=em))

        if flags["in_app"]:
            await realtime_hub.emit(
                r["recipient_id"],
                {
                    "type": "notification.created",
                    "userId": r["recipient_id"],
                    "notification": {
                        "id": n.id,
                        "type": n.type,
                        "title": n.title,
                        "body": n.body,
                        "entityType": n.entity_type,
                        "entityId": n.entity_id,
                        "isRead": bool(n.is_read),
                        "createdAt": n.created_at.isoformat() if n.created_at else None,
                    },
                },
            )
        created += 1
    return created
