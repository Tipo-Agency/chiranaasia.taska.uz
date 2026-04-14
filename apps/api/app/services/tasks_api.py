"""Маппинг ORM ↔ схемы задач, события (без list[dict] и динамического setattr)."""
from __future__ import annotations

from datetime import datetime, timezone

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task import Task
from app.models.user import User
from app.schemas.tasks import (
    TaskAttachmentRead,
    TaskBatchItem,
    TaskCommentRead,
    TaskCreate,
    TaskRead,
    TaskUpdate,
    UserShort,
)
from app.services.domain_events import DEFAULT_ORG_ID, emit_domain_event


def _user_short(u: User | None) -> UserShort | None:
    if u is None:
        return None
    return UserShort(id=u.id, name=u.name or "", avatar=u.avatar)


def _parse_task_comments(raw: object) -> list[TaskCommentRead]:
    if not isinstance(raw, list):
        return []
    out: list[TaskCommentRead] = []
    for c in raw:
        if not isinstance(c, dict):
            continue
        try:
            out.append(TaskCommentRead.model_validate(c))
        except ValidationError:
            continue
    return out


def _parse_task_attachments(raw: object) -> list[TaskAttachmentRead]:
    if not isinstance(raw, list):
        return []
    out: list[TaskAttachmentRead] = []
    for a in raw:
        if not isinstance(a, dict):
            continue
        try:
            out.append(TaskAttachmentRead.model_validate(a))
        except ValidationError:
            continue
    return out


def task_row_to_read(task: Task, users: dict[str, User]) -> TaskRead:
    comments = _parse_task_comments(task.comments)
    attachments = _parse_task_attachments(task.attachments)
    assignee = users.get(task.assignee_id) if task.assignee_id else None
    creator = users.get(task.created_by_user_id) if task.created_by_user_id else None
    return TaskRead(
        id=task.id,
        version=int(task.version) if getattr(task, "version", None) is not None else 1,
        title=task.title or "",
        description=task.description,
        status=task.status or "",
        priority=task.priority or None,
        table_id=task.table_id,
        assignee_id=task.assignee_id,
        assignee=_user_short(assignee),
        created_by=_user_short(creator),
        due_date=task.end_date or None,
        tags=[],
        comments_count=len(comments),
        attachments_count=len(attachments),
        created_at=task.created_at,
        updated_at=None,
        entity_type=task.entity_type or "task",
        assignee_ids=list(task.assignee_ids) if task.assignee_ids else [],
        project_id=task.project_id,
        start_date=task.start_date,
        end_date=task.end_date,
        is_archived=bool(task.is_archived),
        comments=comments,
        attachments=attachments,
        content_post_id=task.content_post_id,
        process_id=task.process_id,
        process_instance_id=task.process_instance_id,
        step_id=task.step_id,
        deal_id=task.deal_id,
        source=task.source,
        category=task.category,
        task_id=task.task_id,
        created_by_user_id=task.created_by_user_id,
        requester_id=task.requester_id,
        department_id=task.department_id,
        category_id=task.category_id,
        amount=task.amount,
        decision_date=task.decision_date,
    )


def collect_user_ids_for_tasks(tasks: list[Task]) -> set[str]:
    ids: set[str] = set()
    for t in tasks:
        if t.assignee_id:
            ids.add(t.assignee_id)
        if t.created_by_user_id:
            ids.add(t.created_by_user_id)
    return ids


async def load_users_by_ids(db: AsyncSession, ids: set[str]) -> dict[str, User]:
    if not ids:
        return {}
    result = await db.execute(select(User).where(User.id.in_(ids), User.is_archived.is_(False)))
    rows = result.scalars().all()
    return {u.id: u for u in rows}


async def build_reads(db: AsyncSession, tasks: list[Task]) -> list[TaskRead]:
    uids = collect_user_ids_for_tasks(tasks)
    users = await load_users_by_ids(db, uids)
    return [task_row_to_read(t, users) for t in tasks]


def apply_task_create_payload(body: TaskCreate, task_id: str) -> Task:
    now = datetime.now(timezone.utc).isoformat()
    return Task(
        id=task_id,
        version=1,
        table_id=body.table_id,
        entity_type="task",
        title=body.title.strip(),
        status=(body.status or "todo").strip(),
        priority=(body.priority or "").strip(),
        assignee_id=body.assignee_id,
        project_id=None,
        start_date=None,
        end_date=body.due_date,
        description=body.description,
        is_archived=False,
        comments=[],
        attachments=[],
        assignee_ids=[],
        created_at=now,
    )


def apply_task_patch_to_row(task: Task, patch: TaskUpdate) -> None:
    data = patch.model_dump(exclude_unset=True, exclude={"version"})
    if "title" in data and data["title"] is not None:
        task.title = data["title"].strip()
    if "description" in data:
        task.description = data["description"]
    if "status" in data and data["status"] is not None:
        task.status = data["status"].strip()
    if "priority" in data:
        task.priority = (data["priority"] or "").strip()
    if "assignee_id" in data:
        task.assignee_id = data["assignee_id"]
    if "due_date" in data:
        task.end_date = data["due_date"]
    if "is_archived" in data and data["is_archived"] is not None:
        task.is_archived = data["is_archived"]


