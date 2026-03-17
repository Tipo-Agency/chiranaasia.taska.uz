"""Tables router."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.content import ContentPost
from app.models.settings import TableCollection
from app.utils import row_to_table

router = APIRouter(prefix="/tables", tags=["tables"])

def _row_to_post(row: ContentPost) -> dict:
    return {
        "id": row.id,
        "tableId": row.table_id,
        "topic": row.topic,
        "description": row.description,
        "date": row.date,
        "platform": row.platform or [],
        "format": row.format,
        "status": row.status,
        "copy": row.copy,
        "mediaUrl": row.media_url,
        "isArchived": row.is_archived or False,
    }


@router.get("/public/content-plan/{table_id}")
async def get_public_content_plan(table_id: str, db: AsyncSession = Depends(get_db)):
    """
    Публичный контент-план по table_id (без авторизации).
    Возвращает только одну таблицу и её посты.
    """
    t = await db.get(TableCollection, table_id)
    if not t or (t.is_archived or False):
        return {"table": None, "posts": []}
    posts_result = await db.execute(select(ContentPost).where(ContentPost.table_id == table_id))
    posts = [p for p in posts_result.scalars().all() if not (p.is_archived or False)]
    return {"table": row_to_table(t), "posts": [_row_to_post(p) for p in posts]}


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
