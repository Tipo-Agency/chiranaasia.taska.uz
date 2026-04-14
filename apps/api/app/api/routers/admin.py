"""Admin-only API: DB browser, health, stats, logs, audit_logs, tests, Telegram bot. RBAC: ``admin.system`` (``get_current_user_admin``)."""
from __future__ import annotations

import asyncio
import os
import subprocess
import urllib.parse
import urllib.request
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, RootModel
from redis.asyncio import Redis
from sqlalchemy import func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routers.system import (
    AuditLogEntry,
    SystemLogEntry,
    fetch_audit_log_entries,
    fetch_system_log_entries,
)
from app.core.auth import get_current_user_admin
from app.core.config import get_settings
from app.core.redis import get_redis, get_redis_client
from app.db import Base, get_db
from app.models.dead_letter_queue import DeadLetterQueue
from app.models.notification import Notification, NotificationDelivery
from app.models.notification import NotificationPreferences as NPrefModel
from app.models.settings import InboxMessage
from app.services.dlq_service import list_dlq_rows, requeue_dlq_row, resolve_dlq_row
from app.services.notification_delivery import enqueue_due_notification_delivery_jobs
from app.services.notification_retention import run_notification_retention
from app.services.notifications_stream import ensure_notifications_stream

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(get_current_user_admin)])


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


def _allowed_tables() -> list[str]:
    """Table names from ORM (whitelist for read-only browser)."""
    return list(Base.metadata.tables.keys())


# --- Response models ---