def apply_batch_item_to_row(task: Task, item: TaskBatchItem) -> None:
    """Явное применение полей из batch (только переданные в JSON)."""
    data = item.model_dump(exclude={"id"}, exclude_unset=True)
    if "table_id" in data:
        task.table_id = data["table_id"]
    if "entity_type" in data and data["entity_type"] is not None:
        task.entity_type = data["entity_type"]
    if "title" in data and data["title"] is not None:
        task.title = data["title"]
    if "status" in data and data["status"] is not None:
        task.status = data["status"]
    if "priority" in data and data["priority"] is not None:
        task.priority = data["priority"]
    if "assignee_id" in data:
        task.assignee_id = data["assignee_id"]
    if "assignee_ids" in data and data["assignee_ids"] is not None:
        task.assignee_ids = data["assignee_ids"]
    if "project_id" in data:
        task.project_id = data["project_id"]
    if "start_date" in data:
        task.start_date = data["start_date"]
    if "end_date" in data:
        task.end_date = data["end_date"]
    if "description" in data:
        task.description = data["description"]
    if "is_archived" in data and data["is_archived"] is not None:
        task.is_archived = data["is_archived"]
    if "comments" in data and data["comments"] is not None:
        task.comments = [
            x.model_dump(mode="json") if isinstance(x, TaskCommentRead) else TaskCommentRead.model_validate(x).model_dump(mode="json")
            for x in data["comments"]
        ]
    if "attachments" in data and data["attachments"] is not None:
        task.attachments = [
            x.model_dump(mode="json") if isinstance(x, TaskAttachmentRead) else TaskAttachmentRead.model_validate(x).model_dump(mode="json")
            for x in data["attachments"]
        ]
    if "content_post_id" in data:
        task.content_post_id = data["content_post_id"]
    if "process_id" in data:
        task.process_id = data["process_id"]
    if "process_instance_id" in data:
        task.process_instance_id = data["process_instance_id"]
    if "step_id" in data:
        task.step_id = data["step_id"]
    if "deal_id" in data:
        task.deal_id = data["deal_id"]
    if "source" in data:
        task.source = data["source"]
    if "category" in data:
        task.category = data["category"]
    if "task_id" in data:
        task.task_id = data["task_id"]
    if "created_by_user_id" in data:
        task.created_by_user_id = data["created_by_user_id"]
    if "created_at" in data:
        task.created_at = data["created_at"]
    if "requester_id" in data:
        task.requester_id = data["requester_id"]
    if "department_id" in data:
        task.department_id = data["department_id"]
    if "category_id" in data:
        task.category_id = data["category_id"]
    if "amount" in data:
        v = data["amount"]
        task.amount = str(v) if v is not None else None
    if "decision_date" in data:
        task.decision_date = data["decision_date"]


def ensure_task_required_defaults(task: Task) -> None:
    if not task.title:
        task.title = ""
    if not task.status:
        task.status = "todo"
    if task.priority is None:
        task.priority = ""
    if task.comments is None:
        task.comments = []
    if task.attachments is None:
        task.attachments = []
    if task.assignee_ids is None:
        task.assignee_ids = []


def new_task_shell(task_id: str) -> Task:
    now = datetime.now(timezone.utc).isoformat()
    return Task(
        id=task_id,
        version=1,
        table_id=None,
        entity_type="task",
        title="",
        status="todo",
        priority="",
        assignee_id=None,
        project_id=None,
        start_date=None,
        end_date=None,
        description=None,
        is_archived=False,
        comments=[],
        attachments=[],
        assignee_ids=[],
        created_at=now,
    )


async def emit_task_events_after_change(
    db: AsyncSession,
    *,
    tid: str,
    existing_before: Task | None,
    after_assignee: str | None,
    after_title: str,
    after_status: str | None,
    after_priority: str | None,
    actor_id: str | None,
) -> None:
    prev_assignee = existing_before.assignee_id if existing_before else None
    prev_status = existing_before.status if existing_before else None

    if existing_before is None and after_assignee:
        await emit_domain_event(
            db,
            event_type="task.assigned",
            org_id=DEFAULT_ORG_ID,
            entity_type="task",
            entity_id=tid,
            source="tasks-router",
            actor_id=actor_id,
            payload={
                "taskId": tid,
                "title": after_title,
                "assigneeId": after_assignee,
                "priority": after_priority,
                "createdByUserId": actor_id,
            },
        )
    elif existing_before is not None and after_assignee and after_assignee != prev_assignee:
        await emit_domain_event(
            db,
            event_type="task.assigned",
            org_id=DEFAULT_ORG_ID,
            entity_type="task",
            entity_id=tid,
            source="tasks-router",
            actor_id=actor_id,
            payload={
                "taskId": tid,
                "title": after_title,
                "assigneeId": after_assignee,
                "priority": after_priority,
                "createdByUserId": actor_id,
            },
        )

    if existing_before is not None and (after_status or "") != (prev_status or ""):
        await emit_domain_event(
            db,
            event_type="task.status.changed",
            org_id=DEFAULT_ORG_ID,
            entity_type="task",
            entity_id=tid,
            source="tasks-router",
            actor_id=actor_id,
            payload={
                "taskId": tid,
                "title": after_title,
                "status": after_status,
                "assigneeId": after_assignee,
                "createdByUserId": actor_id,
            },
        )
