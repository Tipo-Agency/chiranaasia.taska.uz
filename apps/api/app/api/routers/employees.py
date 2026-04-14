"""Employees router — CRUD, поиск, фильтры; по умолчанию без архива. PUT — массовая синхронизация (legacy)."""
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import asc, desc, func, nullslast, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user, require_permission
from app.core.mappers import row_to_employee
from app.core.permissions import PERM_ORG_EMPLOYEES_EDIT
from app.db import get_db
from app.models.client import EmployeeInfo
from app.models.user import User
from app.schemas.common_responses import OkResponse
from app.schemas.employees import (
    EmployeeBulkItem,
    EmployeeCreate,
    EmployeeListResponse,
    EmployeeRead,
    EmployeeUpdate,
)
from app.services.domain_events import log_entity_mutation
from app.services.list_cursor_page import (
    ListCursorError,
    assert_cursor_matches,
    build_seek_after,
    decode_list_cursor,
    encode_list_cursor,
    filter_fingerprint,
    row_seek_values,
)

router = APIRouter(prefix="/employees", tags=["employees"], dependencies=[Depends(get_current_user)])

require_org_employees_edit = require_permission(PERM_ORG_EMPLOYEES_EDIT, detail="org_employees_edit_required")

_DEFAULT_LIMIT = 50
_MAX_LIMIT = 500


def _str_id(v, *, max_len: int = 36) -> str | None:
    if v is None:
        return None
    s = str(v).strip()
    if not s:
        return None
    return s[:max_len]


def _apply_employee_bulk_item(row: EmployeeInfo, item: EmployeeBulkItem) -> None:
    """Обновляет ORM-строку из элемента массовой синхронизации. user_id может быть None."""
    fs = item.model_fields_set
    if "userId" in fs:
        uid = item.userId
        row.user_id = _str_id(uid) if uid else None
    if "departmentId" in fs:
        row.department_id = _str_id(item.departmentId)
    pos_id = None
    if "positionId" in fs:
        pos_id = _str_id(item.positionId)
    elif "orgPositionId" in fs:
        pos_id = _str_id(item.orgPositionId)
    if pos_id is not None or "positionId" in fs or "orgPositionId" in fs:
        row.org_position_id = pos_id

    if "fullName" in fs:
        fn = item.fullName
        row.full_name = (str(fn).strip()[:255] if fn is not None else "") or ""
    if "status" in fs:
        st = item.status
        row.status = (str(st).strip()[:50] if st is not None else "") or "active"

    if "isArchived" in fs:
        row.is_archived = bool(item.isArchived)

    if "hireDate" in fs:
        hd = item.hireDate
        row.hire_date = None if hd is None or str(hd).strip() == "" else str(hd).strip()[:50]
    if "birthDate" in fs:
        bd = item.birthDate
        row.birth_date = None if bd is None or str(bd).strip() == "" else str(bd).strip()[:50]

    legacy_pos = item.position if "position" in fs else None
    if legacy_pos is not None and "fullName" not in fs:
        row.full_name = str(legacy_pos).strip()[:255] or row.full_name or ""

    row.position = row.full_name if row.full_name else row.position


def _apply_employee_update(row: EmployeeInfo, patch: EmployeeUpdate) -> None:
    """PATCH /employees/{id} — только поля из EmployeeUpdate."""
    fs = patch.model_fields_set
    if "userId" in fs:
        uid = patch.userId
        row.user_id = _str_id(uid) if uid else None
    if "departmentId" in fs:
        row.department_id = _str_id(patch.departmentId)
    pos_id = None
    if "positionId" in fs:
        pos_id = _str_id(patch.positionId)
    elif "orgPositionId" in fs:
        pos_id = _str_id(patch.orgPositionId)
    if pos_id is not None or "positionId" in fs or "orgPositionId" in fs:
        row.org_position_id = pos_id
    if "fullName" in fs:
        fn = patch.fullName
        row.full_name = (str(fn).strip()[:255] if fn is not None else "") or ""
    if "status" in fs:
        st = patch.status
        row.status = (str(st).strip()[:50] if st is not None else "") or "active"
    if "isArchived" in fs:
        row.is_archived = bool(patch.isArchived)
    if "hireDate" in fs:
        hd = patch.hireDate
        row.hire_date = None if hd is None or str(hd).strip() == "" else str(hd).strip()[:50]
    if "birthDate" in fs:
        bd = patch.birthDate
        row.birth_date = None if bd is None or str(bd).strip() == "" else str(bd).strip()[:50]
    row.position = row.full_name if row.full_name else row.position


