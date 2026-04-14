"""Content posts router."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.db import get_db
from app.models.content import ContentPost
from app.schemas.common_responses import OkResponse
from app.schemas.content import ContentPostItem, ContentPostRead
from app.services.domain_events import log_entity_mutation

router = APIRouter(prefix="/content-posts", tags=["content-posts"], dependencies=[Depends(get_current_user)])


def _platform_to_list(raw) -> list[str]:
    """JSONB иногда содержит не list (легаси/битые данные) — ответ API всегда list[str]."""
    if raw is None:
        return []
    if isinstance(raw, list):
        out: list[str] = []
        for x in raw:
            if x is None:
                continue
            out.append(str(x))
        return out
    return []


def row_to_post(row) -> ContentPostRead:
    return ContentPostRead(
        id=str(row.id),
        tableId=str(row.table_id or ""),
        topic=str(row.topic or ""),
        description=row.description,
        date=str(row.date or ""),
        platform=_platform_to_list(getattr(row, "platform", None)),
        format=str(row.format or ""),
        status=str(row.status or ""),
        copy=row.copy,
        mediaUrl=row.media_url,
        isArchived=bool(row.is_archived or False),
    )


@router.get("", response_model=list[ContentPostRead])
async def get_content_posts(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ContentPost))
    return [row_to_post(p) for p in result.scalars().all()]


@router.put("", response_model=OkResponse)
async def update_content_posts(posts: list[ContentPostItem], db: AsyncSession = Depends(get_db)):
    for p in posts:
        pid = p.id
        existing = await db.get(ContentPost, pid)
        prev_status = existing.status if existing else None
        is_new = existing is None
        if existing:
            existing.table_id = p.tableId
            existing.topic = p.topic or existing.topic
            existing.description = p.description
            existing.date = p.date or existing.date
            existing.platform = p.platform if p.platform is not None else (existing.platform or [])
            existing.format = p.format or existing.format
            existing.status = p.status or existing.status
            existing.copy = p.copy
            existing.media_url = p.mediaUrl
            existing.is_archived = p.isArchived
        else:
            db.add(ContentPost(
                id=pid,
                table_id=p.tableId,
                topic=p.topic,
                description=p.description,
                date=p.date,
                platform=p.platform,
                format=p.format,
                status=p.status,
                copy=p.copy,
                media_url=p.mediaUrl,
                is_archived=p.isArchived,
            ))
        await db.flush()
        row = await db.get(ContentPost, pid)
        await log_entity_mutation(
            db,
            event_type="content_post.created" if is_new else "content_post.updated",
            entity_type="content_post",
            entity_id=pid,
            source="content-posts-router",
            payload={"topic": row.topic if row else p.topic, "status": row.status if row else p.status},
            actor_id=p.updatedByUserId or p.createdByUserId,
        )
        if not is_new and row and prev_status is not None and row.status != prev_status:
            await log_entity_mutation(
                db,
                event_type="content_post.status.changed",
                entity_type="content_post",
                entity_id=pid,
                source="content-posts-router",
                payload={"topic": row.topic, "fromStatus": prev_status, "toStatus": row.status},
                actor_id=p.updatedByUserId,
            )
    await db.commit()
    return {"ok": True}
