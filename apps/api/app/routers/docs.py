"""Docs router."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.content import Doc
from app.services.domain_events import emit_domain_event, log_entity_mutation

router = APIRouter(prefix="/docs", tags=["docs"])


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


@router.get("")
async def get_docs(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Doc))
    return [row_to_doc(d) for d in result.scalars().all()]


@router.put("")
async def update_docs(docs: list[dict], db: AsyncSession = Depends(get_db)):
    for d in docs:
        did = d.get("id")
        if not did:
            continue
        existing = await db.get(Doc, did)
        is_new = existing is None
        if existing:
            existing.table_id = d.get("tableId")
            existing.folder_id = d.get("folderId")
            existing.title = d.get("title", existing.title)
            existing.type = d.get("type", existing.type)
            existing.url = d.get("url")
            existing.content = d.get("content")
            existing.tags = d.get("tags", existing.tags or [])
            existing.is_archived = d.get("isArchived", False)
        else:
            from app.models.content import Doc as DocModel
            db.add(DocModel(
                id=did,
                table_id=d.get("tableId"),
                folder_id=d.get("folderId"),
                title=d.get("title", ""),
                type=d.get("type", "internal"),
                url=d.get("url"),
                content=d.get("content"),
                tags=d.get("tags", []),
                is_archived=d.get("isArchived", False),
            ))
        await db.flush()
        doc_row = await db.get(Doc, did)
        await log_entity_mutation(
            db,
            event_type="document.created" if is_new else "document.updated",
            entity_type="doc",
            entity_id=did,
            source="docs-router",
            payload={"title": doc_row.title if doc_row else d.get("title", "")},
            actor_id=d.get("updatedByUserId") or d.get("createdByUserId"),
        )
        recipient_ids = d.get("recipientIds") or []
        if recipient_ids:
            await emit_domain_event(
                db,
                event_type="document.shared",
                org_id="default",
                entity_type="doc",
                entity_id=did,
                source="docs-router",
                actor_id=d.get("sharedByUserId") or d.get("createdByUserId"),
                payload={
                    "docId": did,
                    "title": d.get("title", existing.title if existing else ""),
                    "recipientIds": recipient_ids,
                },
            )
    await db.commit()
    return {"ok": True}
