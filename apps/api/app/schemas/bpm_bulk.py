"""Pydantic-схемы для bulk PUT BPM: должности и бизнес-процессы."""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, field_validator


class OrgPositionItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(..., min_length=1, max_length=100)
    title: str = Field(default="", max_length=500)
    departmentId: str | None = Field(default=None, max_length=100)
    managerPositionId: str | None = Field(default=None, max_length=100)
    holderUserId: str | None = Field(default=None, max_length=100)
    order: int = Field(default=0, ge=0)
    isArchived: bool = False
    taskAssigneeMode: str = Field(default="round_robin", max_length=50)
    lastTaskAssigneeUserId: str | None = Field(default=None, max_length=100)


class BpmStepBranchBulkItem(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str | None = Field(default=None, max_length=36)
    label: str = Field(default="", max_length=255)
    nextStepId: str | None = Field(default=None, max_length=36)


class BpmStepBulkItem(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str | None = Field(default=None, max_length=36)
    title: str = Field(default="", max_length=255)
    description: str | None = Field(default=None, max_length=500)
    assigneeType: str = Field(default="user", max_length=50)
    assigneeId: str | None = Field(default=None, max_length=36)
    order: int = Field(default=0, ge=0, le=999_999)
    stepType: str = Field(default="normal", max_length=20)
    nextStepId: str | None = Field(default=None, max_length=36)
    branches: list[BpmStepBranchBulkItem] = Field(default_factory=list)


class BpInstanceIncoming(BaseModel):
    """
    Элемент instances в PUT /bpm/processes: id, статус, шаг и поля контекста
    (сливаются в JSONB context на сервере).
    """

    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    id: str | None = Field(default=None, max_length=36)
    currentStepId: str | None = Field(default=None, max_length=36)
    status: str | None = Field(default=None, max_length=30)
    processVersion: int | None = Field(default=None, ge=0, le=999_999)
    startedAt: str | None = Field(default=None, max_length=100)
    completedAt: object | None = None
    taskIds: list[str] | None = None
    dealId: str | None = Field(default=None, max_length=120)
    dynamicSteps: object | None = None
    pendingBranchSelection: object | None = None
    completedStepIds: object | None = None
    branchHistory: object | None = None

    @field_validator("taskIds", mode="before")
    @classmethod
    def _coerce_task_ids(cls, v: object) -> list[str] | None:
        if v is None:
            return None
        if not isinstance(v, list):
            return None
        return [str(x) for x in v]


class BusinessProcessBulkItem(BaseModel):
    """Массовая синхронизация бизнес-процессов."""

    model_config = ConfigDict(extra="forbid")

    id: str = Field(..., min_length=1, max_length=36)
    version: int | str = Field(default=1)
    title: str = Field(default="", max_length=500)
    description: str | None = None
    isArchived: bool = False
    createdAt: str | None = Field(default=None, max_length=100)
    updatedAt: str | None = Field(default=None, max_length=100)
    steps: list[BpmStepBulkItem] = Field(default_factory=list)
    instances: list[BpInstanceIncoming] = Field(default_factory=list)