_EMP_SORT_KEYS = frozenset({"fullName", "status", "id", "hireDate", "departmentId"})


def _employee_sort_key(sort: str | None) -> str:
    if sort is None or not str(sort).strip():
        return "fullName"
    k = str(sort).strip()
    if k not in _EMP_SORT_KEYS:
        raise HTTPException(
            status_code=422,
            detail=f"Недопустимое поле сортировки: {k}. Допустимо: {', '.join(sorted(_EMP_SORT_KEYS))}",
        )
    return k


def _sort_column(sort: str | None):
    key = (sort or "fullName").strip()
    m = {
        "fullName": EmployeeInfo.full_name,
        "status": EmployeeInfo.status,
        "id": EmployeeInfo.id,
        "hireDate": EmployeeInfo.hire_date,
        "departmentId": EmployeeInfo.department_id,
    }
    return m[key]


def _employee_order_spec(sort: str | None, order: str | None):
    sk = _employee_sort_key(sort)
    col = _sort_column(sk)
    direction = (order or "asc").strip().lower()
    d = "desc" if direction == "desc" else "asc"
    cols = [col, EmployeeInfo.id]
    dirs = [d, d]
    sp = [sk, "id"]
    op = dirs
    return sp, op, cols, dirs


def _order_clauses(sort: str | None, order: str | None):
    _, _, cols, dirs = _employee_order_spec(sort, order)
    out = []
    for c, d in zip(cols, dirs):
        if d == "desc":
            out.append(nullslast(desc(c)))
        else:
            out.append(nullslast(asc(c)))
    return out


def _list_filters(
    *,
    search: str | None,
    department_id: str | None,
    status: str | None,
    position_id: str | None,
    user_id: str | None,
    include_archived: bool,
) -> list:
    conds: list = []
    if not include_archived:
        conds.append(EmployeeInfo.is_archived.is_(False))
    if department_id and str(department_id).strip():
        conds.append(EmployeeInfo.department_id == str(department_id).strip()[:36])
    if status and str(status).strip():
        conds.append(EmployeeInfo.status == str(status).strip()[:50])
    if position_id and str(position_id).strip():
        conds.append(EmployeeInfo.org_position_id == str(position_id).strip()[:36])
    if user_id and str(user_id).strip():
        conds.append(EmployeeInfo.user_id == str(user_id).strip()[:36])
    if search and str(search).strip():
        raw = str(search).strip()
        pat = f"%{raw}%"
        conds.append(
            or_(
                EmployeeInfo.full_name.ilike(pat),
                EmployeeInfo.status.ilike(pat),
                EmployeeInfo.id.ilike(pat),
                User.name.ilike(pat),
                User.login.ilike(pat),
            )
        )
    return conds


def _employees_list_fingerprint(
    *,
    search: str | None,
    department_id: str | None,
    status: str | None,
    position_id: str | None,
    user_id: str | None,
    include_archived: bool,
) -> str:
    return filter_fingerprint(
        {
            "search": (search or "").strip(),
            "department_id": (department_id or "").strip(),
            "status": (status or "").strip(),
            "position_id": (position_id or "").strip(),
            "user_id": (user_id or "").strip(),
            "include_archived": str(bool(include_archived)),
        }
    )


def _list_joins(search: str | None):
    if search and str(search).strip():
        return [(User, User.id == EmployeeInfo.user_id)]
    return []


