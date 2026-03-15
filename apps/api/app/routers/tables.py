"""Tables router."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.settings import TableCollection
from app.utils import row_to_table

router = APIRouter(prefix="/tables", tags=["tables"])


@router.get("")
async def get_tables(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(TableCollection))
    return [row_to_table(t) for t in result.scalars().all()]


@router.put("")
async def update_tables(tables: list[dict], db: AsyncSession = Depends(get_db)):
    for t in tables:
        tid = t.get("id")
        if not tid:
            continue
        existing = await db.get(TableCollection, tid)
        if existing:
            existing.name = t.get("name", existing.name)
            existing.type = t.get("type", existing.type)
            existing.icon = t.get("icon", existing.icon)
            existing.color = t.get("color")
            existing.is_system = t.get("isSystem", False)
            existing.is_archived = t.get("isArchived", False)
        else:
            db.add(TableCollection(
                id=tid,
                name=t.get("name", ""),
                type=t.get("type", ""),
                icon=t.get("icon", ""),
                color=t.get("color"),
                is_system=t.get("isSystem", False),
                is_archived=t.get("isArchived", False),
            ))
    await db.commit()
    return {"ok": True}
