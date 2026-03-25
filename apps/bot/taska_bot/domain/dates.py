"""Даты и календарь (Ташкент)."""
from __future__ import annotations

from datetime import datetime, timedelta

import pytz


def get_week_range(timezone: str = "Asia/Tashkent") -> tuple[str, str]:
    tz = pytz.timezone(timezone)
    today = datetime.now(tz).date()
    monday = today - timedelta(days=today.weekday())
    sunday = monday + timedelta(days=6)
    return monday.isoformat(), sunday.isoformat()


def format_date_short(date_str: str, fmt: str = "%d.%m") -> str:
    try:
        date_obj = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        return date_obj.strftime(fmt)
    except Exception:
        return date_str
