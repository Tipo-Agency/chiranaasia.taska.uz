"""Tasks router."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.task import Task
from app.utils import row_to_task

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
    await db.commit()
    return {"ok": True}
