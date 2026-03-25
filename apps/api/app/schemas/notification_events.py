"""Schemas for centralized notification events."""
from __future__ import annotations
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field, field_validator


class DomainEventIn(BaseModel):
    """Incoming canonical domain event."""

    id: str = Field(default_factory=lambda: str(uuid4()))
    type: str = Field(..., min_length=3, max_length=120)
    occurredAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    actorId: str | None = None
    orgId: str = Field(..., min_length=1, max_length=36)
    entityType: str = Field(..., min_length=1, max_length=60)
    entityId: str = Field(..., min_length=1, max_length=120)
    source: str = Field(..., min_length=1, max_length=120)
    correlationId: str | None = Field(default=None, max_length=120)
    payload: dict[str, Any] = Field(default_factory=dict)

    @field_validator("occurredAt")
    @classmethod
    def ensure_tz(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value


class DomainEventOut(BaseModel):
    id: str
    published: bool
    streamId: str | None = None
