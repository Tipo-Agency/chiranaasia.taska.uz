"""Admin-only API: DB browser, health, stats, run tests, Telegram bot management. Requires role ADMIN."""
import asyncio
import os
import subprocess
import urllib.request
import urllib.parse
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, text, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user_admin
from app.config import get_settings
from app.database import get_db, AsyncSessionLocal
from app.models import Base
from app.models.notification import NotificationPreferences as NPrefModel
from app.models.notification import NotificationDelivery, Notification
from app.models.user import User
from app.services.event_bus import _get_redis
from app.services.notification_delivery import run_pending_deliveries
from app.services.notification_retention import run_notification_retention

router = APIRouter(prefix="/admin", tags=["admin"])


def _send_telegram(chat_id: str, text: str, parse_mode: str = "HTML") -> tuple[bool, str]:
    """Send message via Telegram Bot API. Returns (success, error_message)."""
    token = get_settings().TELEGRAM_BOT_TOKEN.strip()
    if not token:
        return False, "TELEGRAM_BOT_TOKEN not configured"
    if not chat_id:
        return False, "Group chat ID not set in notification settings"
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    data = urllib.parse.urlencode({
        "chat_id": chat_id,
        "text": text,
        "parse_mode": parse_mode,
    }).encode()
    try:
        req = urllib.request.Request(url, data=data, method="POST")
        req.add_header("Content-Type", "application/x-www-form-urlencoded")
        with urllib.request.urlopen(req, timeout=15) as r:
            if r.status >= 200 and r.status < 300:
                return True, ""
            return False, f"HTTP {r.status}"
    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ""
        return False, f"HTTP {e.code}: {body}"
    except Exception as e:
        return False, str(e)


def _allowed_tables() -> List[str]:
    """Table names from ORM (whitelist for read-only browser)."""
    return list(Base.metadata.tables.keys())


# --- Response models ---


class TableInfo(BaseModel):
    name: str
    row_count: Optional[int] = None


class TableRowsResponse(BaseModel):
    table: str
    columns: List[str]
    rows: List[dict]
    total: Optional[int] = None
    offset: int
    limit: int


class HealthResponse(BaseModel):
    status: str
    version: str
    db: str
    db_error: Optional[str] = None


class TableStatsRow(BaseModel):
    table_name: str
    row_count: int


class AdminStatsResponse(BaseModel):
    tables: List[TableStatsRow]
    db_size_mb: Optional[float] = None


class TestRunResponse(BaseModel):
    ok: bool
    output: str
    exit_code: int


class BotStatusResponse(BaseModel):
    telegram_configured: bool
    group_chat_id: Optional[str] = None
    group_chat_id_set: bool


class BotSendTestResponse(BaseModel):
    ok: bool
    error: Optional[str] = None


class RedisMonitorResponse(BaseModel):
    redis_ok: bool
    redis_error: Optional[str] = None
    redis_url: str
    stream_name: str
    stream_length: Optional[int] = None
    stream_last_generated_id: Optional[str] = None
    stream_groups: Optional[int] = None
    events_total: int
    events_published: int
    deliveries_pending: int
    deliveries_failed: int
    deliveries_sent: int
    stream_group_details: Optional[List[dict]] = None


class DeliveryRunResponse(BaseModel):
    ok: bool
    processed: int
    sent: int
    failed: int
    skipped: int


class RetentionRunResponse(BaseModel):
    ok: bool
    days: int
    archived_notifications: int
    deleted_events: int
    deleted_deliveries: int


class FailedDeliveryRow(BaseModel):
    id: str
    notification_id: str
    channel: str
    attempts: str
    last_error: Optional[str] = None
    updated_at: Optional[str] = None
    notification_title: Optional[str] = None
    recipient_id: Optional[str] = None


class RequeueFailedResponse(BaseModel):
    ok: bool
    requeued: int


# --- Endpoints ---


@router.get("/tables", response_model=List[TableInfo])
async def list_tables(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_admin),
):
    """List all tables with optional row count. Admin only."""
    tables = _allowed_tables()
    result = []
    for name in sorted(tables):
        try:
            r = await db.execute(text(f"SELECT COUNT(*) FROM {name}"))
            count = r.scalar() or 0
        except Exception:
            count = None
        result.append(TableInfo(name=name, row_count=count))
    return result


