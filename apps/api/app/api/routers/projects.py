"""Projects router."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.task import Project
from app.schemas.common_responses import OkResponse
from app.schemas.settings import ProjectItem, ProjectRead
from app.services.domain_events import log_entity_mutation
from app.core.mappers import row_to_project
from app.core.auth import get_current_user

router = APIRouter(prefix="/projects", tags=["projects"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[ProjectRead])
async def get_projects(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project))
    return [row_to_project(p) for p in result.scalars().all()]


@router.put("", response_model=OkResponse)
async def update_projects(projects: list[ProjectItem], db: AsyncSession = Depends(get_db)):
    for p in projects:
        pid = p.id
        existing = await db.get(Project, pid)
        is_new = existing is None
        if existing:
            existing.name = p.name
            existing.icon = p.icon
            existing.color = p.color
            existing.is_archived = p.isArchived
        else:
            db.add(Project(
                id=pid,
                name=p.name,
                icon=p.icon,
                color=p.color,
                is_archived=p.isArchived,
            ))
        await db.flush()
        row = await db.get(Project, pid)
        await log_entity_mutation(
            db,
            event_type="project.created" if is_new else "project.updated",
            entity_type="project",
            entity_id=pid,
            source="projects-router",
            payload={"name": row.name if row else p.name},
        )
    await db.commit()
    return {"ok": True}
