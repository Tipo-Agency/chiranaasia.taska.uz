"""Tasks router — контракт docs/API.md § Tasks (пагинация, фильтры, Pydantic, PUT /batch)."""
from __future__ import annotations

import uuid
from types import SimpleNamespace
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from sqlalchemy import asc, desc, func, nullslast, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user, require_permission
from app.core.optimistic_version import (
    commit_or_stale_version_conflict,
    enforce_expected_version_row,
    merge_expected_version,
    parse_if_match_header,
)
from app.core.permissions import PERM_TASKS_EDIT
from app.db import get_db
from app.models.task import Task
from app.schemas.tasks import (
    TaskBatchItem,
    TaskBatchResponse,
    TaskCreate,
    TaskDeleteResponse,
    TaskListResponse,
    TaskRead,
    TaskUpdate,
)
from app.services.audit_log import log_mutation
from app.services.list_cursor_page import (
    ListCursorError,
    assert_cursor_matches,
    build_seek_after,
    decode_list_cursor,
    encode_list_cursor,
    filter_fingerprint,
    row_seek_values,
)
from app.services.tasks_api import (
    apply_batch_item_to_row,
    apply_task_create_payload,
    apply_task_patch_to_row,
    build_reads,
    emit_task_events_after_change,
    ensure_task_required_defaults,
    new_task_shell,
    task_row_to_read,
)
from app.services.tasks_api import load_users_by_ids as load_users_map

router = APIRouter(prefix="/tasks", tags=["tasks"], dependencies=[Depends(get_current_user)])

require_tasks_edit = require_permission(PERM_TASKS_EDIT, detail="tasks_edit_required")


def _request_id(request: Request) -> str | None:
    return getattr(request.state, "request_id", None)

_MAX_BATCH = 100
_DEFAULT_LIMIT = 50
_MAX_LIMIT = 500

_TASK_SORT_FIELDS = frozenset({"created_at", "updated_at", "due_date", "priority", "status", "title"})


def _sort_column(name: str):
    key = (name or "created_at").strip()
    m = {
        "created_at": Task.created_at,
        "updated_at": Task.created_at,  # в ORM нет updated_at — тот же столбец, см. docs/API.md §5
        "due_date": Task.end_date,
        "priority": Task.priority,
        "status": Task.status,
        "title": Task.title,
    }
    return m[key]


def _build_filter_conditions(
    *,
    table_id: str | None,
    status: str | None,
    priority: str | None,
    assignee_id: str | None,
    is_archived: bool | None,
    due_before: str | None,
    due_after: str | None,
    search: str | None,
) -> list:
    conds = []
    if table_id:
        conds.append(Task.table_id == table_id)
    if status is not None:
        conds.append(Task.status == status)
    if priority is not None:
        conds.append(Task.priority == priority)
    if assignee_id is not None:
        conds.append(Task.assignee_id == assignee_id)
    if is_archived is None:
        conds.append(Task.is_archived.is_(False))
    else:
        conds.append(Task.is_archived.is_(bool(is_archived)))
    if due_before:
        conds.append(Task.end_date.is_not(None))
        conds.append(Task.end_date <= due_before)
    if due_after:
        conds.append(Task.end_date.is_not(None))
        conds.append(Task.end_date >= due_after)
    if search and search.strip():
        conds.append(Task.title.ilike(f"%{search.strip()}%"))
    return conds


def _task_order_spec(sort: str | None, order: str | None):
    sort_parts = [s.strip() for s in (sort or "created_at").split(",") if s.strip()]
    if not sort_parts:
        sort_parts = ["created_at"]
    for sf in sort_parts:
        if sf not in _TASK_SORT_FIELDS:
            raise HTTPException(
                status_code=422,
                detail=f"Недопустимое поле сортировки: {sf}. Допустимо: {', '.join(sorted(_TASK_SORT_FIELDS))}",
            )
    order_parts = [o.strip().lower() for o in (order or "desc").split(",") if o.strip()]
    while len(order_parts) < len(sort_parts):
        order_parts.append(order_parts[-1] if order_parts else "desc")
    cols = []
    dirs = []
    for sf, of in zip(sort_parts, order_parts):
        cols.append(_sort_column(sf))
        dirs.append("asc" if of == "asc" else "desc")
    cols.append(Task.id)
    dirs.append("desc")
    sp = sort_parts + ["id"]
    op = dirs
    return sp, op, cols, dirs