@router.get("/tables/{table_name}", response_model=TableRowsResponse)
async def get_table_data(
    table_name: str,
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_admin),
):
    """Read-only paginated table data. Only whitelisted tables. Admin only."""
    allowed = _allowed_tables()
    if table_name not in allowed:
        raise HTTPException(status_code=404, detail="Table not found")
    # Safe: table_name is from whitelist
    try:
        count_r = await db.execute(text(f"SELECT COUNT(*) FROM {table_name}"))
        total = count_r.scalar() or 0
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    try:
        r = await db.execute(
            text(f"SELECT * FROM {table_name} ORDER BY 1 LIMIT :lim OFFSET :off"),
            {"lim": limit, "off": offset},
        )
        rows_raw = r.mappings().fetchall()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    columns = list(rows_raw[0].keys()) if rows_raw else []
    rows = []
    for row in rows_raw:
        d = dict(row)
        for k, v in d.items():
            if hasattr(v, "isoformat"):
                d[k] = v.isoformat()
        rows.append(d)
    return TableRowsResponse(
        table=table_name,
        columns=columns,
        rows=rows,
        total=total,
        offset=offset,
        limit=limit,
    )


@router.get("/health", response_model=HealthResponse)
async def admin_health(current_user: User = Depends(get_current_user_admin)):
    """Health check (same as /health but requires admin)."""
    payload: dict = {"status": "ok", "version": "1.0.0", "db": "ok", "db_error": None}
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
    except Exception as e:
        payload["db"] = "error"
        payload["db_error"] = str(e)
    return HealthResponse(**payload)


@router.get("/stats", response_model=AdminStatsResponse)
async def admin_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_admin),
):
    """Table row counts and optional DB size. Admin only."""
    tables = _allowed_tables()
    stats = []
    for name in sorted(tables):
        try:
            r = await db.execute(text(f"SELECT COUNT(*) FROM {name}"))
            count = r.scalar() or 0
        except Exception:
            count = -1
        stats.append(TableStatsRow(table_name=name, row_count=count))
    db_size_mb = None
    try:
        r = await db.execute(
            text("SELECT pg_database_size(current_database())::float / 1024.0 / 1024.0")
        )
        val = r.scalar()
        if val is not None:
            db_size_mb = round(float(val), 2)
    except Exception:
        pass
    return AdminStatsResponse(tables=stats, db_size_mb=db_size_mb)


@router.post("/tests/run", response_model=TestRunResponse)
async def run_tests(current_user: User = Depends(get_current_user_admin)):
    """Run pytest (apps/api/tests) and return output. Admin only. Blocking."""
    api_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    tests_dir = os.path.join(api_dir, "tests")
    if not os.path.isdir(tests_dir):
        return TestRunResponse(ok=False, output="Tests directory not found", exit_code=1)
    try:
        proc = await asyncio.to_thread(
            subprocess.run,
            [os.path.executable, "-m", "pytest", tests_dir, "-v", "--tb=short"],
            capture_output=True,
            text=True,
            cwd=api_dir,
            timeout=120,
            env={**os.environ, "TEST_API_URL": os.environ.get("TEST_API_URL", "http://localhost:8000")},
        )
        out = (proc.stdout or "") + (proc.stderr or "")
        return TestRunResponse(
            ok=proc.returncode == 0,
            output=out,
            exit_code=proc.returncode or 0,
        )
    except subprocess.TimeoutExpired:
        return TestRunResponse(ok=False, output="Tests timed out (120s)", exit_code=124)
    except Exception as e:
        return TestRunResponse(ok=False, output=str(e), exit_code=1)


# --- Telegram bot (admin) ---


@router.get("/bot/status", response_model=BotStatusResponse)
async def admin_bot_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_admin),
):
    """Status of Telegram bot integration: token and group chat. Admin only."""
    token = get_settings().TELEGRAM_BOT_TOKEN.strip()
    group_chat_id = None
    try:
        r = await db.execute(select(NPrefModel).limit(1))
        row = r.scalar_one_or_none()
        if row and row.telegram_group_chat_id:
            group_chat_id = str(row.telegram_group_chat_id).strip()
    except Exception:
        pass
    return BotStatusResponse(
        telegram_configured=bool(token),
        group_chat_id=group_chat_id or None,
        group_chat_id_set=bool(group_chat_id),
    )