@router.get("", response_model=EmployeeListResponse)
async def list_employees(
    db: AsyncSession = Depends(get_db),
    limit: Annotated[int, Query(ge=1, le=_MAX_LIMIT)] = _DEFAULT_LIMIT,
    cursor: str | None = None,
    search: str | None = None,
    department_id: Annotated[str | None, Query(alias="departmentId")] = None,
    status: str | None = None,
    position_id: Annotated[str | None, Query(alias="positionId")] = None,
    user_id: Annotated[str | None, Query(alias="userId")] = None,
    include_archived: Annotated[bool, Query(alias="includeArchived")] = False,
    sort: str | None = None,
    order: str | None = None,
):
    """
    Список сотрудников. По умолчанию **архивные не включаются** (`includeArchived=false`).

    Фильтры: departmentId, status, positionId, userId. Поиск: fullName, status, id, имя/login пользователя.
    """
    conds = _list_filters(
        search=search,
        department_id=department_id,
        status=status,
        position_id=position_id,
        user_id=user_id,
        include_archived=include_archived,
    )
    joins = _list_joins(search)

    cnt_base = select(func.count(EmployeeInfo.id)).select_from(EmployeeInfo)
    for join_target, onclause in joins:
        cnt_base = cnt_base.outerjoin(join_target, onclause)
    if conds:
        cnt_base = cnt_base.where(*conds)
    total = int((await db.execute(cnt_base)).scalar_one() or 0)

    sp, op, cols, dirs = _employee_order_spec(sort, order)
    fh = _employees_list_fingerprint(
        search=search,
        department_id=department_id,
        status=status,
        position_id=position_id,
        user_id=user_id,
        include_archived=include_archived,
    )
    seek = None
    if cursor and cursor.strip():
        try:
            payload = decode_list_cursor(cursor)
            vals = assert_cursor_matches(
                payload,
                resource="employees",
                sort_parts=sp,
                order_parts=op,
                fingerprint=fh,
            )
            seek = build_seek_after(cols, dirs, vals)
        except ListCursorError:
            raise HTTPException(status_code=400, detail="invalid_cursor") from None

    stmt = select(EmployeeInfo).distinct()
    for join_target, onclause in joins:
        stmt = stmt.join(join_target, onclause, isouter=True)
    if conds:
        stmt = stmt.where(*conds)
    if seek is not None:
        stmt = stmt.where(seek)
    stmt = stmt.order_by(*_order_clauses(sort, order)).limit(limit)
    result = await db.execute(stmt)
    rows = result.scalars().unique().all()
    next_c = None
    if rows and len(rows) == limit:
        next_c = encode_list_cursor(
            {
                "r": "employees",
                "sp": sp,
                "op": op,
                "fh": fh,
                "vals": row_seek_values(cols, rows[-1]),
            }
        )
    return EmployeeListResponse(
        items=[row_to_employee(x) for x in rows],
        total=total,
        limit=limit,
        next_cursor=next_c,
    )


@router.get("/{employee_id}", response_model=EmployeeRead)
async def get_employee(employee_id: str, db: AsyncSession = Depends(get_db)):
    row = await db.get(EmployeeInfo, str(employee_id).strip()[:36])
    if row is None:
        raise HTTPException(status_code=404, detail="Сотрудник не найден")
    return row_to_employee(row)


@router.post("", response_model=EmployeeRead, status_code=201, dependencies=[Depends(require_org_employees_edit)])
async def create_employee(body: EmployeeCreate, db: AsyncSession = Depends(get_db)):
    data = body.model_dump(mode="json", exclude_none=True)
    eid = _str_id(data.get("id")) or str(uuid.uuid4())
    if await db.get(EmployeeInfo, eid):
        raise HTTPException(status_code=409, detail="Сотрудник с таким id уже существует")
    e = {**data, "id": eid}
    uid = _str_id(e.get("userId")) if e.get("userId") else None
    dept = _str_id(e.get("departmentId"))
    pos_id = _str_id(e.get("positionId")) or _str_id(e.get("orgPositionId"))
    fn = e.get("fullName")
    if fn is not None:
        full_name = str(fn).strip()[:255] or "Сотрудник"
    else:
        full_name = str(e.get("position") or "").strip()[:255] or "Сотрудник"
    st_raw = e.get("status")
    status = (str(st_raw).strip()[:50] if st_raw is not None else "") or "active"
    hd = e.get("hireDate")
    hire = None if hd is None or str(hd).strip() == "" else str(hd).strip()[:50]
    bd = e.get("birthDate")
    birth = None if bd is None or str(bd).strip() == "" else str(bd).strip()[:50]
    row = EmployeeInfo(
        id=eid,
        user_id=uid,
        department_id=dept,
        org_position_id=pos_id,
        full_name=full_name,
        status=status,
        position=full_name,
        hire_date=hire,
        birth_date=birth,
        is_archived=bool(e.get("isArchived", False)),
    )
    db.add(row)
    await db.flush()
    await log_entity_mutation(
        db,
        event_type="employee.created",
        entity_type="employee",
        entity_id=eid,
        source="employees-router",
        payload={"userId": row.user_id, "fullName": row.full_name, "status": row.status},
    )
    await db.commit()
    await db.refresh(row)
    return row_to_employee(row)


