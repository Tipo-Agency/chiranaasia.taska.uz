"""Content posts router."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.content import ContentPost

router = APIRouter(prefix="/content-posts", tags=["content-posts"])


def row_to_post(row):
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


@router.get("")
async def get_content_posts(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ContentPost))
    return [row_to_post(p) for p in result.scalars().all()]


@router.put("")
async def update_content_posts(posts: list[dict], db: AsyncSession = Depends(get_db)):
    for p in posts:
        pid = p.get("id")
        if not pid:
            continue
        existing = await db.get(ContentPost, pid)
        if existing:
            existing.table_id = p.get("tableId")
            existing.topic = p.get("topic", existing.topic)
            existing.description = p.get("description")
            existing.date = p.get("date", existing.date)
            existing.platform = p.get("platform", existing.platform or [])
            existing.format = p.get("format", existing.format)
            existing.status = p.get("status", existing.status)
            existing.copy = p.get("copy")
            existing.media_url = p.get("mediaUrl")
            existing.is_archived = p.get("isArchived", False)
        else:
            db.add(ContentPost(
                id=pid,
                table_id=p.get("tableId"),
                topic=p.get("topic", ""),
                description=p.get("description"),
                date=p.get("date", ""),
                platform=p.get("platform", []),
                format=p.get("format", "post"),
                status=p.get("status", "idea"),
                copy=p.get("copy"),
                media_url=p.get("mediaUrl"),
                is_archived=p.get("isArchived", False),
            ))
    await db.commit()
    return {"ok": True}
