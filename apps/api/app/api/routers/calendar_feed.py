"""Публичная iCal-подписка для Google Calendar и др. (по секретному токену пользователя)."""

from datetime import datetime
from typing import Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Body, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request as StarletteRequest

from app.core.auth import get_current_user
from app.core.calendar_export_token import generate_calendar_export_token, parse_calendar_feed_token_segment
from app.core.config import get_settings
from app.core.rate_limit import limiter
from app.db import get_db
from app.models.content import Meeting
from app.models.user import User
from app.services.meeting_validation import parse_meeting_wall_clock, participant_user_ids_from_row

router = APIRouter(prefix="/calendar", tags=["calendar"])


def _ics_escape(s: str) -> str:
    return (
        s.replace("\\", "\\\\")
        .replace("\n", "\\n")
        .replace("\r", "")
        .replace(",", "\\,")
        .replace(";", "\\;")
    )


@router.get(
    "/feed/{token}.ics",
    responses={
        404: {"description": "Неизвестный или отозванный фид (единый ответ)"},
        429: {"description": "Слишком много запросов с этого IP (45/мин); см. Retry-After"},
    },
)
@limiter.limit("45/minute")
async def user_calendar_feed(
    request: StarletteRequest,  # slowapi
    token: str,
    db: AsyncSession = Depends(get_db),
):
    """Подписка: в Google Calendar → Добавить календарь → По URL → вставить эту ссылку."""
    tid = parse_calendar_feed_token_segment(token)
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
        pids = participant_user_ids_from_row(m)
        if user.id not in pids:
            continue
        date_s = (m.date or "").strip()
        time_s = (m.time or "09:00").strip()
        span = parse_meeting_wall_clock(date_s, time_s, tz_wall)
        if not span:
            continue
        start_local, end_local = span
        start_utc = start_local.astimezone(ZoneInfo("UTC"))
        end_utc = end_local.astimezone(ZoneInfo("UTC"))
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
    """rotate — новый токен; revoke — отключить подписку (старые URL перестают работать)."""

    rotate: bool = False
    revoke: bool = False


class ExportTokenResponse(BaseModel):
    ok: bool = True
    token: Optional[str] = Field(default=None, description="Секрет для URL; null после отзыва")


@router.post("/export-token", response_model=ExportTokenResponse)
async def ensure_export_token(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    body: ExportTokenBody = Body(default=ExportTokenBody()),
):
    """
    Создать или вернуть токен экспорта.
    - revoke=true — обнулить токен (отозвать все выданные ссылки).
    - rotate=true — выдать новый длинный случайный токен (старая ссылка перестаёт работать).
    """
    if body.revoke:
        current_user.calendar_export_token = None
        await db.commit()
        await db.refresh(current_user)
        return ExportTokenResponse(ok=True, token=None)

    if body.rotate or not current_user.calendar_export_token:
        current_user.calendar_export_token = generate_calendar_export_token()
        await db.commit()
        await db.refresh(current_user)

    return ExportTokenResponse(ok=True, token=current_user.calendar_export_token)
