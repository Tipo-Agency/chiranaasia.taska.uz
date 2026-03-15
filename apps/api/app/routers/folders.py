"""Folders router."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.content import Folder

router = APIRouter(prefix="/folders", tags=["folders"])


def row_to_folder(row):
    return {
        "id": row.id,
        "tableId": row.table_id,
        "name": row.name,
        "parentFolderId": row.parent_folder_id,
        "isArchived": row.is_archived or False,
    }


@router.get("")
async def get_folders(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Folder).where(Folder.is_archived == False))
    return [row_to_folder(f) for f in result.scalars().all()]


@router.put("")
async def update_folders(folders: list[dict], db: AsyncSession = Depends(get_db)):
    for f in folders:
        fid = f.get("id")
        if not fid:
            continue
        existing = await db.get(Folder, fid)
        if existing:
            existing.table_id = f.get("tableId", existing.table_id)
            existing.name = f.get("name", existing.name)
            existing.parent_folder_id = f.get("parentFolderId")
            existing.is_archived = f.get("isArchived", False)
        else:
            db.add(Folder(
                id=fid,
                table_id=f.get("tableId", ""),
                name=f.get("name", ""),
                parent_folder_id=f.get("parentFolderId"),
                is_archived=f.get("isArchived", False),
            ))
    await db.commit()
    return {"ok": True}
