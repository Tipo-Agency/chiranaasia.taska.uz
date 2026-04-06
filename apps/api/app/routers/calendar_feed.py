"""Публичная iCal-подписка для Google Calendar и др. (по секретному токену пользователя)."""

from __future__ import annotations

import re
import uuid
from datetime import datetime

from fastapi import APIRouter, Body, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
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

    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Taska//Calendar//RU",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
    ]
    uid_host = "taska.local"

    for m in rows:
        pids = m.participant_ids or []
        if user.id not in pids:
            continue
        date_s = (m.date or "").strip()
        time_s = (m.time or "09:00").strip()
        if len(date_s) < 10:
            continue
        ds = date_s.replace("-", "")[:8]
        ts = time_s.replace(":", "")[:4]
        if len(ts) < 4:
            ts = (ts + "0000")[:4]
        dtstart = f"{ds}T{ts}00"
        title = _ics_escape((m.title or "Событие")[:900])
        desc = _ics_escape((m.summary or "")[:2000])
        lines.append("BEGIN:VEVENT")
        lines.append(f"UID:{m.id}@{uid_host}")
        lines.append(f"DTSTAMP:{datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')}")
        lines.append(f"DTSTART:{dtstart}")
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
