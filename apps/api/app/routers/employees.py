"""Employees router."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.client import EmployeeInfo
from app.utils import row_to_employee

router = APIRouter(prefix="/employees", tags=["employees"])


@router.get("")
async def get_employees(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(EmployeeInfo))
    return [row_to_employee(e) for e in result.scalars().all()]


@router.put("")
async def update_employees(employees: list[dict], db: AsyncSession = Depends(get_db)):
    for e in employees:
        eid = e.get("id")
        if not eid:
            continue
        existing = await db.get(EmployeeInfo, eid)
        if existing:
            existing.user_id = e.get("userId", existing.user_id)
            existing.department_id = e.get("departmentId")
            existing.position = e.get("position", existing.position)
            existing.hire_date = e.get("hireDate", existing.hire_date)
            existing.birth_date = e.get("birthDate")
            existing.is_archived = e.get("isArchived", False)
        else:
            db.add(EmployeeInfo(
                id=eid,
                user_id=e.get("userId", ""),
                department_id=e.get("departmentId"),
                position=e.get("position", ""),
                hire_date=e.get("hireDate", ""),
                birth_date=e.get("birthDate"),
                is_archived=e.get("isArchived", False),
            ))
    await db.commit()
    return {"ok": True}
