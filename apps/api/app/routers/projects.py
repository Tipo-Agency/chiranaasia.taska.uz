"""Projects router."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.task import Project
from app.services.domain_events import log_entity_mutation
from app.utils import row_to_project

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("")
async def get_projects(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project))
    return [row_to_project(p) for p in result.scalars().all()]


@router.put("")
async def update_projects(projects: list[dict], db: AsyncSession = Depends(get_db)):
    for p in projects:
        pid = p.get("id")
        if not pid:
            continue
        existing = await db.get(Project, pid)
        is_new = existing is None
        if existing:
            existing.name = p.get("name", existing.name)
            existing.icon = p.get("icon")
            existing.color = p.get("color")
            existing.is_archived = p.get("isArchived", False)
        else:
            db.add(Project(
                id=pid,
                name=p.get("name", ""),
                icon=p.get("icon"),
                color=p.get("color"),
                is_archived=p.get("isArchived", False),
            ))
        await db.flush()
        row = await db.get(Project, pid)
        await log_entity_mutation(
            db,
            event_type="project.created" if is_new else "project.updated",
            entity_type="project",
            entity_id=pid,
            source="projects-router",
            payload={"name": row.name if row else p.get("name")},
        )
    await db.commit()
    return {"ok": True}
