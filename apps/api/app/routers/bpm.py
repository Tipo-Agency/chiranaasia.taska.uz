"""BPM router - positions, processes."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.bpm import OrgPosition, BusinessProcess
from app.services.domain_events import log_entity_mutation

router = APIRouter(prefix="/bpm", tags=["bpm"])


def row_to_position(row):
    return {
        "id": row.id,
        "title": row.title,
        "departmentId": row.department_id,
        "managerPositionId": row.manager_position_id,
        "holderUserId": row.holder_user_id,
        "order": int(row.order_val) if row.order_val and str(row.order_val).isdigit() else row.order_val,
    }


def row_to_process(row):
    return {
        "id": row.id,
        "version": int(row.version) if row.version and str(row.version).isdigit() else 1,
        "title": row.title,
        "description": row.description,
        "steps": row.steps or [],
        "instances": row.instances or [],
        "isArchived": str(row.is_archived).lower() == "true" if row.is_archived else False,
        "createdAt": row.created_at,
        "updatedAt": row.updated_at,
    }


@router.get("/positions")
async def get_positions(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(OrgPosition))
    return [row_to_position(p) for p in result.scalars().all()]


@router.put("/positions")
async def update_positions(positions: list[dict], db: AsyncSession = Depends(get_db)):
    for p in positions:
        pid = p.get("id")
        if not pid:
            continue
        existing = await db.get(OrgPosition, pid)
        is_new = existing is None
        if existing:
            existing.title = p.get("title", existing.title)
            existing.department_id = p.get("departmentId")
            existing.manager_position_id = p.get("managerPositionId")
            existing.holder_user_id = p.get("holderUserId")
            existing.order_val = str(p.get("order", 0))
        else:
            db.add(OrgPosition(
                id=pid,
                title=p.get("title", ""),
                department_id=p.get("departmentId"),
                manager_position_id=p.get("managerPositionId"),
                holder_user_id=p.get("holderUserId"),
                order_val=str(p.get("order", 0)),
            ))
        await db.flush()
        await log_entity_mutation(
            db,
            event_type="bpm.position.created" if is_new else "bpm.position.updated",
            entity_type="org_position",
            entity_id=pid,
            source="bpm-router",
            payload={"title": p.get("title")},
        )
    await db.commit()
    return {"ok": True}


@router.get("/processes")
async def get_processes(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(BusinessProcess))
    return [row_to_process(p) for p in result.scalars().all()]


@router.put("/processes")
async def update_processes(processes: list[dict], db: AsyncSession = Depends(get_db)):
    for p in processes:
        pid = p.get("id")
        if not pid:
            continue
        existing = await db.get(BusinessProcess, pid)
        is_new = existing is None
        if existing:
            existing.version = str(p.get("version", existing.version))
            existing.title = p.get("title", existing.title)
            existing.description = p.get("description")
            existing.steps = p.get("steps", existing.steps or [])
            existing.instances = p.get("instances", existing.instances or [])
            existing.is_archived = "true" if p.get("isArchived") else "false"
            existing.created_at = p.get("createdAt")
            existing.updated_at = p.get("updatedAt")
        else:
            db.add(BusinessProcess(
                id=pid,
                version=str(p.get("version", 1)),
                title=p.get("title", ""),
                description=p.get("description"),
                steps=p.get("steps", []),
                instances=p.get("instances", []),
                is_archived="true" if p.get("isArchived") else "false",
                created_at=p.get("createdAt"),
                updated_at=p.get("updatedAt"),
            ))
        await db.flush()
        await log_entity_mutation(
            db,
            event_type="bpm.process.created" if is_new else "bpm.process.updated",
            entity_type="business_process",
            entity_id=pid,
            source="bpm-router",
            payload={"title": p.get("title"), "version": p.get("version")},
        )
    await db.commit()
    return {"ok": True}
