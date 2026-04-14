"""Правила связи Deal ↔ Client: существующий client_id, этап won только с клиентом."""
from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Client


def normalize_deal_client_id(raw: str | None) -> str | None:
    if raw is None:
        return None
    s = str(raw).strip()
    if not s:
        return None
    return s[:36] if len(s) <= 36 else s[:36]


async def assert_deal_client_id_exists(db: AsyncSession, client_id: str | None) -> None:
    """Если client_id задан — клиент должен существовать (до FK на flush)."""
    if not client_id:
        return
    row = await db.get(Client, client_id)
    if row is None:
        raise HTTPException(status_code=400, detail="client_not_found")


def assert_won_requires_client_id(stage: str | None, client_id: str | None) -> None:
    st = (stage or "").strip().lower()
    if st != "won":
        return
    cid = (client_id or "").strip()
    if not cid:
        raise HTTPException(status_code=400, detail="won_requires_client_id")