@router.post("/bot/test-daily-summary", response_model=BotSendTestResponse)
async def admin_bot_test_daily_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_admin),
):
    """Send a test daily summary message to the configured Telegram group. Admin only."""
    r = await db.execute(select(NPrefModel).limit(1))
    row = r.scalar_one_or_none()
    chat_id = str(row.telegram_group_chat_id).strip() if row and row.telegram_group_chat_id else ""
    text = (
        "📋 <b>Тест: ежедневная сводка</b>\n\n"
        "Если вы видите это сообщение, отправка ежедневной сводки в группу работает. "
        "Реальная сводка уходит в 9:00 по ташкентскому времени."
    )
    ok, err = await asyncio.to_thread(_send_telegram, chat_id, text)
    return BotSendTestResponse(ok=ok, error=err if not ok else None)


@router.post("/bot/test-new-deal", response_model=BotSendTestResponse)
async def admin_bot_test_new_deal(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_admin),
):
    """Send a test 'new deal' notification to the Telegram group. Admin only."""
    r = await db.execute(select(NPrefModel).limit(1))
    row = r.scalar_one_or_none()
    chat_id = str(row.telegram_group_chat_id).strip() if row and row.telegram_group_chat_id else ""
    text = (
        "🆕 <b>Тест: новая заявка</b> [<b>Тестовая воронка</b>]\n\n"
        "Проверка уведомлений о новых заявках.\nКлиент: Тестовый клиент"
    )
    ok, err = await asyncio.to_thread(_send_telegram, chat_id, text)
    return BotSendTestResponse(ok=ok, error=err if not ok else None)


@router.post("/bot/test-congrats", response_model=BotSendTestResponse)
async def admin_bot_test_congrats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_admin),
):
    """Send a test 'successful deal' congratulations to the Telegram group. Admin only."""
    r = await db.execute(select(NPrefModel).limit(1))
    row = r.scalar_one_or_none()
    chat_id = str(row.telegram_group_chat_id).strip() if row and row.telegram_group_chat_id else ""
    text = (
        "🎉 <b>Тест: поздравление с новой сделкой</b>\n\n"
        "<b>Сделка:</b> Тестовая сделка\n"
        "<b>Клиент:</b> Тестовый клиент\n"
        "<b>Ответственный:</b> Админ\n\n"
        "🚀 Продолжаем в том же духе!"
    )
    ok, err = await asyncio.to_thread(_send_telegram, chat_id, text)
    return BotSendTestResponse(ok=ok, error=err if not ok else None)


@router.get("/redis/monitor", response_model=RedisMonitorResponse)
async def admin_redis_monitor(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_admin),
):
    settings = get_settings()
    redis_ok = False
    redis_error = None
    stream_length = None
    stream_last_generated_id = None
    stream_groups = None
    stream_group_details: list[dict] = []

    try:
        redis = await _get_redis()
        if redis is None:
            raise RuntimeError("redis_client_unavailable")
        await redis.ping()
        redis_ok = True
        try:
            xinfo = await redis.xinfo_stream(settings.REDIS_EVENTS_STREAM)
            stream_length = int(xinfo.get("length", 0))
            stream_last_generated_id = xinfo.get("last-generated-id")
        except Exception:
            stream_length = 0
            stream_last_generated_id = None
        try:
            groups = await redis.xinfo_groups(settings.REDIS_EVENTS_STREAM)
            stream_groups = len(groups or [])
            for g in groups or []:
                stream_group_details.append(
                    {
                        "name": g.get("name"),
                        "consumers": int(g.get("consumers", 0)),
                        "pending": int(g.get("pending", 0)),
                        "lag": int(g.get("lag", 0)) if g.get("lag") is not None else None,
                        "last_delivered_id": g.get("last-delivered-id"),
                    }
                )
        except Exception:
            stream_groups = 0
    except Exception as exc:
        redis_error = str(exc)

    events_total = (
        await db.execute(text("SELECT COUNT(*) FROM notification_events"))
    ).scalar() or 0
    events_published = (
        await db.execute(text("SELECT COUNT(*) FROM notification_events WHERE published_to_stream = true"))
    ).scalar() or 0
    deliveries_pending = (
        await db.execute(select(func.count(NotificationDelivery.id)).where(NotificationDelivery.status == "pending"))
    ).scalar() or 0
    deliveries_failed = (
        await db.execute(select(func.count(NotificationDelivery.id)).where(NotificationDelivery.status == "failed"))
    ).scalar() or 0
    deliveries_sent = (
        await db.execute(select(func.count(NotificationDelivery.id)).where(NotificationDelivery.status == "sent"))
    ).scalar() or 0

    return RedisMonitorResponse(
        redis_ok=redis_ok,
        redis_error=redis_error,
        redis_url=settings.REDIS_URL,
        stream_name=settings.REDIS_EVENTS_STREAM,
        stream_length=stream_length,
        stream_last_generated_id=stream_last_generated_id,
        stream_groups=stream_groups,
        events_total=int(events_total),
        events_published=int(events_published),
        deliveries_pending=int(deliveries_pending),
        deliveries_failed=int(deliveries_failed),
        deliveries_sent=int(deliveries_sent),
        stream_group_details=stream_group_details,
    )


