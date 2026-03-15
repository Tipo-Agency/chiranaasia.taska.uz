"""Docs router."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.content import Doc

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
    await db.commit()
    return {"ok": True}