class TableInfo(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    row_count: int | None = None


class AdminTableRow(RootModel[dict[str, Any]]):
    """
    Строка произвольной таблицы БД: ключи — имена колонок (зависят от таблицы).
    Обёртка над dict для строгого элемента списка ``rows`` в OpenAPI.
    """

    root: dict[str, Any]


class TableRowsResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    table: str
    columns: list[str]
    rows: list[AdminTableRow]
    total: int | None = None
    offset: int
    limit: int


class HealthResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: str
    version: str
    db: str
    db_error: str | None = None


class TableStatsRow(BaseModel):
    model_config = ConfigDict(extra="forbid")

    table_name: str
    row_count: int


class AdminStatsResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tables: list[TableStatsRow]
    db_size_mb: float | None = None


class QueueMetricsResponse(BaseModel):
    """Счётчики для мониторинга очередей и мёртвых доставок."""

    model_config = ConfigDict(extra="forbid")

    inbox_messages_count: int
    failed_deliveries_count: int
    dlq_unresolved_count: int


class TestRunResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ok: bool
    output: str
    exit_code: int


class BotStatusResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    telegram_configured: bool
    group_chat_id: str | None = None
    group_chat_id_set: bool


class BotSendTestResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ok: bool
    error: str | None = None


class RedisStreamGroupDetail(BaseModel):
    """Элемент ``XINFO GROUPS`` для стрима событий (redis-py)."""

    model_config = ConfigDict(extra="forbid")

    name: str | None = None
    consumers: int = 0
    pending: int = 0
    lag: int | None = None
    last_delivered_id: str | None = None


class RedisMonitorResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    redis_ok: bool
    redis_error: str | None = None
    redis_url: str
    stream_name: str
    stream_length: int | None = None
    stream_last_generated_id: str | None = None
    stream_groups: int | None = None
    events_total: int
    events_published: int
    deliveries_pending: int
    deliveries_failed: int
    deliveries_sent: int
    stream_group_details: list[RedisStreamGroupDetail] | None = None


class DeliveryRunResponse(BaseModel):
    ok: bool
    queued: int


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
    recipient: str | None = None
    attempts: int
    last_error: str | None = None
    notification_title: str | None = None
    user_id: str | None = None


class RequeueFailedResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ok: bool
    requeued: int


class DlqRowResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    queue_name: str
    payload: dict[str, Any]
    error: str | None
    created_at: str
    resolved: bool


class DlqActionResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ok: bool
    message: str | None = None


def _redis_info_str(v: object) -> str | None:
    if v is None:
        return None
    if isinstance(v, bytes | bytearray):
        return bytes(v).decode("utf-8", errors="replace")
    s = str(v).strip()
    return s if s else None


def _redis_info_int(v: object, default: int = 0) -> int:
    if v is None:
        return default
    if isinstance(v, bytes | bytearray):
        try:
            return int(bytes(v).decode("utf-8", errors="replace").strip() or "0")
        except ValueError:
            return default
    try:
        return int(str(v).strip() or "0")
    except ValueError:
        return default


def _redis_info_int_optional(v: object) -> int | None:
    if v is None:
        return None
    if isinstance(v, bytes | bytearray):
        s = bytes(v).decode("utf-8", errors="replace").strip()
        if not s:
            return None
        try:
            return int(s)
        except ValueError:
            return None
    try:
        return int(str(v).strip())
    except ValueError:
        return None


# --- Endpoints ---


@router.get(
    "/logs",
    response_model=list[SystemLogEntry],
    summary="Системные логи",
    description=(
        "Чтение `system_logs`. **Только** право RBAC `admin.system` через ``Depends(get_current_user_admin)`` "
        "(JWT в HttpOnly cookie; при AUTH_ALLOW_BEARER_HEADER — Bearer). "
        "Без валидной сессии — 401, без права — 403. Legacy: `GET /api/system/logs` (deprecated)."
    ),
    responses={
        401: {"description": "Нет или просрочен JWT"},
        403: {"description": "Нет права `admin.system`"},
    },
)
async def get_admin_logs(
    limit: int = Query(50, ge=1, le=200),
    level: str | None = Query(None, description="Filter by level: ERROR, CRITICAL, WARNING"),
    db: AsyncSession = Depends(get_db),
):
    """Канонический путь для логов; доступ через ``get_current_user_admin`` → ``admin.system``."""
    return await fetch_system_log_entries(db, limit, level)


@router.get(
    "/audit-logs",
    response_model=list[AuditLogEntry],
    summary="Журнал audit_logs",
    description=(
        "Чтение ``audit_logs`` (те же фильтры, что и у ``GET /api/system/audit``). "
        "``Depends(get_current_user_admin)`` на уровне роутера."
    ),
    responses={
        401: {"description": "Нет или просрочен JWT"},
        403: {"description": "Нет права `admin.system`"},
    },
)
async def get_admin_audit_logs(
    limit: int = Query(50, ge=1, le=500),
    entity_type: str | None = Query(None),
    entity_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    return await fetch_audit_log_entries(db, limit, entity_type, entity_id)


@router.get("/tables", response_model=list[TableInfo])
async def list_tables(
    db: AsyncSession = Depends(get_db),
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
    rows: list[AdminTableRow] = []
    for row in rows_raw:
        d = dict(row)
        for k, v in d.items():
            if hasattr(v, "isoformat"):
                d[k] = v.isoformat()
        rows.append(AdminTableRow(d))
    return TableRowsResponse(
        table=table_name,
        columns=columns,
        rows=rows,
        total=total,
        offset=offset,
        limit=limit,
    )


@router.get("/health", response_model=HealthResponse)
async def admin_health(
    db: AsyncSession = Depends(get_db),
):
    """Health с деталями: версия, `db`, при сбое — `db_error`. Только JWT + `admin.system`. Публичный минимальный — `GET /health`."""
    payload: dict = {"status": "ok", "version": "1.0.0", "db": "ok", "db_error": None}
    try:
        await db.execute(text("SELECT 1"))
    except Exception as e:
        payload["db"] = "error"
        payload["db_error"] = str(e)
    return HealthResponse(**payload)


@router.get("/stats", response_model=AdminStatsResponse)
async def admin_stats(
    db: AsyncSession = Depends(get_db),
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


@router.get("/metrics/queues", response_model=QueueMetricsResponse)
async def admin_queue_metrics(
    db: AsyncSession = Depends(get_db),
):
    """
    Метрики: сообщения inbox, доставки в статусе ``dead``, нерешённые записи DLQ.
    Требует право ``admin.system`` (как остальная админка).
    """
    inbox_n = (
        await db.execute(select(func.count()).select_from(InboxMessage))
    ).scalar_one()
    failed_n = (
        await db.execute(
            select(func.count()).select_from(NotificationDelivery).where(NotificationDelivery.status == "dead")
        )
    ).scalar_one()
    dlq_n = (
        await db.execute(
            select(func.count()).select_from(DeadLetterQueue).where(DeadLetterQueue.resolved.is_(False))
        )
    ).scalar_one()
    return QueueMetricsResponse(
        inbox_messages_count=int(inbox_n or 0),
        failed_deliveries_count=int(failed_n or 0),
        dlq_unresolved_count=int(dlq_n or 0),
    )


@router.get("/dlq/rows", response_model=list[DlqRowResponse])
async def admin_dlq_list(
    unresolved_only: bool = Query(default=True),
    limit: int = Query(default=50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    rows = await list_dlq_rows(db, unresolved_only=unresolved_only, limit=limit)
    out: list[DlqRowResponse] = []
    for r in rows:
        pl = r.payload if isinstance(r.payload, dict) else {}
        out.append(
            DlqRowResponse(
                id=r.id,
                queue_name=r.queue_name,
                payload=pl,
                error=r.error,
                created_at=r.created_at.isoformat() if r.created_at else "",
                resolved=bool(r.resolved),
            )
        )
    return out


@router.post("/dlq/{row_id}/resolve", response_model=DlqActionResponse)
async def admin_dlq_resolve(
    row_id: str,
    db: AsyncSession = Depends(get_db),
):
    if not await resolve_dlq_row(db, row_id):
        raise HTTPException(status_code=404, detail="dlq_not_found")
    await db.commit()
    return DlqActionResponse(ok=True, message="resolved")


@router.post("/dlq/{row_id}/requeue", response_model=DlqActionResponse)
async def admin_dlq_requeue(
    row_id: str,
    db: AsyncSession = Depends(get_db),
):
    redis = await get_redis_client()
    if not redis:
        raise HTTPException(status_code=503, detail="redis_unavailable")
    ok, msg = await requeue_dlq_row(db, redis, row_id)
    await db.commit()
    return DlqActionResponse(ok=ok, message=msg)


@router.post("/tests/run", response_model=TestRunResponse)
async def run_tests():
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
    redis: Redis | None = Depends(get_redis),
):
    settings = get_settings()
    redis_ok = False
    redis_error = None
    stream_length = None
    stream_last_generated_id = None
    stream_groups = None
    stream_group_details: list[RedisStreamGroupDetail] = []

    try:
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
                lag_raw = g.get("lag")
                stream_group_details.append(
                    RedisStreamGroupDetail(
                        name=_redis_info_str(g.get("name")),
                        consumers=_redis_info_int(g.get("consumers")),
                        pending=_redis_info_int(g.get("pending")),
                        lag=_redis_info_int_optional(lag_raw),
                        last_delivered_id=_redis_info_str(g.get("last-delivered-id")),
                    )
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
        await db.execute(
            select(func.count(NotificationDelivery.id)).where(
                NotificationDelivery.status.in_(("pending", "retry", "sending"))
            )
        )
    ).scalar() or 0
    deliveries_failed = (
        await db.execute(select(func.count(NotificationDelivery.id)).where(NotificationDelivery.status == "dead"))
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
):
    redis = await get_redis_client()
    if not redis:
        raise HTTPException(status_code=503, detail="redis_unavailable")
    await ensure_notifications_stream(redis)
    result = await enqueue_due_notification_delivery_jobs(db, redis, limit=limit)
    await db.commit()
    return DeliveryRunResponse(ok=True, queued=result["queued"])


@router.post("/notifications/run-retention", response_model=RetentionRunResponse)
async def admin_run_retention(
    days: int = Query(default=None, ge=1, le=3650),
    db: AsyncSession = Depends(get_db),
):
    retention_days = int(days or get_settings().NOTIFICATIONS_RETENTION_DAYS)
    result = await run_notification_retention(db, days=retention_days)
    await db.commit()
    return RetentionRunResponse(ok=True, days=retention_days, **result)


@router.get("/notifications/failed-deliveries", response_model=list[FailedDeliveryRow])
async def admin_failed_deliveries(
    limit: int = Query(default=20, ge=1, le=500),
    channel: str = Query(default="", description="Filter by channel"),
    q: str = Query(default="", description="Search in title/error"),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(NotificationDelivery, Notification)
        .join(Notification, Notification.id == NotificationDelivery.notification_id, isouter=True)
        .where(NotificationDelivery.status == "dead")
    )
    if channel:
        stmt = stmt.where(NotificationDelivery.channel == channel)
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(func.coalesce(NotificationDelivery.last_error, "")).like(like),
                func.lower(func.coalesce(NotificationDelivery.recipient, "")).like(like),
                func.lower(func.coalesce(Notification.title, "")).like(like),
            )
        )
    rows = (await db.execute(stmt.order_by(NotificationDelivery.id.desc()).limit(limit))).all()
    result: list[FailedDeliveryRow] = []
    for d, n in rows:
        result.append(
            FailedDeliveryRow(
                id=d.id,
                notification_id=d.notification_id,
                channel=d.channel,
                recipient=d.recipient or None,
                attempts=int(d.attempts or 0),
                last_error=d.last_error,
                notification_title=(n.title if n else None),
                user_id=(n.user_id if n else None),
            )
        )
    return result


@router.post("/notifications/requeue-failed", response_model=RequeueFailedResponse)
async def admin_requeue_failed(
    limit: int = Query(default=200, ge=1, le=5000),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(
            select(NotificationDelivery)
            .where(NotificationDelivery.status == "dead")
            .order_by(NotificationDelivery.id.desc())
            .limit(limit)
        )
    ).scalars().all()
    for d in rows:
        d.status = "pending"
        d.attempts = 0
        d.last_error = None
        d.next_retry_at = None
    await db.commit()
    return RequeueFailedResponse(ok=True, requeued=len(rows))


@router.post("/notifications/requeue-failed/{delivery_id}", response_model=RequeueFailedResponse)
async def admin_requeue_failed_one(
    delivery_id: str,
    db: AsyncSession = Depends(get_db),
):
    d = await db.get(NotificationDelivery, delivery_id)
    if not d or d.status != "dead":
        return RequeueFailedResponse(ok=True, requeued=0)
    d.status = "pending"
    d.attempts = 0
    d.last_error = None
    d.next_retry_at = None
    await db.commit()
    return RequeueFailedResponse(ok=True, requeued=1)