@router.post("/notifications/run-deliveries", response_model=DeliveryRunResponse)
async def admin_run_deliveries(
    limit: int = Query(default=500, ge=1, le=5000),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_admin),
):
    result = await run_pending_deliveries(db, limit=limit)
    await db.commit()
    return DeliveryRunResponse(ok=True, **result)


@router.post("/notifications/run-retention", response_model=RetentionRunResponse)
async def admin_run_retention(
    days: int = Query(default=None, ge=1, le=3650),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_admin),
):
    retention_days = int(days or get_settings().NOTIFICATIONS_RETENTION_DAYS)
    result = await run_notification_retention(db, days=retention_days)
    await db.commit()
    return RetentionRunResponse(ok=True, days=retention_days, **result)


@router.get("/notifications/failed-deliveries", response_model=List[FailedDeliveryRow])
async def admin_failed_deliveries(
    limit: int = Query(default=20, ge=1, le=500),
    channel: str = Query(default="", description="Filter by channel"),
    q: str = Query(default="", description="Search in title/error"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_admin),
):
    stmt = (
        select(NotificationDelivery, Notification)
        .join(Notification, Notification.id == NotificationDelivery.notification_id, isouter=True)
        .where(NotificationDelivery.status == "failed")
    )
    if channel:
        stmt = stmt.where(NotificationDelivery.channel == channel)
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(func.coalesce(NotificationDelivery.last_error, "")).like(like),
                func.lower(func.coalesce(Notification.title, "")).like(like),
            )
        )
    rows = (await db.execute(stmt.order_by(NotificationDelivery.updated_at.desc()).limit(limit))).all()
    result: List[FailedDeliveryRow] = []
    for d, n in rows:
        result.append(
            FailedDeliveryRow(
                id=d.id,
                notification_id=d.notification_id,
                channel=d.channel,
                attempts=d.attempts or "0",
                last_error=d.last_error,
                updated_at=d.updated_at.isoformat() if d.updated_at else None,
                notification_title=(n.title if n else None),
                recipient_id=(n.recipient_id if n else None),
            )
        )
    return result


@router.post("/notifications/requeue-failed", response_model=RequeueFailedResponse)
async def admin_requeue_failed(
    limit: int = Query(default=200, ge=1, le=5000),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_admin),
):
    rows = (
        await db.execute(
            select(NotificationDelivery)
            .where(NotificationDelivery.status == "failed")
            .order_by(NotificationDelivery.updated_at.desc())
            .limit(limit)
        )
    ).scalars().all()
    for d in rows:
        d.status = "pending"
        d.attempts = "0"
        d.last_error = None
        d.next_attempt_at = None
    await db.commit()
    return RequeueFailedResponse(ok=True, requeued=len(rows))


@router.post("/notifications/requeue-failed/{delivery_id}", response_model=RequeueFailedResponse)
async def admin_requeue_failed_one(
    delivery_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_admin),
):
    d = await db.get(NotificationDelivery, delivery_id)
    if not d or d.status != "failed":
        return RequeueFailedResponse(ok=True, requeued=0)
    d.status = "pending"
    d.attempts = "0"
    d.last_error = None
    d.next_attempt_at = None
    await db.commit()
    return RequeueFailedResponse(ok=True, requeued=1)
