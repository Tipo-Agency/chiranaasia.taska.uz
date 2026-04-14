"""Sentry, Prometheus, structlog (фаза F)."""
from __future__ import annotations

import logging
import sys
import time
from typing import Any

import structlog
from fastapi import FastAPI, HTTPException
from prometheus_client import CONTENT_TYPE_LATEST, REGISTRY, Counter, Gauge, Histogram, generate_latest
from sqlalchemy import func, select
from starlette.requests import Request
from starlette.responses import Response

from app.core.config import get_settings
from app.core.redis import get_redis_client
from app.db.session import AsyncSessionLocal
from app.models.dead_letter_queue import DeadLetterQueue
from app.models.notification import NotificationDelivery
from app.models.settings import InboxMessage

HTTP_REQUESTS = Counter(
    "http_requests_total",
    "HTTP запросы",
    ["method", "status"],
)
HTTP_LATENCY = Histogram(
    "http_request_duration_seconds",
    "Длительность HTTP-запроса",
    ["method"],
    buckets=(0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0),
)

# См. docs/ARCHITECTURE.md §10.3, docs/QUEUES.md — обновляется на каждом scrape /metrics.
QUEUE_DEPTH = Gauge(
    "queue_depth",
    "Длина Redis Stream (XLEN) для очередей из настроек",
    ["queue_name"],
)

INBOX_MESSAGES_COUNT = Gauge(
    "inbox_messages_count",
    "Количество записей inbox (таблица InboxMessage)",
)

NOTIFICATION_DELIVERIES_DEAD_COUNT = Gauge(
    "notification_deliveries_dead_count",
    "Доставки уведомлений в статусе dead",
)

DLQ_UNRESOLVED_COUNT = Gauge(
    "dlq_unresolved_count",
    "Нерешённые записи dead letter queue",
)

_structlog_done = False
_sentry_initialized = False

_SENSITIVE_KEY_FRAGMENTS = (
    "password",
    "passwd",
    "secret",
    "token",
    "authorization",
    "cookie",
    "csrf",
    "refresh_token",
    "access_token",
    "api_key",
    "apikey",
    "bearer",
    "private_key",
)


def _key_looks_sensitive(key: str) -> bool:
    k = str(key).lower().replace("-", "_")
    return any(fragment in k for fragment in _SENSITIVE_KEY_FRAGMENTS)


def _redact_mapping(obj: Any, depth: int = 0) -> Any:
    if depth > 10:
        return obj
    if isinstance(obj, dict):
        out: dict[Any, Any] = {}
        for k, v in obj.items():
            if _key_looks_sensitive(str(k)):
                out[k] = "***"
            else:
                out[k] = _redact_mapping(v, depth + 1)
        return out
    if isinstance(obj, list):
        return [_redact_mapping(x, depth + 1) for x in obj[:500]]
    return obj


def _redact_sensitive_processor(_logger: Any, _method: str, event_dict: dict[str, Any]) -> dict[str, Any]:
    return _redact_mapping(event_dict)


def _configure_structlog() -> None:
    global _structlog_done
    if _structlog_done:
        return
    settings = get_settings()
    env = (settings.ENVIRONMENT or "").strip().lower()
    use_json = env in ("production", "prod", "staging")
    processors: list[Any] = [
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso", utc=True, key="timestamp"),
        _redact_sensitive_processor,
    ]
    processors.append(structlog.processors.JSONRenderer() if use_json else structlog.dev.ConsoleRenderer())
    structlog.configure(
        processors=processors,
        wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(file=sys.stderr),
        cache_logger_on_first_use=True,
    )
    _structlog_done = True


def setup_observability(app: FastAPI) -> None:
    """Идемпотентно для данного экземпляра ``app``."""
    _configure_structlog()
    slog = structlog.get_logger("taska.boot")
    if getattr(app.state, "observability_setup", False):
        return
    app.state.observability_setup = True

    settings = get_settings()
    global _sentry_initialized
    dsn = (settings.SENTRY_DSN or "").strip()
    if dsn and not _sentry_initialized:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.starlette import StarletteIntegration

        sentry_sdk.init(
            dsn=dsn,
            integrations=[StarletteIntegration(), FastApiIntegration()],
            traces_sample_rate=0.1,
            environment=settings.ENVIRONMENT,
        )
        _sentry_initialized = True
        slog.info("sentry_enabled", environment=settings.ENVIRONMENT)
    elif not dsn:
        slog.info("sentry_disabled")

    async def _refresh_queue_depth_metrics() -> None:
        cfg = get_settings()
        pairs: tuple[tuple[str, str], ...] = (
            ("domain_events", cfg.REDIS_EVENTS_STREAM),
            ("integrations", cfg.REDIS_INTEGRATIONS_STREAM),
            ("notifications", cfg.REDIS_NOTIFICATIONS_STREAM),
        )
        client = await get_redis_client()
        for logical, stream_key in pairs:
            length = 0
            if client is not None:
                try:
                    info = await client.xinfo_stream(stream_key)
                    length = int(info.get("length", 0))
                except Exception:
                    length = 0
            QUEUE_DEPTH.labels(queue_name=logical).set(length)

    async def _refresh_db_backlog_metrics() -> None:
        try:
            async with AsyncSessionLocal() as session:
                inbox_n = (
                    await session.execute(select(func.count()).select_from(InboxMessage))
                ).scalar_one()
                failed_n = (
                    await session.execute(
                        select(func.count())
                        .select_from(NotificationDelivery)
                        .where(NotificationDelivery.status == "dead")
                    )
                ).scalar_one()
                dlq_n = (
                    await session.execute(
                        select(func.count())
                        .select_from(DeadLetterQueue)
                        .where(DeadLetterQueue.resolved.is_(False))
                    )
                ).scalar_one()
            INBOX_MESSAGES_COUNT.set(int(inbox_n or 0))
            NOTIFICATION_DELIVERIES_DEAD_COUNT.set(int(failed_n or 0))
            DLQ_UNRESOLVED_COUNT.set(int(dlq_n or 0))
        except Exception:
            logging.getLogger(__name__).warning(
                "db backlog metrics refresh failed", exc_info=True
            )

    @app.middleware("http")
    async def _prometheus_middleware(request: Request, call_next):
        if request.url.path == "/metrics":
            return await call_next(request)
        t0 = time.perf_counter()
        response = await call_next(request)
        elapsed = time.perf_counter() - t0
        method = request.method
        status = str(response.status_code)
        HTTP_REQUESTS.labels(method=method, status=status).inc()
        HTTP_LATENCY.labels(method=method).observe(elapsed)
        return response

    @app.get("/metrics", include_in_schema=False)
    async def prometheus_metrics(request: Request) -> Response:
        tok = (settings.PROMETHEUS_SCRAPE_TOKEN or "").strip()
        if tok:
            auth = request.headers.get("authorization") or ""
            if auth != f"Bearer {tok}":
                raise HTTPException(status_code=403, detail="forbidden")
        else:
            host = request.client.host if request.client else ""
            if host not in ("127.0.0.1", "::1"):
                raise HTTPException(status_code=403, detail="metrics_localhost_only_set_PROMETHEUS_SCRAPE_TOKEN")
        await _refresh_queue_depth_metrics()
        await _refresh_db_backlog_metrics()
        data = generate_latest(REGISTRY)
        return Response(content=data, media_type=CONTENT_TYPE_LATEST)

    slog.info("prometheus_metrics_mount", path="/metrics")
