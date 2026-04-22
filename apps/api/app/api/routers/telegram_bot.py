"""Telegram Bot admin panel API.

Endpoints:
  GET  /telegram-bot/info        — getMe: проверить токен, имя бота
  POST /telegram-bot/test        — отправить тестовое сообщение
  GET  /telegram-bot/stats       — статистика доставок
  GET  /telegram-bot/users       — пользователи с их Telegram ID
  PATCH /telegram-bot/users/{id} — задать telegram_user_id для пользователя

Доступ: только ``admin.system`` (get_current_user_admin).
"""
from __future__ import annotations

from typing import Any

import httpx
from fastapi import APIRouter, Body, Depends, HTTPException, Path
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user_admin
from app.core.config import get_settings
from app.db import get_db
from app.models.notification import NotificationDelivery, NotificationPreferences
from app.models.user import User
from app.services.telegram_sender import send_telegram_message

router = APIRouter(
    prefix="/telegram-bot",
    tags=["telegram-bot"],
    dependencies=[Depends(get_current_user_admin)],
)


async def _telegram_get_me(bot_token: str) -> dict[str, Any]:
    url = f"https://api.telegram.org/bot{bot_token}/getMe"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(url)
        data = r.json()
    except Exception as exc:
        return {"ok": False, "error": str(exc)}
    return data


# ─── Schemas ────────────────────────────────────────────────────────────────

class BotInfoResponse(BaseModel):
    configured: bool
    ok: bool = False
    bot_id: int | None = None
    username: str | None = None
    first_name: str | None = None
    can_join_groups: bool | None = None
    error: str | None = None


class TestMessageRequest(BaseModel):
    chat_id: str = Field(..., min_length=1, max_length=100)
    text: str = Field(default="Тестовое уведомление от Taska", max_length=4096)


class TestMessageResponse(BaseModel):
    ok: bool
    error: str | None = None


class DeliveryStatsResponse(BaseModel):
    telegram_pending: int = 0
    telegram_sending: int = 0
    telegram_sent: int = 0
    telegram_retry: int = 0
    telegram_dead: int = 0
    email_pending: int = 0
    email_sent: int = 0
    email_dead: int = 0


class TelegramUser(BaseModel):
    id: str
    name: str
    login: str | None = None
    email: str | None = None
    telegram_username: str | None = None
    telegram_user_id: str | None = None
    telegram_chat_id: str | None = None


class SetTelegramIdRequest(BaseModel):
    telegram_user_id: str | None = Field(default=None, max_length=50)


# ─── Endpoints ──────────────────────────────────────────────────────────────

@router.get("/info", response_model=BotInfoResponse)
async def get_bot_info():
    """Проверяет токен бота через getMe."""
    token = (get_settings().TELEGRAM_BOT_TOKEN or "").strip()
    if not token:
        return BotInfoResponse(configured=False, error="TELEGRAM_BOT_TOKEN не задан")
    data = await _telegram_get_me(token)
    if not data.get("ok"):
        return BotInfoResponse(
            configured=True,
            ok=False,
            error=str(data.get("description") or data.get("error") or "Ошибка API"),
        )
    bot = data.get("result") or {}
    return BotInfoResponse(
        configured=True,
        ok=True,
        bot_id=bot.get("id"),
        username=bot.get("username"),
        first_name=bot.get("first_name"),
        can_join_groups=bot.get("can_join_groups"),
    )


@router.post("/test", response_model=TestMessageResponse)
async def send_test_message(body: TestMessageRequest):
    """Отправить тестовое сообщение в указанный chat_id."""
    token = (get_settings().TELEGRAM_BOT_TOKEN or "").strip()
    if not token:
        raise HTTPException(status_code=400, detail="TELEGRAM_BOT_TOKEN не задан")
    result = await send_telegram_message(token, body.chat_id, body.text)
    return TestMessageResponse(ok=result.ok, error=result.error)


@router.get("/stats", response_model=DeliveryStatsResponse)
async def get_delivery_stats(db: AsyncSession = Depends(get_db)):
    """Агрегированная статистика доставок по каналам и статусам."""
    rows = (
        await db.execute(
            select(
                NotificationDelivery.channel,
                NotificationDelivery.status,
                func.count().label("cnt"),
            ).group_by(NotificationDelivery.channel, NotificationDelivery.status)
        )
    ).all()

    out = DeliveryStatsResponse()
    for channel, status, cnt in rows:
        key = f"{channel}_{status}"
        if hasattr(out, key):
            setattr(out, key, cnt)
    return out


@router.get("/users", response_model=list[TelegramUser])
async def get_telegram_users(db: AsyncSession = Depends(get_db)):
    """Пользователи с их Telegram ID и chat_id из префов."""
    users = (
        await db.execute(
            select(User).where(User.is_archived.is_(False)).order_by(User.name)
        )
    ).scalars().all()

    user_ids = [u.id for u in users]
    pref_rows = (
        await db.execute(
            select(NotificationPreferences).where(NotificationPreferences.id.in_(user_ids))
        )
    ).scalars().all()
    pref_map = {p.id: p for p in pref_rows}

    result: list[TelegramUser] = []
    for u in users:
        pref = pref_map.get(u.id)
        chat_id = None
        if pref and isinstance(pref.prefs, dict):
            chat_id = pref.prefs.get("telegramChatId")
        result.append(
            TelegramUser(
                id=u.id,
                name=u.name,
                login=u.login,
                email=u.email,
                telegram_username=u.telegram,
                telegram_user_id=u.telegram_user_id,
                telegram_chat_id=chat_id,
            )
        )
    return result


@router.patch("/users/{user_id}", response_model=dict)
async def set_user_telegram_id(
    user_id: str = Path(...),
    body: SetTelegramIdRequest = Body(...),
    db: AsyncSession = Depends(get_db),
):
    """Задать / сбросить telegram_user_id для пользователя (ручная привязка)."""
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    user.telegram_user_id = (body.telegram_user_id or "").strip() or None
    await db.commit()
    return {"ok": True}
