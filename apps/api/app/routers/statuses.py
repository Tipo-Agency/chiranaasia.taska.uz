"""Statuses router."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.settings import StatusOption
from app.utils import row_to_status

router = APIRouter(prefix="/statuses", tags=["statuses"])


@router.get("")
async def get_statuses(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(StatusOption))
    return [row_to_status(s) for s in result.scalars().all()]


@router.put("")
async def update_statuses(statuses: list[dict], db: AsyncSession = Depends(get_db)):
    for s in statuses:
        sid = s.get("id")
        if not sid:
            continue
        existing = await db.get(StatusOption, sid)
        if existing:
            existing.name = s.get("name", existing.name)
            existing.color = s.get("color", existing.color)
        else:
            db.add(StatusOption(
                id=sid,
                name=s.get("name", ""),
                color=s.get("color", ""),
            ))
    await db.commit()
    return {"ok": True}
