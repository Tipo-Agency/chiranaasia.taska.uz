"""Ответы POST /bp/* (экземпляр процесса)."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class BpInstanceResponse(BaseModel):
    """Как _instance_row_to_api (camelCase)."""

    model_config = ConfigDict(extra="ignore")

    id: str
    processId: str
    currentStepId: str | None = None
    status: str
    processVersion: Any = 1
    startedAt: str = ""
    taskIds: list[Any] = Field(default_factory=list)
    completedAt: Any = None
    dealId: Any = None
    dynamicSteps: Any = None
    pendingBranchSelection: Any = None
    completedStepIds: Any = None
    branchHistory: Any = None
