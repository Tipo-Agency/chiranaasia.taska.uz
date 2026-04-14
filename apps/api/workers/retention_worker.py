"""
Периодическая очистка уведомлений по retention (вынесено из lifespan API).

Запуск из ``apps/api``::

    python -m workers.retention_worker

Переменные: ``DATABASE_URL``, ``NOTIFICATIONS_RETENTION_DAYS``, ``NOTIFICATIONS_RETENTION_INTERVAL_SECONDS``.
"""
from __future__ import annotations

import asyncio
import logging
import sys

from app.core.config import get_settings
from app.db import AsyncSessionLocal
from app.services.notification_retention import run_notification_retention
from app.services.worker_error_policy import classify_worker_exception, log_worker_exception

log = logging.getLogger("uvicorn.error")


async def _loop() -> None:
    settings = get_settings()
    interval = max(60, int(settings.NOTIFICATIONS_RETENTION_INTERVAL_SECONDS or 3600))
    days = int(settings.NOTIFICATIONS_RETENTION_DAYS or 90)
    log.info("retention_worker: interval=%ss retention_days=%s", interval, days)
    while True:
        try:
            async with AsyncSessionLocal() as session:
                await run_notification_retention(session, days=days)
                await session.commit()
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            kind = classify_worker_exception(exc)
            log_worker_exception(
                worker="retention_worker",
                msg_id=None,
                exc=exc,
                kind=kind,
            )
        await asyncio.sleep(interval)


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(levelname)s %(name)s: %(message)s",
        stream=sys.stderr,
    )
    try:
        asyncio.run(_loop())
    except KeyboardInterrupt:
        log.info("retention_worker: interrupted")


if __name__ == "__main__":
    main()
