"""Pydantic-схемы клиентов: список с пагинацией, POST, PATCH (как GET /deals)."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.pagination import PaginatedResponse


def _normalize_camel_client_keys(data: Any) -> Any:
    if not isinstance(data, dict):
        return data
    key_map = {
        "companyName": "company_name",
        "isArchived": "is_archived",
    }
    out = dict(data)
    for camel, snake in key_map.items():
        if camel in out and snake not in out:
            out[snake] = out.pop(camel)
        elif camel in out and snake in out:
            out.pop(camel, None)
    return out


class ClientCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str | None = Field(default=None, max_length=36)
    name: str = Field(..., min_length=1, max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    email: str | None = Field(default=None, max_length=255)
    telegram: str | None = Field(default=None, max_length=100)
    instagram: str | None = Field(default=None, max_length=255)
    company_name: str | None = Field(default=None, max_length=255)
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
        return _normalize_camel_client_keys(data)


class ClientUpdate(BaseModel):
    """PATCH /clients/{id} — только переданные поля."""

    model_config = ConfigDict(extra="ignore")

    version: int | None = Field(
        default=None,
        ge=1,
        description="Ожидаемая версия (альтернатива If-Match).",
    )
    name: str | None = Field(default=None, min_length=1, max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    email: str | None = Field(default=None, max_length=255)
    telegram: str | None = Field(default=None, max_length=100)
    instagram: str | None = Field(default=None, max_length=255)
    company_name: str | None = Field(default=None, max_length=255)
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
        return _normalize_camel_client_keys(data)


class ClientRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    version: int = 1
    name: str
    phone: str | None = None
    email: str | None = None
    telegram: str | None = None
    instagram: str | None = None
    company_name: str | None = None
    notes: str | None = None
    tags: list[str] = Field(default_factory=list)
    is_archived: bool = False


class ClientListResponse(PaginatedResponse[ClientRead]):
    """GET /clients — пагинация по курсору."""

    pass


class ClientBulkItem(BaseModel):
    """Элемент массовой синхронизации PUT /clients."""

    model_config = ConfigDict(extra="forbid")

    id: str = Field(..., min_length=1, max_length=36)
    name: str = Field(default="", max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    email: str | None = Field(default=None, max_length=255)
    telegram: str | None = Field(default=None, max_length=100)
    instagram: str | None = Field(default=None, max_length=255)
    companyName: str | None = Field(default=None, max_length=255)
    notes: str | None = None
    tags: list[str] | None = None
    isArchived: bool = False
