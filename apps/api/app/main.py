"""FastAPI application entry point."""
import asyncio
import logging
import os
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.database import AsyncSessionLocal
from app.logging_handlers import SystemLogHandler
from app.routers import (
    accounts_receivable,
    activity,
    admin,
    auth,
    automation,
    bpm,
    clients,
    content_posts,
    deals,
    departments,
    docs,
    employees,
    finance,
    folders,
    funnels,
    inventory,
    meetings,
    messages,
    notification_events,
    notification_prefs,
    notifications,
    priorities,
    projects,
    statuses,
    system,
    tables,
    tasks,
    weekly_plans,
)
from app.services.notification_delivery import run_pending_deliveries
from app.services.notification_retention import run_notification_retention

settings = get_settings()

# Send ERROR/CRITICAL to system_logs and Telegram (if configured)
_root_logger = logging.getLogger()
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
        print(f"Migration warning: {e}", file=sys.stderr)

    stop_flag = {"stop": False}

    async def _delivery_loop():
        while not stop_flag["stop"]:
            try:
                async with AsyncSessionLocal() as session:
                    await run_pending_deliveries(session, limit=200)
                    await session.commit()
            except Exception as ex:
                logging.getLogger("uvicorn.error").warning("Delivery loop error: %s", ex)
            await asyncio.sleep(5)

    async def _retention_loop():
        while not stop_flag["stop"]:
            try:
                async with AsyncSessionLocal() as session:
                    await run_notification_retention(
                        session,
                        days=settings.NOTIFICATIONS_RETENTION_DAYS,
                    )
                    await session.commit()
            except Exception as ex:
                logging.getLogger("uvicorn.error").warning("Retention loop error: %s", ex)
            await asyncio.sleep(max(60, settings.NOTIFICATIONS_RETENTION_INTERVAL_SECONDS))

    delivery_task = asyncio.create_task(_delivery_loop())
    retention_task = asyncio.create_task(_retention_loop())
    yield
    stop_flag["stop"] = True
    delivery_task.cancel()
    retention_task.cancel()
    try:
        await delivery_task
    except Exception:
        pass
    try:
        await retention_task
    except Exception:
        pass


app = FastAPI(
    title="Taska API",
    description="Backend API for Taska CRM/Task Manager",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers (prefix already in router)
app.include_router(admin.router, prefix=settings.API_PREFIX)
app.include_router(auth.router, prefix=settings.API_PREFIX)
app.include_router(system.router, prefix=settings.API_PREFIX)
app.include_router(tasks.router, prefix=settings.API_PREFIX)
app.include_router(projects.router, prefix=settings.API_PREFIX, tags=["projects"])
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
app.include_router(content_posts.router, prefix=settings.API_PREFIX, tags=["content-posts"])
app.include_router(departments.router, prefix=settings.API_PREFIX, tags=["departments"])
app.include_router(finance.router, prefix=settings.API_PREFIX, tags=["finance"])
app.include_router(bpm.router, prefix=settings.API_PREFIX, tags=["bpm"])
app.include_router(inventory.router, prefix=settings.API_PREFIX, tags=["inventory"])
app.include_router(funnels.router, prefix=settings.API_PREFIX, tags=["funnels"])
app.include_router(weekly_plans.router, prefix=settings.API_PREFIX, tags=["weekly-plans"])


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Log unhandled exceptions to system_logs and optionally Telegram."""
    import traceback
    traceback.print_exc()
    logging.getLogger("uvicorn.error").critical(
        "Unhandled exception: %s", exc, exc_info=True, extra={"path": request.url.path}
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


@app.get("/health")
async def health():
    """Health check: basic + DB ping. Used by monitoring and after deploy."""
    from sqlalchemy import text
    payload = {"status": "ok", "version": "1.0.0"}
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        payload["db"] = "ok"
    except Exception as e:
        payload["db"] = "error"
        payload["db_error"] = str(e)
    return payload


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
