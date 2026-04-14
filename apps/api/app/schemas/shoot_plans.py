"""Pydantic-схемы для bulk PUT планов съёмки."""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class ShootCalendarParticipant(BaseModel):
    """Одна строка participants при синхронизации встречи из плана съёмки."""

    model_config = ConfigDict(extra="forbid")

    userId: str = Field(..., min_length=1, max_length=36)


class ShootPlanRead(BaseModel):
    """GET /shoot-plans — как _row_to_dict."""

    model_config = ConfigDict(extra="ignore")

    id: str
    tableId: str = ""
    title: str = ""
    date: str = ""
    time: str = ""
    participantIds: list[str] = Field(default_factory=list)
    items: list[dict[str, object]] = Field(default_factory=list)
    meetingId: str | None = None
    isArchived: bool = False


class ShootPlanItem(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(..., min_length=1, max_length=100)
    tableId: str = Field(default="", max_length=100)
    title: str = Field(default="", max_length=500)
    date: str = Field(default="", max_length=50)
    time: str = Field(default="10:00", max_length=10)
    participantIds: list[str] = Field(default_factory=list)
    items: list[dict[str, object]] = Field(default_factory=list)
    isArchived: bool = False
