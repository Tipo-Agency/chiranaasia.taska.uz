"""Departments router."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.finance import Department
from app.services.domain_events import log_entity_mutation

router = APIRouter(prefix="/departments", tags=["departments"])


def row_to_dept(row):
    return {
        "id": row.id,
        "name": row.name,
        "headId": row.head_id,
        "description": row.description,
        "isArchived": getattr(row, "is_archived", False) or False,
    }


@router.get("")
async def get_departments(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Department))
    return [row_to_dept(d) for d in result.scalars().all()]


@router.put("")
async def update_departments(departments: list[dict], db: AsyncSession = Depends(get_db)):
    for d in departments:
        did = d.get("id")
        if not did:
            continue
        existing = await db.get(Department, did)
        is_new = existing is None
        if existing:
            existing.name = d.get("name", existing.name)
            existing.head_id = d.get("headId")
            existing.description = d.get("description")
            if "isArchived" in d:
                existing.is_archived = bool(d.get("isArchived", False))
        else:
            db.add(Department(
                id=did,
                name=d.get("name", ""),
                head_id=d.get("headId"),
                description=d.get("description"),
                is_archived=bool(d.get("isArchived", False)),
            ))
        await db.flush()
        row = await db.get(Department, did)
        await log_entity_mutation(
            db,
            event_type="department.created" if is_new else "department.updated",
            entity_type="department",
            entity_id=did,
            source="departments-router",
            payload={"name": row.name if row else d.get("name")},
        )
    await db.commit()
    return {"ok": True}
