"""FastAPI application entry point."""
import logging
import os
import sys
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routers import (
    accounts_receivable,
    activity,
    admin,
    auth,
    automation,
    bp,
    bpm,
    calendar_feed,
    clients,
    content_posts,
    deals,
    departments,
    docs,
    employees,
    finance,
    folders,
    funnels,
    integrations_meta,
    integrations_roadmap,
    integrations_site,
    integrations_telegram,
    integrations_telegram_personal,
    inventory,
    meetings,
    messages,
    meta_webhook,
    notification_events,
    notification_prefs,
    notifications,
    priorities,
    projects,
    shoot_plans,
    statuses,
    system,
    tables,
    tasks,
    weekly_plans,
)
from app.core.api_errors import (
    ensure_request_id,
    error_code_for_status,
    error_response,
    first_validation_message,
    http_detail_to_message_and_details,
)
from app.core.config import effective_browser_origin_allowlist, get_settings
from app.core.logging_handlers import RequestIdLogFilter, SystemLogHandler
from app.core.observability import setup_observability
from app.core.rate_limit import limiter
from app.db import get_db
from app.middleware.http_security import (
    AuthCacheControlMiddleware,
    CSRFMiddleware,
    MaxRequestBodyMiddleware,
    RequestIDMiddleware,
    SecurityHeadersMiddleware,
)
from app.middleware.idempotency import IdempotencyMiddleware
from app.schemas.common_responses import PublicHealthResponse

settings = get_settings()

