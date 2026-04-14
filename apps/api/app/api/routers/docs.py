"""Docs router."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.content import Doc
from app.schemas.common_responses import OkResponse
from app.schemas.content import DocItem, DocRead
from app.services.domain_events import emit_domain_event, log_entity_mutation
from app.core.auth import get_current_user

router = APIRouter(prefix="/docs", tags=["docs"], dependencies=[Depends(get_current_user)])


def row_to_doc(row):
    return {
        "id": row.id,
        "tableId": row.table_id,
        "folderId": row.folder_id,
        "title": row.title,
        "type": row.type,
        "url": row.url,
        "content": row.content,
        "tags": row.tags or [],
        "isArchived": row.is_archived or False,
    }


@router.get("", response_model=list[DocRead])
async def get_docs(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Doc))
    return [row_to_doc(d) for d in result.scalars().all()]


@router.put("", response_model=OkResponse)
async def update_docs(docs: list[DocItem], db: AsyncSession = Depends(get_db)):
    for d in docs:
        did = d.id
        existing = await db.get(Doc, did)
        is_new = existing is None
        if existing:
            existing.table_id = d.tableId
            existing.folder_id = d.folderId
            existing.title = d.title or existing.title
            existing.type = d.type or existing.type
            existing.url = d.url
            existing.content = d.content
            existing.tags = d.tags if d.tags is not None else (existing.tags or [])
            existing.is_archived = d.isArchived
        else:
            db.add(Doc(
                id=did,
                table_id=d.tableId,
                folder_id=d.folderId,
                title=d.title,
                type=d.type,
                url=d.url,
                content=d.content,
                tags=d.tags,
                is_archived=d.isArchived,
            ))
        await db.flush()
        doc_row = await db.get(Doc, did)
        await log_entity_mutation(
            db,
            event_type="document.created" if is_new else "document.updated",
            entity_type="doc",
            entity_id=did,
            source="docs-router",
            payload={"title": doc_row.title if doc_row else d.title},
            actor_id=d.updatedByUserId or d.createdByUserId,
        )
        recipient_ids = d.recipientIds
        if recipient_ids:
            await emit_domain_event(
                db,
                event_type="document.shared",
                org_id="default",
                entity_type="doc",
                entity_id=did,
                source="docs-router",
                actor_id=d.sharedByUserId or d.createdByUserId,
                payload={
                    "docId": did,
                    "title": d.title,
                    "recipientIds": recipient_ids,
                },
            )
    await db.commit()
    return {"ok": True}
