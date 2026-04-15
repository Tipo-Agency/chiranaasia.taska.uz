"""Схемы CRM-контактов (лица у компаний-клиентов)."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.pagination import PaginatedResponse


def _normalize_camel_contact_keys(data: Any) -> Any:
    if not isinstance(data, dict):
        return data
    key_map = {
        "clientId": "client_id",
        "jobTitle": "job_title",
        "isArchived": "is_archived",
    }
    out = dict(data)
    for camel, snake in key_map.items():
        if camel in out and snake not in out:
            out[snake] = out.pop(camel)
        elif camel in out and snake in out:
            out.pop(camel, None)
    return out


class CrmContactCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str | None = Field(default=None, max_length=36)
    client_id: str | None = Field(default=None, max_length=36)
    name: str = Field(..., min_length=1, max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    email: str | None = Field(default=None, max_length=255)
    telegram: str | None = Field(default=None, max_length=100)
    instagram: str | None = Field(default=None, max_length=255)
    job_title: str | None = Field(default=None, max_length=255)
    notes: str | None = None
    tags: list[str] | None = None
    is_archived: bool = False

    @field_validator("name", mode="before")
    @classmethod
    def _strip_name(cls, v: Any) -> Any:
        if v is None:
            return v
        return str(v).strip()

    @model_validator(mode="before")
    @classmethod
    def _aliases(cls, data: Any) -> Any:
        return _normalize_camel_contact_keys(data)


class CrmContactUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    version: int | None = Field(
        default=None,
        ge=1,
        description="Ожидаемая версия (альтернатива If-Match).",
    )
    client_id: str | None = Field(default=None, max_length=36)
    name: str | None = Field(default=None, min_length=1, max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    email: str | None = Field(default=None, max_length=255)
    telegram: str | None = Field(default=None, max_length=100)
    instagram: str | None = Field(default=None, max_length=255)
    job_title: str | None = Field(default=None, max_length=255)
    notes: str | None = None
    tags: list[str] | None = None
    is_archived: bool | None = None

    @field_validator("name", mode="before")
    @classmethod
    def _strip_name(cls, v: Any) -> Any:
        if v is None:
            return v
        s = str(v).strip()
        return s if s else None

    @model_validator(mode="before")
    @classmethod
    def _aliases(cls, data: Any) -> Any:
        return _normalize_camel_contact_keys(data)


class CrmContactRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    version: int = 1
    client_id: str | None = None
    name: str
    phone: str | None = None
    email: str | None = None
    telegram: str | None = None
    instagram: str | None = None
    job_title: str | None = None
    notes: str | None = None
    tags: list[str] = Field(default_factory=list)
    is_archived: bool = False


class CrmContactListResponse(PaginatedResponse[CrmContactRead]):
    pass