def _order_by_clauses(sort: str | None, order: str | None):
    _, _, cols, dirs = _task_order_spec(sort, order)
    clauses = []
    for col, d in zip(cols, dirs):
        if d == "asc":
            clauses.append(nullslast(asc(col)))
        else:
            clauses.append(nullslast(desc(col)))
    return clauses


def _tasks_list_fingerprint(
    *,
    table_id: str | None,
    status: str | None,
    priority: str | None,
    assignee_id: str | None,
    is_archived: bool | None,
    due_before: str | None,
    due_after: str | None,
    search: str | None,
) -> str:
    arch = "false" if is_archived is None or not is_archived else "true"
    return filter_fingerprint(
        {
            "table_id": (table_id or "").strip(),
            "status": (status or "").strip(),
            "priority": (priority or "").strip(),
            "assignee_id": (assignee_id or "").strip(),
            "is_archived": arch,
            "due_before": (due_before or "").strip(),
            "due_after": (due_after or "").strip(),
            "search": (search or "").strip(),
        }
    )


@router.get("", response_model=TaskListResponse)
async def list_tasks(
    db: AsyncSession = Depends(get_db),
    limit: Annotated[int, Query(ge=1, le=_MAX_LIMIT)] = _DEFAULT_LIMIT,
    cursor: str | None = None,
    table_id: str | None = None,
    status: str | None = None,
    priority: str | None = None,
    assignee_id: str | None = None,
    is_archived: bool | None = None,
    due_before: str | None = None,
    due_after: str | None = None,
    search: str | None = None,
    sort: str | None = None,
    order: str | None = None,
):
    conds = _build_filter_conditions(
        table_id=table_id,
        status=status,
        priority=priority,
        assignee_id=assignee_id,
        is_archived=is_archived,
        due_before=due_before,
        due_after=due_after,
        search=search,
    )
    cnt_stmt = select(func.count()).select_from(Task)
    if conds:
        cnt_stmt = cnt_stmt.where(*conds)
    total = int((await db.execute(cnt_stmt)).scalar_one())

    sp, op, cols, dirs = _task_order_spec(sort, order)
    fh = _tasks_list_fingerprint(
        table_id=table_id,
        status=status,
        priority=priority,
        assignee_id=assignee_id,
        is_archived=is_archived,
        due_before=due_before,
        due_after=due_after,
        search=search,
    )
    seek = None
    if cursor and cursor.strip():
        try:
            payload = decode_list_cursor(cursor)
            vals = assert_cursor_matches(
                payload,
                resource="tasks",
                sort_parts=sp,
                order_parts=op,
                fingerprint=fh,
            )
            seek = build_seek_after(cols, dirs, vals)
        except ListCursorError:
            raise HTTPException(status_code=400, detail="invalid_cursor") from None

    stmt = select(Task)
    if conds:
        stmt = stmt.where(*conds)
    if seek is not None:
        stmt = stmt.where(seek)
    stmt = stmt.order_by(*_order_by_clauses(sort, order)).limit(limit)
    result = await db.execute(stmt)
    rows = list(result.scalars().all())
    items = await build_reads(db, rows)
    next_c = None
    if rows and len(rows) == limit:
        next_c = encode_list_cursor(
            {
                "r": "tasks",
                "sp": sp,
                "op": op,
                "fh": fh,
                "vals": row_seek_values(cols, rows[-1]),
            }
        )
    return TaskListResponse(items=items, total=total, limit=limit, next_cursor=next_c)