# Send ERROR/CRITICAL to system_logs and Telegram (if configured)
_root_logger = logging.getLogger()
_root_logger.addFilter(RequestIdLogFilter())
_handler = SystemLogHandler()
_handler.setLevel(logging.ERROR)
_root_logger.addHandler(_handler)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run migrations on startup."""
    from alembic import command
    from alembic.config import Config

    server_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    alembic_cfg = Config(os.path.join(server_dir, "alembic.ini"))
    try:
        command.upgrade(alembic_cfg, "head")
    except Exception as e:
        env = (settings.ENVIRONMENT or "").strip().lower()
        if env in ("production", "prod", "staging"):
            print(f"Migration failed (fatal in {env}): {e}", file=sys.stderr)
            raise
        print(f"Migration warning: {e}", file=sys.stderr)

    try:
        from app.core.redis import get_redis_client
        from app.services.domain_events_hub_stream import ensure_domain_events_hub_consumer_group
        from app.services.event_bus import ensure_redis_stream_and_group
        from app.services.integrations_stream import ensure_integrations_stream
        from app.services.notifications_stream import ensure_notifications_stream

        await ensure_redis_stream_and_group()
        r = await get_redis_client()
        if r:
            await ensure_domain_events_hub_consumer_group(r)
            await ensure_integrations_stream(r)
            await ensure_notifications_stream(r)
    except Exception as e:
        print(f"Redis stream init warning: {e}", file=sys.stderr)

    from app.services.notifications_realtime import realtime_hub

    realtime_hub.start_redis_subscriber()

    yield

    try:
        await realtime_hub.stop_redis_subscriber()
    except Exception:
        pass

    from app.core.redis import close_redis

    try:
        await close_redis()
    except Exception:
        pass


app = FastAPI(
    title="Taska API",
    description=(
        "Backend API for Taska CRM / task manager. Публичный контракт — `docs/API.md` в репозитории.\n\n"
        "**Ошибки (JSON):** поля `error`, `message`, опционально `details`, всегда `request_id` "
        "(и заголовок `X-Request-ID`). Реализация: `app.core.api_errors.error_response`, "
        "обработчики в `main.py` для `HTTPException`, Pydantic validation и `429` slowapi.\n\n"
        "**CSRF:** мутирующие запросы к `/api/*` требуют заголовок `X-CSRF-Token`, совпадающий с cookie "
        "`csrf_token`. Исключения без CSRF: `POST /api/auth/login`, `/refresh`, `/logout`, "
        "`POST /api/integrations/site/leads`, вебхуки вне префикса API — см. `CSRFMiddleware`.\n\n"
        "**Rate limit:** slowapi, ключ IP или `user:{sub}` — `docs/API.md` §6; заголовки "
        "`X-RateLimit-*` и `Retry-After` в основном на ответе **429**.\n\n"
        "**Устаревшее:** `GET /api/system/logs` помечен `deprecated` в схеме; канон — `GET /api/admin/logs`."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter


async def _rate_limit_handler(request: Request, exc: RateLimitExceeded):
    msg, details = http_detail_to_message_and_details(exc.detail)
    resp = error_response(
        status_code=429,
        error="rate_limited",
        message=msg or "Слишком много запросов",
        request=request,
        details=details,
    )
    limiter = getattr(request.app.state, "limiter", None)
    vrl = getattr(request.state, "view_rate_limit", None)
    if limiter is not None and vrl is not None:
        resp = limiter._inject_headers(resp, vrl)
    return resp


async def _http_exception_handler(request: Request, exc: HTTPException):
    msg, details = http_detail_to_message_and_details(exc.detail)
    return error_response(
        status_code=exc.status_code,
        error=error_code_for_status(exc.status_code),
        message=msg,
        request=request,
        details=details,
    )


async def _validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    return error_response(
        status_code=422,
        error="validation_error",
        message=first_validation_message(errors),
        request=request,
        details={"errors": errors},
    )


async def _unhandled_exception_handler(request: Request, exc: Exception):
    rid = ensure_request_id(request)
    logging.getLogger("uvicorn.error").critical(
        "Unhandled exception: %s",
        exc,
        exc_info=True,
        extra={"path": request.url.path, "request_id": rid},
    )
    return error_response(
        status_code=500,
        error="internal_error",
        message="Внутренняя ошибка сервера",
        request=request,
    )


app.add_exception_handler(RateLimitExceeded, _rate_limit_handler)
app.add_exception_handler(HTTPException, _http_exception_handler)
app.add_exception_handler(RequestValidationError, _validation_exception_handler)
app.add_exception_handler(Exception, _unhandled_exception_handler)

# CORS: только явные origin из CORS_ORIGINS (wildcard * запрещён в Settings — иначе нельзя безопасно с credentials).
app.add_middleware(
    CORSMiddleware,
    allow_origins=effective_browser_origin_allowlist(settings.CORS_ORIGINS, settings.PUBLIC_BASE_URL),
    allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=[
        "Authorization",
        "Content-Type",
        "X-CSRF-Token",
        "X-Request-ID",
        "X-Api-Key",
        "Accept",
        "Accept-Language",
        "Idempotency-Key",
        "X-Idempotency-Key",
    ],
    expose_headers=["Idempotent-Replayed", "X-Idempotent-Replayed", "X-Request-ID"],
)

app.add_middleware(MaxRequestBodyMiddleware)
app.add_middleware(IdempotencyMiddleware)
# CSRF: POST/PUT/PATCH/DELETE под /api/* (кроме login/refresh, вебхуков, site/leads); вне /api — без изменений (/webhook/meta).
app.add_middleware(CSRFMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(AuthCacheControlMiddleware)
app.add_middleware(SlowAPIMiddleware)
# Внешний слой: request_id и ContextVar до ранних ответов (413, CSRF, …)
app.add_middleware(RequestIDMiddleware)

# Meta webhooks: без /api — URL как в кабинете Meta (например /webhook/meta)
app.include_router(meta_webhook.router)
app.include_router(integrations_meta.router, prefix=settings.API_PREFIX)
app.include_router(integrations_roadmap.router, prefix=settings.API_PREFIX)
app.include_router(integrations_site.router, prefix=settings.API_PREFIX)
app.include_router(integrations_telegram.router, prefix=settings.API_PREFIX)
app.include_router(integrations_telegram_personal.router, prefix=settings.API_PREFIX)

# Routers (prefix already in router)
app.include_router(admin.router, prefix=settings.API_PREFIX)
app.include_router(auth.router, prefix=settings.API_PREFIX)
app.include_router(system.public_router, prefix=settings.API_PREFIX)
app.include_router(system.router, prefix=settings.API_PREFIX)
app.include_router(tasks.router, prefix=settings.API_PREFIX)
app.include_router(projects.router, prefix=settings.API_PREFIX, tags=["projects"])
app.include_router(shoot_plans.router, prefix=settings.API_PREFIX, tags=["shoot-plans"])
app.include_router(tables.public_router, prefix=settings.API_PREFIX, tags=["tables"])
app.include_router(tables.router, prefix=settings.API_PREFIX, tags=["tables"])
app.include_router(activity.router, prefix=settings.API_PREFIX, tags=["activity"])
app.include_router(messages.router, prefix=settings.API_PREFIX, tags=["messages"])
app.include_router(statuses.router, prefix=settings.API_PREFIX, tags=["statuses"])
app.include_router(priorities.router, prefix=settings.API_PREFIX, tags=["priorities"])
app.include_router(notification_prefs.router, prefix=settings.API_PREFIX, tags=["notification-prefs"])
app.include_router(notification_events.router, prefix=settings.API_PREFIX, tags=["notification-events"])
app.include_router(notifications.router, prefix=settings.API_PREFIX, tags=["notifications"])
app.include_router(automation.router, prefix=settings.API_PREFIX, tags=["automation"])
app.include_router(clients.router, prefix=settings.API_PREFIX, tags=["clients"])
app.include_router(deals.router, prefix=settings.API_PREFIX, tags=["deals"])
app.include_router(employees.router, prefix=settings.API_PREFIX, tags=["employees"])
app.include_router(accounts_receivable.router, prefix=settings.API_PREFIX, tags=["accounts-receivable"])
app.include_router(docs.router, prefix=settings.API_PREFIX, tags=["docs"])
app.include_router(folders.router, prefix=settings.API_PREFIX, tags=["folders"])
app.include_router(meetings.router, prefix=settings.API_PREFIX, tags=["meetings"])
app.include_router(calendar_feed.router, prefix=settings.API_PREFIX, tags=["calendar"])
app.include_router(content_posts.router, prefix=settings.API_PREFIX, tags=["content-posts"])
app.include_router(departments.router, prefix=settings.API_PREFIX, tags=["departments"])
app.include_router(finance.router, prefix=settings.API_PREFIX, tags=["finance"])
app.include_router(bp.router, prefix=settings.API_PREFIX, tags=["bp"])
app.include_router(bpm.router, prefix=settings.API_PREFIX, tags=["bpm"])
app.include_router(inventory.router, prefix=settings.API_PREFIX, tags=["inventory"])
app.include_router(funnels.router, prefix=settings.API_PREFIX, tags=["funnels"])
app.include_router(weekly_plans.router, prefix=settings.API_PREFIX, tags=["weekly-plans"])


@app.get(
    "/health",
    response_model=PublicHealthResponse,
    summary="Публичная проверка доступности",
    description=(
        "**Без аутентификации** — намеренно, для nginx, Docker healthcheck и скриптов деплоя. "
        "Проверяется доступность PostgreSQL (`SELECT 1`). "
        "Тело ответа минимальное: поле `status` без версии приложения и без текста ошибок БД/стека "
        "(их не следует отдавать в открытый интернет). "
        "Расширенная диагностика: `GET {API_PREFIX}/admin/health` при праве `admin.system`."
    ).replace("{API_PREFIX}", settings.API_PREFIX or "/api"),
    responses={
        200: {"description": "Процесс отвечает, база данных доступна"},
        503: {
            "description": "База данных недоступна",
            "content": {
                "application/json": {
                    "example": {"status": "unavailable"},
                },
            },
        },
    },
    tags=["health"],
)
async def health(db: AsyncSession = Depends(get_db)):
    from sqlalchemy import text

    try:
        await db.execute(text("SELECT 1"))
    except Exception:
        logging.getLogger("uvicorn.error").exception("GET /health: database check failed")
        return JSONResponse(
            status_code=503,
            content=PublicHealthResponse(status="unavailable").model_dump(),
        )
    return PublicHealthResponse(status="ok")


setup_observability(app)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
