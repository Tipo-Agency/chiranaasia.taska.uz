"""Валидация даты/времени встречи и нормализация участников (JSONB)."""

from __future__ import annotations

import re
from datetime import datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from fastapi import HTTPException

from app.core.config import get_settings

# Допуск на рассинхрон часов клиента/сети при запрете «встреча в прошлом».
MEETING_PAST_GRACE = timedelta(minutes=2)


def parse_meeting_wall_clock(
    date_s: str,
    time_s: str,
    tz_name: str | None = None,
) -> tuple[datetime, datetime] | None:
    """
    date_s: YYYY-MM-DD, time_s: HH:mm — как в CRM.
    Возвращает (start_local, end_local) в tz или None при невалидной календарной дате.
    """
    d = (date_s or "").strip()[:10]
    if len(d) < 10 or not re.match(r"^\d{4}-\d{2}-\d{2}$", d):
        return None
    raw_t = (time_s or "09:00").strip()
    parts = raw_t.replace(".", ":").split(":")
    try:
        h = int(parts[0])
        mi = int(parts[1]) if len(parts) > 1 else 0
    except (ValueError, IndexError):
        h, mi = 9, 0
    h = max(0, min(23, h))
    mi = max(0, min(59, mi))
    tzid = tz_name or get_settings().CALENDAR_EXPORT_TZID
    try:
        tz = ZoneInfo(tzid)
    except Exception:
        tz = ZoneInfo("Asia/Tashkent")
    y, mo, da = int(d[0:4]), int(d[5:7]), int(d[8:10])
    try:
        start_local = datetime(y, mo, da, h, mi, 0, tzinfo=tz)
    except ValueError:
        return None
    end_local = start_local + timedelta(hours=1)
    return (start_local, end_local)


def assert_valid_meeting_datetime(date_str: str, time_str: str) -> None:
    """HTTP 422, если дата не YYYY-MM-DD или день несуществующий (например 2025-02-30)."""
    if parse_meeting_wall_clock(date_str, time_str) is None:
        raise HTTPException(
            status_code=422,
            detail="Некорректная дата или время встречи (ожидается date YYYY-MM-DD и time HH:mm)",
        )


def meeting_wall_start_unchanged(
    row_date: str | None,
    row_time: str | None,
    merged_date: str,
    merged_time: str,
) -> bool:
    """Тот же момент начала (дата+время в TZ календаря), что и у существующей строки."""
    old = parse_meeting_wall_clock(str(row_date or ""), str(row_time or ""))
    new = parse_meeting_wall_clock(merged_date, merged_time)
    if old is None or new is None:
        return False
    return old[0] == new[0]


def assert_meeting_start_not_in_past(date_str: str, time_str: str) -> None:
    """
    HTTP 422, если начало встречи в прошлом (в CALENDAR_EXPORT_TZID).
    Вызывать после assert_valid_meeting_datetime.
    """
    parsed = parse_meeting_wall_clock(date_str, time_str)
    if parsed is None:
        return
    start_local, _ = parsed
    tz = start_local.tzinfo
    if tz is None:
        return
    now_local = datetime.now(tz)
    if start_local < now_local - MEETING_PAST_GRACE:
        raise HTTPException(
            status_code=422,
            detail="Время начала встречи не может быть в прошлом",
        )


def participant_user_ids_from_row(row: Any) -> list[str]:
    """ID участников для календаря и уведомлений: из participants JSONB или legacy participant_ids."""
    parts = getattr(row, "participants", None) or []
    if isinstance(parts, list) and parts and isinstance(parts[0], dict):
        out: list[str] = []
        for p in parts:
            if not isinstance(p, dict):
                continue
            uid = (p.get("userId") or p.get("user_id") or "").strip()[:36]
            if uid:
                out.append(uid)
        if out:
            return out
    raw = getattr(row, "participant_ids", None) or []
    return [str(x).strip()[:36] for x in raw if str(x).strip()]


def normalize_participants_payload(
    raw_participants: Any,
    raw_participant_ids: Any,
) -> tuple[list[dict[str, Any]], list[str]]:
    """
    В БД: participants — JSONB-массив объектов, participant_ids — массив uuid-строк (синхронно).
    Если передан participants — он главный; иначе строим из participantIds.
    """
    if raw_participants is not None:
        if not isinstance(raw_participants, list):
            raise HTTPException(status_code=422, detail="participants должен быть JSON-массивом")
        out_d: list[dict[str, Any]] = []
        ids: list[str] = []
        for item in raw_participants:
            if isinstance(item, str):
                uid = item.strip()[:36]
                if uid:
                    out_d.append({"userId": uid})
                    ids.append(uid)
            elif isinstance(item, dict):
                uid = (item.get("userId") or item.get("user_id") or "").strip()[:36]
                if not uid:
                    continue
                rec: dict[str, Any] = {"userId": uid}
                role = item.get("role")
                if isinstance(role, str) and role.strip():
                    rec["role"] = role.strip()[:50]
                out_d.append(rec)
                ids.append(uid)
            else:
                raise HTTPException(status_code=422, detail="Элемент participants должен быть объектом или строкой userId")
        return out_d, ids

    if raw_participant_ids is not None:
        if not isinstance(raw_participant_ids, list):
            raise HTTPException(status_code=422, detail="participantIds должен быть JSON-массивом")
        ids = [str(x).strip()[:36] for x in raw_participant_ids if str(x).strip()]
        return [{"userId": uid} for uid in ids], ids

    return [], []


def apply_participants_to_row(row: Any, raw_participants: Any, raw_participant_ids: Any) -> None:
    """Обновить participants и participant_ids на модели Meeting."""
    parts, ids = normalize_participants_payload(raw_participants, raw_participant_ids)
    row.participants = parts
    row.participant_ids = ids
