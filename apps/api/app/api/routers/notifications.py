"""User notifications center + realtime websocket."""

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.config import get_settings
from app.core.redis import get_redis_client
from app.db import get_db
from app.models.notification import Notification
from app.models.user import User
from app.schemas.notification_events import NotificationReadStateBody
from app.schemas.notifications_api import (
    NotificationDeliveriesRunResponse,
    NotificationMarkReadResponse,
    NotificationRetentionRunResponse,
    NotificationRowRead,
    NotificationUnreadCountResponse,
)
from app.services.domain_events import log_entity_mutation
from app.services.notification_delivery import enqueue_due_notification_delivery_jobs
from app.services.notification_retention import run_notification_retention
from app.services.notifications_realtime import realtime_hub
from app.services.notifications_stream import ensure_notifications_stream

router = APIRouter(prefix="/notifications", tags=["notifications"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[NotificationRowRead])
async def list_notifications(
    user_id: str = Query(...),
    unread_only: bool = Query(False),
    limit: int = Query(50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if (user_id or "").strip() != str(current_user.id):
        raise HTTPException(status_code=403, detail="notification_user_mismatch")
    q = select(Notification).where(Notification.user_id == user_id)
    if unread_only:
        q = q.where(Notification.is_read == False)  # noqa: E712
    q = q.order_by(desc(Notification.created_at)).limit(limit)
    rows = (await db.execute(q)).scalars().all()
    return [
        {
            "id": r.id,
            "userId": r.user_id,
            "type": r.type,
            "title": r.title,
            "body": r.body,
            "entityType": r.entity_type,
            "entityId": r.entity_id,
            "isRead": bool(r.is_read),
            "createdAt": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


@router.get("/unread-count", response_model=NotificationUnreadCountResponse)
async def unread_count(
    user_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if (user_id or "").strip() != str(current_user.id):
        raise HTTPException(status_code=403, detail="notification_user_mismatch")
    count = (
        await db.execute(
            select(func.count(Notification.id)).where(
                Notification.user_id == user_id,
                Notification.is_read == False,  # noqa: E712
            )
        )
    ).scalar_one()
    return {"userId": user_id, "unreadCount": int(count)}


@router.post("/{notification_id}/read", response_model=NotificationMarkReadResponse)
async def mark_notification_read(
    notification_id: str,
    body: NotificationReadStateBody,
    db: AsyncSession = Depends(get_db),
):
    row = await db.get(Notification, notification_id)
    if not row:
        return {"ok": False, "error": "not_found"}
    is_read = body.isRead
    row.is_read = is_read
    await db.flush()
    await log_entity_mutation(
        db,
        event_type="notification.read_state.updated",
        entity_type="notification",
        entity_id=notification_id,
        source="notifications-router",
        actor_id=row.user_id,
        payload={"isRead": is_read},
    )
    return {"ok": True}


@router.websocket("/ws/{user_id}")
async def notifications_ws(websocket: WebSocket, user_id: str):
    uid = realtime_hub.normalize_user_id(user_id)
    if not uid:
        await websocket.close(code=1008)
        return
    ok = await realtime_hub.connect(uid, websocket)
    if not ok:
        return
    try:
        while True:
            # keepalive / ping от клиента (не обрабатываем тело — только удержание соединения)
            await websocket.receive_text()
    except WebSocketDisconnect:
        realtime_hub.disconnect(uid, websocket)
    except Exception:
        realtime_hub.disconnect(uid, websocket)


@router.post("/deliveries/run", response_model=NotificationDeliveriesRunResponse)
async def run_deliveries(
    limit: int = Query(default=100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
):
    """Поставить в очередь ``queue.notifications`` задачи по всем «готовым» доставкам (без синхронной отправки)."""
    redis = await get_redis_client()
    if not redis:
        raise HTTPException(status_code=503, detail="redis_unavailable")
    await ensure_notifications_stream(redis)
    result = await enqueue_due_notification_delivery_jobs(db, redis, limit=limit)
    await db.commit()
    return {"ok": True, "queued": result["queued"]}


@router.post("/retention/run", response_model=NotificationRetentionRunResponse)
async def run_retention(
    days: int = Query(default=None, ge=1, le=3650),
    db: AsyncSession = Depends(get_db),
):
    settings = get_settings()
    retention_days = int(days or settings.NOTIFICATIONS_RETENTION_DAYS)
    result = await run_notification_retention(db, days=retention_days)
    return {"ok": True, "days": retention_days, **result}
