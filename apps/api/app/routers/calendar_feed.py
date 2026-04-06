"""Публичная iCal-подписка для Google Calendar и др. (по секретному токену пользователя)."""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Body, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.config import get_settings
from app.database import get_db
from app.models.content import Meeting
from app.models.user import User

router = APIRouter(prefix="/calendar", tags=["calendar"])


def _ics_escape(s: str) -> str:
    return (
        s.replace("\\", "\\\\")
        .replace("\n", "\\n")
        .replace("\r", "")
        .replace(",", "\\,")
        .replace(";", "\\;")
    )


def _parse_token(raw: str) -> str:
    base = (raw or "").strip()
    if base.endswith(".ics"):
        base = base[:-4]
    if not re.match(r"^[a-f0-9\-]{36}$", base, re.I):
        raise HTTPException(status_code=404, detail="invalid_feed")
    return base


def _parse_meeting_wall_clock(date_s: str, time_s: str, tz_name: str) -> tuple[datetime, datetime] | None:
    """
    date_s: YYYY-MM-DD, time_s: HH:mm или H:mm — как в CRM.
    Возвращает (start_utc, end_utc) для одночасового слота в UTC, либо None.
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
    try:
        tz = ZoneInfo(tz_name)
    except Exception:
        tz = ZoneInfo("Asia/Tashkent")
    y, mo, da = int(d[0:4]), int(d[5:7]), int(d[8:10])
    try:
        start_local = datetime(y, mo, da, h, mi, 0, tzinfo=tz)
    except ValueError:
        return None
    end_local = start_local + timedelta(hours=1)
    return (start_local.astimezone(ZoneInfo("UTC")), end_local.astimezone(ZoneInfo("UTC")))


@router.get("/feed/{token}.ics")
async def user_calendar_feed(token: str, db: AsyncSession = Depends(get_db)):
    """Подписка: в Google Calendar → Добавить календарь → По URL → вставить эту ссылку."""
    tid = _parse_token(token)
    ur = await db.execute(select(User).where(User.calendar_export_token == tid, User.is_archived.is_(False)))
    user = ur.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="feed_not_found")

    mr = await db.execute(select(Meeting).where(Meeting.is_archived.is_(False)))
    rows = mr.scalars().all()

    tz_wall = get_settings().CALENDAR_EXPORT_TZID

    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Taska//Calendar//RU",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        # Подсказка клиентам; реальное время — в DTSTART/DTEND …Z (UTC после интерпретации в CALENDAR_EXPORT_TZID)
        f"X-WR-TIMEZONE:{tz_wall}",
    ]
    uid_host = "taska.local"

    for m in rows:
        pids = m.participant_ids or []
        if user.id not in pids:
            continue
        date_s = (m.date or "").strip()
        time_s = (m.time or "09:00").strip()
        span = _parse_meeting_wall_clock(date_s, time_s, tz_wall)
        if not span:
            continue
        start_utc, end_utc = span
        title = _ics_escape((m.title or "Событие")[:900])
        desc = _ics_escape((m.summary or "")[:2000])
        lines.append("BEGIN:VEVENT")
        lines.append(f"UID:{m.id}@{uid_host}")
        lines.append(f"DTSTAMP:{datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')}")
        lines.append(f"DTSTART:{start_utc.strftime('%Y%m%dT%H%M%SZ')}")
        lines.append(f"DTEND:{end_utc.strftime('%Y%m%dT%H%M%SZ')}")
        lines.append(f"SUMMARY:{title}")
        if desc:
            lines.append(f"DESCRIPTION:{desc}")
        lines.append("END:VEVENT")

    lines.append("END:VCALENDAR")
    body = "\r\n".join(lines)
    return Response(
        content=body,
        media_type="text/calendar; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="taska-{str(user.id)[:8]}.ics"'},
    )


class ExportTokenBody(BaseModel):
    rotate: bool = False


@router.post("/export-token")
async def ensure_export_token(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    body: ExportTokenBody = Body(default=ExportTokenBody()),
):
    """Создать или вернуть токен экспорта; rotate=true — новый токен (старая ссылка в Google перестанет работать)."""
    if body.rotate or not current_user.calendar_export_token:
        current_user.calendar_export_token = str(uuid.uuid4())
        await db.commit()
        await db.refresh(current_user)
    return {"ok": True, "token": current_user.calendar_export_token}
