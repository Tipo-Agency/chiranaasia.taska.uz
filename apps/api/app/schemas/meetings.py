"""Pydantic-схемы для bulk PUT встреч."""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, model_validator


class MeetingParticipantRead(BaseModel):
    """Элемент participants во встрече (JSONB)."""

    model_config = ConfigDict(extra="allow")

    userId: str | None = Field(default=None, max_length=36)
    role: str | None = Field(default=None, max_length=50)


class MeetingBulkItem(BaseModel):
    """Элемент массовой синхронизации PUT /meetings."""

    model_config = ConfigDict(extra="forbid")

    id: str = Field(..., min_length=1, max_length=36)
    tableId: str | None = Field(default=None, max_length=100)
    title: str = Field(default="", max_length=500)
    date: str = Field(default="", max_length=50)
    time: str = Field(default="", max_length=10)
    participants: list[MeetingParticipantRead] | None = None
    participantIds: list[str] | None = None
    summary: str | None = None
    type: str = Field(default="work", max_length=50)
    dealId: str | None = Field(default=None, max_length=36)
    clientId: str | None = Field(default=None, max_length=36)
    projectId: str | None = Field(default=None, max_length=36)
    shootPlanId: str | None = Field(default=None, max_length=36)
    recurrence: str | None = Field(default=None, max_length=50)
    isArchived: bool = False
    updatedByUserId: str | None = Field(default=None, max_length=100)
    createdByUserId: str | None = Field(default=None, max_length=100)

    @model_validator(mode="before")
    @classmethod
    def _coerce_participants_str_entries(cls, data: object) -> object:
        """Строки в participants → { \"userId\": ... } (как в normalize_participants_payload)."""
        if not isinstance(data, dict):
            return data
        raw = data.get("participants")
        if raw is None or not isinstance(raw, list):
            return data
        out: list[object] = []
        for item in raw:
            if isinstance(item, str):
                uid = item.strip()[:36]
                if uid:
                    out.append({"userId": uid})
            else:
                out.append(item)
        data = dict(data)
        data["participants"] = out
        return data


class MeetingRead(BaseModel):
    """GET /meetings — формат как в row_to_meeting."""

    model_config = ConfigDict(extra="ignore")

    id: str
    tableId: str | None = None
    title: str | None = None
    date: str | None = None
    time: str | None = None
    participantIds: list[str] = Field(default_factory=list)
    participants: list[MeetingParticipantRead] = Field(default_factory=list)
    summary: str | None = None
    type: str | None = None
    dealId: str | None = None
    clientId: str | None = None
    projectId: str | None = None
    shootPlanId: str | None = None
    recurrence: str | None = None
    isArchived: bool = False
