"""Departments router."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.json_http_cache import json_304_or_response
from app.db import get_db
from app.models.finance import Department
from app.schemas.common_responses import OkResponse
from app.schemas.settings import DepartmentItem, DepartmentRead
from app.services.domain_events import log_entity_mutation
from app.core.auth import get_current_user

router = APIRouter(prefix="/departments", tags=["departments"], dependencies=[Depends(get_current_user)])


def row_to_dept(row):
    return {
        "id": row.id,
        "name": row.name,
        "parentId": getattr(row, "parent_id", None),
        "headId": row.head_id,
        "description": row.description,
        "isArchived": getattr(row, "is_archived", False) or False,
    }


async def _would_create_parent_cycle(
    db: AsyncSession, department_id: str, new_parent_id: str | None
) -> bool:
    """True, если назначение parent_id создаёт цикл (в т.ч. parent == self)."""
    if not new_parent_id:
        return False
    if new_parent_id == department_id:
        return True
    cur: str | None = new_parent_id
    for _ in range(256):
        if cur == department_id:
            return True
        row = await db.get(Department, cur)
        if row is None:
            return False
        cur = row.parent_id
    return True


@router.get("", response_model=list[DepartmentRead])
async def get_departments(request: Request, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Department).order_by(Department.id))
    data = [row_to_dept(d) for d in result.scalars().all()]
    return json_304_or_response(request, data=data, max_age=300)


@router.put("", response_model=OkResponse)
async def update_departments(departments: list[DepartmentItem], db: AsyncSession = Depends(get_db)):
    for d in departments:
        did = d.id
        existing = await db.get(Department, did)
        is_new = existing is None
        raw_parent = d.parentId
        new_parent = None if raw_parent in (None, "") else str(raw_parent).strip() or None
        if existing:
            existing.name = d.name
            existing.head_id = d.headId
            existing.description = d.description
            existing.is_archived = d.isArchived
            if await _would_create_parent_cycle(db, did, new_parent):
                raise HTTPException(
                    status_code=400,
                    detail="Некорректный родительский отдел: цикл или ссылка на самого себя",
                )
            existing.parent_id = new_parent
        else:
            if new_parent is not None and await _would_create_parent_cycle(db, did, new_parent):
                raise HTTPException(
                    status_code=400,
                    detail="Некорректный родительский отдел: цикл или ссылка на самого себя",
                )
            db.add(Department(
                id=did,
                name=d.name,
                parent_id=new_parent,
                head_id=d.headId,
                description=d.description,
                is_archived=d.isArchived,
            ))
        await db.flush()
        row = await db.get(Department, did)
        await log_entity_mutation(
            db,
            event_type="department.created" if is_new else "department.updated",
            entity_type="department",
            entity_id=did,
            source="departments-router",
            payload={"name": row.name if row else d.name},
        )
    await db.commit()
    return {"ok": True}
