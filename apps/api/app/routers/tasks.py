"""Tasks router."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.task import Task
from app.utils import row_to_task
from app.services.domain_events import emit_domain_event

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("")
async def get_tasks(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Task))
    tasks = result.scalars().all()
    return [row_to_task(t) for t in tasks]


@router.put("")
async def update_tasks(tasks: list[dict], db: AsyncSession = Depends(get_db)):
    for t in tasks:
        tid = t.get("id")
        if not tid:
            continue
        existing = await db.get(Task, tid)
        prev_assignee = existing.assignee_id if existing else None
        prev_status = existing.status if existing else None
        data = {k: v for k, v in t.items() if v is not None}
        if existing:
            for k, v in data.items():
                snake = k[0].lower() + "".join("_" + c.lower() if c.isupper() else c for c in k[1:])
                if hasattr(existing, snake):
                    setattr(existing, snake, v)
            if "assigneeIds" in data:
                existing.assignee_ids = data["assigneeIds"]
        else:
            db.add(Task(
                id=tid,
                table_id=data.get("tableId"),
                entity_type=data.get("entityType", "task"),
                title=data.get("title", ""),
                status=data.get("status", ""),
                priority=data.get("priority", ""),
                assignee_id=data.get("assigneeId"),
                project_id=data.get("projectId"),
                start_date=data.get("startDate", ""),
                end_date=data.get("endDate", ""),
                description=data.get("description"),
                is_archived=data.get("isArchived", False),
                comments=data.get("comments", []),
                attachments=data.get("attachments", []),
                assignee_ids=data.get("assigneeIds", []),
                content_post_id=data.get("contentPostId"),
                process_id=data.get("processId"),
                process_instance_id=data.get("processInstanceId"),
                step_id=data.get("stepId"),
                deal_id=data.get("dealId"),
                source=data.get("source"),
                category=data.get("category"),
                task_id=data.get("taskId"),
                created_by_user_id=data.get("createdByUserId"),
                created_at=data.get("createdAt"),
                requester_id=data.get("requesterId"),
                department_id=data.get("departmentId"),
                category_id=data.get("categoryId"),
                amount=str(data.get("amount")) if data.get("amount") is not None else None,
                decision_date=data.get("decisionDate"),
            ))
        await db.flush()

        # Domain events for notification hub
        assignee_id = data.get("assigneeId", (existing.assignee_id if existing else None))
        title = data.get("title", (existing.title if existing else ""))
        actor_id = data.get("createdByUserId") or data.get("requesterId")

        if existing is None and assignee_id:
            await emit_domain_event(
                db,
                event_type="task.assigned",
                org_id="default",
                entity_type="task",
                entity_id=tid,
                source="tasks-router",
                actor_id=actor_id,
                payload={
                    "taskId": tid,
                    "title": title,
                    "assigneeId": assignee_id,
                    "priority": data.get("priority"),
                    "createdByUserId": data.get("createdByUserId"),
                },
            )
        elif existing and assignee_id and assignee_id != prev_assignee:
            await emit_domain_event(
                db,
                event_type="task.assigned",
                org_id="default",
                entity_type="task",
                entity_id=tid,
                source="tasks-router",
                actor_id=actor_id,
                payload={
                    "taskId": tid,
                    "title": title,
                    "assigneeId": assignee_id,
                    "priority": data.get("priority", existing.priority),
                    "createdByUserId": data.get("createdByUserId", existing.created_by_user_id),
                },
            )

        current_status = data.get("status", (existing.status if existing else None))
        if existing and current_status and current_status != prev_status:
            await emit_domain_event(
                db,
                event_type="task.status.changed",
                org_id="default",
                entity_type="task",
                entity_id=tid,
                source="tasks-router",
                actor_id=actor_id,
                payload={
                    "taskId": tid,
                    "title": title,
                    "status": current_status,
                    "assigneeId": data.get("assigneeId", existing.assignee_id),
                    "createdByUserId": data.get("createdByUserId", existing.created_by_user_id),
                },
            )
    await db.commit()
    return {"ok": True}