@router.post("", response_model=TaskRead, status_code=201, dependencies=[Depends(require_tasks_edit)])
async def create_task(
    body: TaskCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    tid = str(uuid.uuid4())
    row = apply_task_create_payload(body, tid)
    ensure_task_required_defaults(row)
    db.add(row)
    await db.flush()
    await emit_task_events_after_change(
        db,
        tid=tid,
        existing_before=None,
        after_assignee=row.assignee_id,
        after_title=row.title or "",
        after_status=row.status,
        after_priority=row.priority,
        actor_id=row.created_by_user_id,
    )
    await log_mutation(
        db,
        "create",
        "task",
        tid,
        actor_id=row.created_by_user_id,
        source="tasks-router",
        request_id=_request_id(request),
        payload={"title": row.title, "status": row.status},
    )
    await db.commit()
    await db.refresh(row)
    users = await load_users_map(db, collect_ids_one(row))
    return task_row_to_read(row, users)


def collect_ids_one(row: Task) -> set[str]:
    s: set[str] = set()
    if row.assignee_id:
        s.add(row.assignee_id)
    if row.created_by_user_id:
        s.add(row.created_by_user_id)
    return s


@router.put("/batch", response_model=TaskBatchResponse, dependencies=[Depends(require_tasks_edit)])
async def batch_update_tasks(
    body: list[TaskBatchItem],
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    if len(body) > _MAX_BATCH:
        raise HTTPException(status_code=422, detail=f"Не более {_MAX_BATCH} задач за запрос")
    updated = 0
    for item in body:
        tid = item.id
        row_orm = await db.get(Task, tid)
        before = (
            SimpleNamespace(assignee_id=row_orm.assignee_id, status=row_orm.status)
            if row_orm
            else None
        )
        if row_orm:
            apply_batch_item_to_row(row_orm, item)
            ensure_task_required_defaults(row_orm)
            row = row_orm
        else:
            row = new_task_shell(tid)
            apply_batch_item_to_row(row, item)
            ensure_task_required_defaults(row)
            db.add(row)
        await db.flush()
        updated += 1

        actor_id = item.created_by_user_id if "created_by_user_id" in item.model_fields_set else None
        if actor_id is None:
            actor_id = row.created_by_user_id

        await emit_task_events_after_change(
            db,
            tid=tid,
            existing_before=before,
            after_assignee=row.assignee_id,
            after_title=row.title or "",
            after_status=row.status,
            after_priority=row.priority,
            actor_id=actor_id,
        )
        await log_mutation(
            db,
            "create" if before is None else "update",
            "task",
            tid,
            actor_id=actor_id,
            source="tasks-router",
            request_id=_request_id(request),
            payload={"title": row.title, "status": row.status},
        )
    await commit_or_stale_version_conflict(db)
    return TaskBatchResponse(updated=updated)


@router.get("/{task_id}", response_model=TaskRead)
async def get_task(task_id: str, db: AsyncSession = Depends(get_db)):
    row = await db.get(Task, task_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Задача не найдена")
    users = await load_users_map(db, collect_ids_one(row))
    return task_row_to_read(row, users)


@router.patch("/{task_id}", response_model=TaskRead, dependencies=[Depends(require_tasks_edit)])
async def patch_task(
    task_id: str,
    body: TaskUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    if_match: str | None = Header(default=None, alias="If-Match"),
):
    row = await db.get(Task, task_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Задача не найдена")
    exp = merge_expected_version(
        if_match=parse_if_match_header(if_match),
        body_version=body.version if "version" in body.model_fields_set else None,
    )
    enforce_expected_version_row(row_version=int(row.version), expected=exp)
    before = SimpleNamespace(assignee_id=row.assignee_id, status=row.status)
    apply_task_patch_to_row(row, body)
    ensure_task_required_defaults(row)
    await db.flush()
    await emit_task_events_after_change(
        db,
        tid=task_id,
        existing_before=before,
        after_assignee=row.assignee_id,
        after_title=row.title or "",
        after_status=row.status,
        after_priority=row.priority,
        actor_id=row.created_by_user_id,
    )
    await log_mutation(
        db,
        "update",
        "task",
        task_id,
        actor_id=row.created_by_user_id,
        source="tasks-router",
        request_id=_request_id(request),
        payload={"title": row.title, "status": row.status},
    )
    await commit_or_stale_version_conflict(db)
    await db.refresh(row)
    users = await load_users_map(db, collect_ids_one(row))
    return task_row_to_read(row, users)


@router.delete("/{task_id}", response_model=TaskDeleteResponse, dependencies=[Depends(require_tasks_edit)])
async def delete_task(
    task_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    row = await db.get(Task, task_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Задача не найдена")
    await log_mutation(
        db,
        "delete",
        "task",
        task_id,
        actor_id=row.created_by_user_id,
        source="tasks-router",
        request_id=_request_id(request),
        payload={"title": row.title},
    )
    await db.delete(row)
    await db.commit()
    return TaskDeleteResponse()
