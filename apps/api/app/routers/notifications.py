"""User notifications center + realtime websocket."""
from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.notification import Notification
from app.services.domain_events import log_entity_mutation
from app.services.notifications_realtime import realtime_hub
from app.services.notification_delivery import run_pending_deliveries
from app.services.notification_retention import run_notification_retention
from app.config import get_settings

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
async def list_notifications(
    user_id: str = Query(...),
    unread_only: bool = Query(False),
    limit: int = Query(50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    q = select(Notification).where(Notification.recipient_id == user_id)
    if unread_only:
        q = q.where(Notification.is_read == False)  # noqa: E712
    q = q.order_by(desc(Notification.created_at)).limit(limit)
    rows = (await db.execute(q)).scalars().all()
    return [
        {
            "id": r.id,
            "eventId": r.event_id,
            "recipientId": r.recipient_id,
            "type": r.type,
            "title": r.title,
            "body": r.body,
            "priority": r.priority,
            "entityType": r.entity_type,
            "entityId": r.entity_id,
            "payload": r.payload or {},
            "isRead": bool(r.is_read),
            "readAt": r.read_at.isoformat() if r.read_at else None,
            "createdAt": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


@router.get("/unread-count")
async def unread_count(
    user_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    count = (
        await db.execute(
            select(func.count(Notification.id)).where(
                Notification.recipient_id == user_id,
                Notification.is_read == False,  # noqa: E712
            )
        )
    ).scalar_one()
    return {"userId": user_id, "unreadCount": int(count)}


@router.post("/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    row = await db.get(Notification, notification_id)
    if not row:
        return {"ok": False, "error": "not_found"}
    is_read = bool(body.get("isRead", True))
    row.is_read = is_read
    if is_read:
        from datetime import datetime, timezone

        row.read_at = datetime.now(timezone.utc)
    else:
        row.read_at = None
    await db.flush()
    await log_entity_mutation(
        db,
        event_type="notification.read_state.updated",
        entity_type="notification",
        entity_id=notification_id,
        source="notifications-router",
        actor_id=row.recipient_id,
        payload={"isRead": is_read},
    )
    return {"ok": True}


@router.websocket("/ws/{user_id}")
async def notifications_ws(websocket: WebSocket, user_id: str):
    await realtime_hub.connect(user_id, websocket)
    try:
        while True:
            # keepalive/read loop
            await websocket.receive_text()
    except WebSocketDisconnect:
        realtime_hub.disconnect(user_id, websocket)
    except Exception:
        realtime_hub.disconnect(user_id, websocket)


@router.post("/deliveries/run")
async def run_deliveries(
    limit: int = Query(default=100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
):
    """Manual runner for pending channel deliveries (Phase 3)."""
    result = await run_pending_deliveries(db, limit=limit)
    return {"ok": True, **result}


@router.post("/retention/run")
async def run_retention(
    days: int = Query(default=None, ge=1, le=3650),
    db: AsyncSession = Depends(get_db),
):
    settings = get_settings()
    retention_days = int(days or settings.NOTIFICATIONS_RETENTION_DAYS)
    result = await run_notification_retention(db, days=retention_days)
    return {"ok": True, "days": retention_days, **result}
