"""Pydantic-схемы задач (контракт docs/API.md § Tasks)."""
from __future__ import annotations

from typing import Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field

from app.schemas.pagination import PaginatedResponse


class TaskCommentRead(BaseModel):
    """Комментарий задачи (JSONB comments); при чтении допускаются ключи snake_case или camelCase."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    id: str
    task_id: str = Field(validation_alias=AliasChoices("task_id", "taskId"))
    user_id: str = Field(validation_alias=AliasChoices("user_id", "userId"))
    text: str
    created_at: str = Field(validation_alias=AliasChoices("created_at", "createdAt"))
    is_system: bool = Field(default=False, validation_alias=AliasChoices("is_system", "isSystem"))
    attachment_id: str | None = Field(default=None, validation_alias=AliasChoices("attachment_id", "attachmentId"))


class TaskAttachmentRead(BaseModel):
    """Вложение задачи (JSONB attachments). Поле «тип файла» в API — mime_type (в старых данных мог быть type)."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    id: str
    task_id: str = Field(validation_alias=AliasChoices("task_id", "taskId"))
    name: str
    url: str
    mime_type: str = Field(
        default="",
        validation_alias=AliasChoices("mime_type", "type", "mimeType"),
    )
    uploaded_at: str = Field(default="", validation_alias=AliasChoices("uploaded_at", "uploadedAt"))
    doc_id: str | None = Field(default=None, validation_alias=AliasChoices("doc_id", "docId"))
    attachment_type: Literal["file", "doc"] | None = Field(
        default=None,
        validation_alias=AliasChoices("attachment_type", "attachmentType"),
    )
    storage_path: str | None = Field(default=None, validation_alias=AliasChoices("storage_path", "storagePath"))


class UserShort(BaseModel):
    """Краткое представление пользователя в ответах."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    avatar: str | None = None


class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    table_id: str = Field(..., min_length=1, max_length=36)
    description: str | None = None
    status: str | None = Field(default="todo", max_length=100)
    priority: str | None = Field(default=None, max_length=100)
    assignee_id: str | None = Field(default=None, max_length=36)
    due_date: str | None = Field(default=None, max_length=10, description="YYYY-MM-DD")
    tags: list[str] | None = None


class TaskUpdate(BaseModel):
    """PATCH /tasks/{id} — только переданные поля."""

    version: int | None = Field(
        default=None,
        ge=1,
        description="Ожидаемая версия сущности (альтернатива заголовку If-Match).",
    )
    title: str | None = Field(default=None, min_length=1, max_length=500)
    description: str | None = None
    status: str | None = Field(default=None, max_length=100)
    priority: str | None = Field(default=None, max_length=100)
    assignee_id: str | None = None
    due_date: str | None = Field(default=None, max_length=10)
    tags: list[str] | None = None
    position: int | None = None
    is_archived: bool | None = None


class TaskRead(BaseModel):
    """
    Ответ по API.md + расширенные поля приложения (воронки, BPM, заявки).
    Имена полей — snake_case как в API.md.
    """

    model_config = ConfigDict(from_attributes=True)

    id: str
    version: int = 1
    title: str
    description: str | None = None
    status: str
    priority: str | None = None
    table_id: str | None = None
    assignee_id: str | None = None
    assignee: UserShort | None = None
    created_by: UserShort | None = None
    due_date: str | None = None
    tags: list[str] = Field(default_factory=list)
    comments_count: int = 0
    attachments_count: int = 0
    created_at: str | None = None
    updated_at: str | None = None
    # Расширения (не в краткой таблице API.md, но нужны клиенту)
    entity_type: str = "task"
    assignee_ids: list[str] = Field(default_factory=list)
    project_id: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    is_archived: bool = False
    comments: list[TaskCommentRead] = Field(default_factory=list)
    attachments: list[TaskAttachmentRead] = Field(default_factory=list)
    content_post_id: str | None = None
    process_id: str | None = None
    process_instance_id: str | None = None
    step_id: str | None = None
    deal_id: str | None = None
    source: str | None = None
    category: str | None = None
    task_id: str | None = None
    created_by_user_id: str | None = None
    requester_id: str | None = None
    department_id: str | None = None
    category_id: str | None = None
    amount: str | None = None
    decision_date: str | None = None


class TaskListResponse(PaginatedResponse[TaskRead]):
    """GET /tasks — пагинация по курсору."""

    pass


class TaskBatchItem(BaseModel):
    """Элемент PUT /tasks/batch: id обязателен, остальное — только если передано в JSON."""

    id: str = Field(..., min_length=1, max_length=36)
    table_id: str | None = Field(default=None, max_length=36)
    entity_type: str | None = Field(default=None, max_length=30)
    title: str | None = Field(default=None, max_length=500)
    status: str | None = Field(default=None, max_length=100)
    priority: str | None = Field(default=None, max_length=100)
    assignee_id: str | None = Field(default=None, max_length=36)
    assignee_ids: list[str] | None = None
    project_id: str | None = Field(default=None, max_length=36)
    start_date: str | None = Field(default=None, max_length=10)
    end_date: str | None = Field(default=None, max_length=10)
    description: str | None = None
    is_archived: bool | None = None
    comments: list[TaskCommentRead] | None = None
    attachments: list[TaskAttachmentRead] | None = None
    content_post_id: str | None = Field(default=None, max_length=36)
    process_id: str | None = Field(default=None, max_length=36)
    process_instance_id: str | None = Field(default=None, max_length=36)
    step_id: str | None = Field(default=None, max_length=36)
    deal_id: str | None = Field(default=None, max_length=36)
    source: str | None = Field(default=None, max_length=100)
    category: str | None = Field(default=None, max_length=100)
    task_id: str | None = Field(default=None, max_length=36)
    created_by_user_id: str | None = Field(default=None, max_length=36)
    created_at: str | None = Field(default=None, max_length=50)
    requester_id: str | None = Field(default=None, max_length=36)
    department_id: str | None = Field(default=None, max_length=36)
    category_id: str | None = Field(default=None, max_length=36)
    amount: str | None = Field(default=None, max_length=50)
    decision_date: str | None = Field(default=None, max_length=50)
    tags: list[str] | None = None


class TaskBatchResponse(BaseModel):
    ok: bool = True
    updated: int


class TaskDeleteResponse(BaseModel):
    ok: bool = True
