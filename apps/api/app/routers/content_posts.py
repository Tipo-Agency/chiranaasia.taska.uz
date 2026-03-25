"""Content posts router."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.content import ContentPost
from app.services.domain_events import log_entity_mutation

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
        prev_status = existing.status if existing else None
        is_new = existing is None
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
        await db.flush()
        row = await db.get(ContentPost, pid)
        await log_entity_mutation(
            db,
            event_type="content_post.created" if is_new else "content_post.updated",
            entity_type="content_post",
            entity_id=pid,
            source="content-posts-router",
            payload={"topic": row.topic if row else p.get("topic"), "status": row.status if row else p.get("status")},
            actor_id=p.get("updatedByUserId") or p.get("createdByUserId"),
        )
        if not is_new and row and prev_status is not None and row.status != prev_status:
            await log_entity_mutation(
                db,
                event_type="content_post.status.changed",
                entity_type="content_post",
                entity_id=pid,
                source="content-posts-router",
                payload={"topic": row.topic, "fromStatus": prev_status, "toStatus": row.status},
                actor_id=p.get("updatedByUserId"),
            )
    await db.commit()
    return {"ok": True}
