"""Folders router."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.content import Folder
from app.schemas.common_responses import OkResponse
from app.schemas.settings import FolderItem, FolderRead
from app.services.domain_events import log_entity_mutation
from app.core.auth import get_current_user

router = APIRouter(prefix="/folders", tags=["folders"], dependencies=[Depends(get_current_user)])


def row_to_folder(row):
    return {
        "id": row.id,
        "tableId": row.table_id,
        "name": row.name,
        "parentFolderId": row.parent_folder_id,
        "isArchived": row.is_archived or False,
    }


@router.get("", response_model=list[FolderRead])
async def get_folders(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Folder).where(Folder.is_archived.is_(False)))
    return [row_to_folder(f) for f in result.scalars().all()]


@router.put("", response_model=OkResponse)
async def update_folders(folders: list[FolderItem], db: AsyncSession = Depends(get_db)):
    for f in folders:
        fid = f.id
        existing = await db.get(Folder, fid)
        is_new = existing is None
        if existing:
            existing.table_id = f.tableId or existing.table_id
            existing.name = f.name or existing.name
            existing.parent_folder_id = f.parentFolderId
            existing.is_archived = f.isArchived
        else:
            db.add(Folder(
                id=fid,
                table_id=f.tableId,
                name=f.name,
                parent_folder_id=f.parentFolderId,
                is_archived=f.isArchived,
            ))
        await db.flush()
        row = await db.get(Folder, fid)
        await log_entity_mutation(
            db,
            event_type="folder.created" if is_new else "folder.updated",
            entity_type="folder",
            entity_id=fid,
            source="folders-router",
            payload={"name": row.name if row else f.name, "tableId": row.table_id if row else f.tableId},
        )
    await db.commit()
    return {"ok": True}