@router.patch("/{employee_id}", response_model=EmployeeRead, dependencies=[Depends(require_org_employees_edit)])
async def patch_employee(
    employee_id: str,
    body: EmployeeUpdate,
    db: AsyncSession = Depends(get_db),
):
    eid = str(employee_id).strip()[:36]
    row = await db.get(EmployeeInfo, eid)
    if row is None:
        raise HTTPException(status_code=404, detail="Сотрудник не найден")
    if not body.model_fields_set:
        return row_to_employee(row)
    _apply_employee_update(row, body)
    if row.full_name is None or str(row.full_name).strip() == "":
        row.full_name = "Сотрудник"
    if not row.status:
        row.status = "active"
    await db.flush()
    await log_entity_mutation(
        db,
        event_type="employee.updated",
        entity_type="employee",
        entity_id=eid,
        source="employees-router",
        payload={"fullName": row.full_name, "status": row.status, "isArchived": row.is_archived},
    )
    await db.commit()
    await db.refresh(row)
    return row_to_employee(row)


@router.delete("/{employee_id}", status_code=204, dependencies=[Depends(require_org_employees_edit)])
async def delete_employee(employee_id: str, db: AsyncSession = Depends(get_db)):
    """Архивирование (мягкое удаление)."""
    eid = str(employee_id).strip()[:36]
    row = await db.get(EmployeeInfo, eid)
    if row is None:
        raise HTTPException(status_code=404, detail="Сотрудник не найден")
    row.is_archived = True
    await db.flush()
    await log_entity_mutation(
        db,
        event_type="employee.archived",
        entity_type="employee",
        entity_id=eid,
        source="employees-router",
        payload={"isArchived": True},
    )
    await db.commit()


@router.put("", response_model=OkResponse, dependencies=[Depends(require_org_employees_edit)])
async def update_employees(employees: list[EmployeeBulkItem], db: AsyncSession = Depends(get_db)):
    """
    Массовая синхронизация. Удаления нет — только ``isArchived: true`` (архив).
    Поля: id, userId?, departmentId?, positionId (или orgPositionId), fullName, status, isArchived, hireDate?, birthDate?.
    """
    for item in employees:
        eid = str(item.id).strip()[:36]
        if not eid:
            continue
        existing = await db.get(EmployeeInfo, eid)
        is_new = existing is None
        if existing:
            _apply_employee_bulk_item(existing, item)
            if existing.full_name is None or str(existing.full_name).strip() == "":
                existing.full_name = "Сотрудник"
            if not existing.status:
                existing.status = "active"
        else:
            uid = _str_id(item.userId) if item.userId else None
            dept = _str_id(item.departmentId)
            pos_id = _str_id(item.positionId) or _str_id(item.orgPositionId)
            fn = item.fullName
            if fn is not None:
                full_name = str(fn).strip()[:255] or "Сотрудник"
            else:
                full_name = str(item.position or "").strip()[:255] or "Сотрудник"
            st_raw = item.status
            status = (str(st_raw).strip()[:50] if st_raw is not None else "") or "active"
            hd = item.hireDate
            hire = None if hd is None or str(hd).strip() == "" else str(hd).strip()[:50]
            bd = item.birthDate
            birth = None if bd is None or str(bd).strip() == "" else str(bd).strip()[:50]
            row = EmployeeInfo(
                id=eid,
                user_id=uid,
                department_id=dept,
                org_position_id=pos_id,
                full_name=full_name,
                status=status,
                position=full_name,
                hire_date=hire,
                birth_date=birth,
                is_archived=bool(item.isArchived),
            )
            db.add(row)
        await db.flush()
        row = await db.get(EmployeeInfo, eid)
        await log_entity_mutation(
            db,
            event_type="employee.created" if is_new else "employee.updated",
            entity_type="employee",
            entity_id=eid,
            source="employees-router",
            payload={
                "userId": row.user_id if row else item.userId,
                "fullName": row.full_name if row else item.fullName,
                "status": row.status if row else item.status,
                "isArchived": row.is_archived if row else item.isArchived,
            },
        )
    await db.commit()
    return {"ok": True}
