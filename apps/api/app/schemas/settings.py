"""Pydantic-схемы для bulk PUT настроек: statuses, priorities, projects, departments, folders, tables, automation."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class StatusOptionItem(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(..., min_length=1, max_length=100)
    name: str = Field(default="", max_length=255)
    color: str = Field(default="", max_length=300)
    isArchived: bool = False


class PriorityOptionItem(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(..., min_length=1, max_length=100)
    name: str = Field(default="", max_length=255)
    color: str = Field(default="", max_length=300)
    isArchived: bool = False


class ProjectItem(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(..., min_length=1, max_length=100)
    name: str = Field(default="", max_length=500)
    icon: str | None = Field(default=None, max_length=200)
    color: str | None = Field(default=None, max_length=200)
    isArchived: bool = False


class ProjectRead(BaseModel):
    """GET /projects — как row_to_project."""

    model_config = ConfigDict(extra="ignore")

    id: str
    name: str = ""
    icon: str | None = None
    color: str | None = None
    isArchived: bool = False


class DepartmentItem(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(..., min_length=1, max_length=100)
    name: str = Field(default="", max_length=500)
    parentId: str | None = Field(default=None, max_length=100)
    headId: str | None = Field(default=None, max_length=100)
    description: str | None = None
    isArchived: bool = False


class DepartmentRead(BaseModel):
    """GET /departments — как row_to_dept."""

    model_config = ConfigDict(extra="ignore")

    id: str
    name: str = ""
    parentId: str | None = None
    headId: str | None = None
    description: str | None = None
    isArchived: bool = False


class FolderItem(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(..., min_length=1, max_length=100)
    tableId: str = Field(default="", max_length=100)
    name: str = Field(default="", max_length=500)
    parentFolderId: str | None = Field(default=None, max_length=100)
    isArchived: bool = False


class FolderRead(BaseModel):
    """GET /folders — как row_to_folder."""

    model_config = ConfigDict(extra="ignore")

    id: str
    tableId: str = ""
    name: str = ""
    parentFolderId: str | None = None
    isArchived: bool = False


class TableItem(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(..., min_length=1, max_length=100)
    name: str = Field(default="", max_length=500)
    type: str = Field(default="", max_length=100)
    icon: str | None = Field(default=None, max_length=200)
    color: str | None = Field(default=None, max_length=200)
    isSystem: bool = False
    isArchived: bool = False
    isPublic: bool = False


class TableRead(BaseModel):
    """GET /tables — как row_to_table."""

    model_config = ConfigDict(extra="ignore")

    id: str
    name: str = ""
    type: str = ""
    icon: str | None = None
    color: str | None = None
    isSystem: bool = False
    isArchived: bool = False
    isPublic: bool = False


class AutomationRuleRead(BaseModel):
    """GET /automation/rules — merge JSONB rule + id (произвольные ключи из rule)."""

    model_config = ConfigDict(extra="allow")

    id: str = Field(..., min_length=1, max_length=100)


class AutomationRuleItem(BaseModel):
    """Правило автоматизации: id обязателен, остальные поля — произвольный JSONB blob."""

    model_config = ConfigDict(extra="allow")

    id: str = Field(..., min_length=1, max_length=100)

    def rule_data(self) -> dict[str, Any]:
        """Все поля кроме id — тело правила для хранения в JSONB."""
        d = self.model_dump(mode="python")
        d.pop("id", None)
        return d
