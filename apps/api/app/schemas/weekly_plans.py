"""Pydantic-схемы для bulk PUT недельных планов и протоколов."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class WeeklyPlanItem(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(..., min_length=1, max_length=100)
    userId: str = Field(default="", max_length=100)
    weekStart: str = Field(default="", max_length=50)
    taskIds: list[str] = Field(default_factory=list)
    notes: str | None = None
    createdAt: str = Field(default="", max_length=100)
    updatedAt: str | None = Field(default=None, max_length=100)


class WeeklyPlanRead(BaseModel):
    """GET /weekly-plans — как _row_to_plan."""

    model_config = ConfigDict(extra="ignore")

    id: str
    userId: str = ""
    weekStart: str = ""
    taskIds: list[str] = Field(default_factory=list)
    notes: str | None = None
    createdAt: Any = None
    updatedAt: Any = None


class ProtocolRead(BaseModel):
    """GET /weekly-plans/protocols — как _row_to_protocol."""

    model_config = ConfigDict(extra="ignore")

    id: str
    title: str = ""
    weekStart: str = ""
    weekEnd: str | None = None
    departmentId: str | None = None
    participantIds: list[str] = Field(default_factory=list)
    plannedIncome: Any = None
    actualIncome: Any = None
    createdAt: Any = None
    updatedAt: Any = None


class ProtocolItem(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(..., min_length=1, max_length=100)
    title: str = Field(default="", max_length=500)
    weekStart: str = Field(default="", max_length=50)
    weekEnd: str | None = Field(default=None, max_length=50)
    departmentId: str | None = Field(default=None, max_length=100)
    participantIds: list[str] = Field(default_factory=list)
    plannedIncome: Any = None
    actualIncome: Any = None
    createdAt: str = Field(default="", max_length=100)
    updatedAt: str | None = Field(default=None, max_length=100)


class ProtocolAggregatedResponse(BaseModel):
    """GET /weekly-plans/protocols/{id}/aggregated."""

    model_config = ConfigDict(extra="forbid")

    protocol: ProtocolRead | None = None
    plans: list[WeeklyPlanRead] = Field(default_factory=list)
    taskIdsByUser: dict[str, list[str]] = Field(default_factory=dict)
