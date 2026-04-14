"""Ответы GET /bpm (должности, процессы)."""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, field_validator


class OrgPositionRead(BaseModel):
    """Как row_to_position."""

    model_config = ConfigDict(extra="ignore")

    id: str
    title: str = ""
    departmentId: str | None = None
    managerPositionId: str | None = None
    holderUserId: str | None = None
    order: int | str | None = None
    isArchived: bool = False
    taskAssigneeMode: str = "round_robin"
    lastTaskAssigneeUserId: str | None = None


class BpmStepBranchRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    label: str = ""
    nextStepId: str | None = None


class BpmStepRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    title: str = ""
    description: str | None = None
    assigneeType: str = ""
    assigneeId: str | None = None
    order: int = 0
    stepType: str = ""
    nextStepId: str | None = None
    branches: list[BpmStepBranchRead] = Field(default_factory=list)

    @field_validator("order", mode="before")
    @classmethod
    def _order_int(cls, v: object) -> int:
        try:
            return int(v) if v is not None else 0
        except (TypeError, ValueError):
            return 0


class BpInstanceRead(BaseModel):
    """Снимок bp_instances + плоские поля из context (как _instance_row_to_api)."""

    model_config = ConfigDict(extra="forbid")

    id: str
    processId: str
    currentStepId: str | None = None
    status: str = "active"
    processVersion: int = 1
    startedAt: str = ""
    taskIds: list[str] = Field(default_factory=list)
    completedAt: object | None = None
    dealId: object | None = None
    dynamicSteps: object | None = None
    pendingBranchSelection: object | None = None
    completedStepIds: object | None = None
    branchHistory: object | None = None

    @field_validator("taskIds", mode="before")
    @classmethod
    def _coerce_task_ids(cls, v: object) -> list[str]:
        if not isinstance(v, list):
            return []
        return [str(x) for x in v]


class BusinessProcessRead(BaseModel):
    """Как row_to_process."""

    model_config = ConfigDict(extra="forbid")

    id: str
    version: int = 1
    title: str = ""
    description: str | None = None
    steps: list[BpmStepRead] = Field(default_factory=list)
    instances: list[BpInstanceRead] = Field(default_factory=list)
    isArchived: bool = False
    createdAt: str | None = None
    updatedAt: str | None = None
