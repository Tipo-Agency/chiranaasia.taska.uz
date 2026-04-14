"""Logging handlers: write errors to system_logs table and optionally send CRITICAL to Telegram."""
from __future__ import annotations

import asyncio
import json
import logging
import urllib.request
from typing import Any

from sqlalchemy import text

from app.core.config import get_settings
from app.core.request_context import get_request_id
from app.db import engine


class RequestIdLogFilter(logging.Filter):
    """Подмешивает request_id из ContextVar в LogRecord (system_logs, консоль с форматтером)."""

    def filter(self, record: logging.LogRecord) -> bool:
        if getattr(record, "request_id", None):
            return True
        rid = get_request_id()
        if rid:
            record.request_id = rid
        return True


async def write_system_log_async(
    level: str,
    message: str,
    logger_name: str | None = None,
    path: str | None = None,
    request_id: str | None = None,
    payload: Any | None = None,
) -> None:
    """Write a log row to system_logs using the shared async engine."""
    try:
        payload_str = json.dumps(payload, ensure_ascii=False) if payload is not None else None
        async with engine.begin() as conn:
            await conn.execute(
                text("""
                    INSERT INTO system_logs (level, message, logger_name, path, request_id, payload)
                    VALUES (:level, :message, :logger_name, :path, :request_id, :payload)
                """),
                {
                    "level": level,
                    "message": message[:10000] if len(message) > 10000 else message,
                    "logger_name": logger_name[:255] if logger_name else None,
                    "path": path[:500] if path else None,
                    "request_id": request_id,
                    "payload": payload_str[:10000] if payload_str else None,
                },
            )
    except Exception as e:
        logging.getLogger(__name__).warning("Failed to write system_log: %s", e)


def _schedule_system_log(
    level: str,
    message: str,
    logger_name: str | None = None,
    path: str | None = None,
    request_id: str | None = None,
    payload: Any | None = None,
) -> None:
    """Schedule async DB write from sync logging (emit). No-op if no running event loop."""
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return
    loop.create_task(
        write_system_log_async(
            level=level,
            message=message,
            logger_name=logger_name,
            path=path,
            request_id=request_id,
            payload=payload,
        )
    )


def send_telegram_alert(text: str) -> None:
    """Send a message to Telegram chat (sync). Used for CRITICAL alerts."""
    s = get_settings()
    if not s.TELEGRAM_EMPLOYEE_BOT_TOKEN or not s.TELEGRAM_ALERT_CHAT_ID:
        return
    try:
        url = f"https://api.telegram.org/bot{s.TELEGRAM_EMPLOYEE_BOT_TOKEN}/sendMessage"
        data = json.dumps({"chat_id": s.TELEGRAM_ALERT_CHAT_ID, "text": text[:4000], "disable_web_page_preview": True}).encode("utf-8")
        req = urllib.request.Request(url, data=data, method="POST", headers={"Content-Type": "application/json"})
        urllib.request.urlopen(req, timeout=5)
    except Exception as e:
        logging.getLogger(__name__).warning("Failed to send Telegram alert: %s", e)


class SystemLogHandler(logging.Handler):
    """Writes ERROR/CRITICAL to system_logs and sends CRITICAL to Telegram if configured."""

    def emit(self, record: logging.LogRecord) -> None:
        try:
            level = record.levelname
            if level not in ("ERROR", "CRITICAL", "WARNING"):
                return
            message = self.format(record)
            path = getattr(record, "path", None) or getattr(record, "request_path", None)
            request_id = getattr(record, "request_id", None)
            payload = {"exc_info": record.exc_text} if record.exc_info else None
            _schedule_system_log(
                level=level,
                message=message,
                logger_name=record.name,
                path=path,
                request_id=request_id,
                payload=payload,
            )
            if level == "CRITICAL":
                send_telegram_alert(f"[Типа задачи] CRITICAL: {message[:500]}")
        except Exception as e:
            logging.getLogger(__name__).warning("SystemLogHandler emit failed: %s", e)
