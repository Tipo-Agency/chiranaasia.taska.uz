"""Ответы роутера /auth (роли, каталог прав)."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class PermissionsCatalogResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    groups: list[Any]
    allKeys: list[str]


class RoleApiRow(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    name: str
    slug: str
    description: str | None = None
    isSystem: bool = False
    sortOrder: int | None = None
    permissions: list[str] = Field(default_factory=list)
