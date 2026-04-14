"""Pydantic-схемы для API сотрудников (camelCase в JSON)."""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.pagination import PaginatedResponse


class EmployeeRead(BaseModel):
    """GET /employees — элемент списка и карточка (camelCase)."""

    model_config = ConfigDict(extra="ignore")

    id: str
    userId: str | None = None
    departmentId: str | None = None
    positionId: str | None = None
    orgPositionId: str | None = None
    fullName: str = ""
    status: str = "active"
    isArchived: bool = False
    hireDate: str | None = None
    birthDate: str | None = None


class EmployeeListResponse(PaginatedResponse[EmployeeRead]):
    """GET /employees."""

    pass


class EmployeeCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str | None = None
    userId: str | None = None
    departmentId: str | None = None
    positionId: str | None = None
    orgPositionId: str | None = None
    fullName: str | None = None
    status: str | None = Field(default=None)
    hireDate: str | None = None
    birthDate: str | None = None
    isArchived: bool | None = None


class EmployeeUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    userId: str | None = None
    departmentId: str | None = None
    positionId: str | None = None
    orgPositionId: str | None = None
    fullName: str | None = None
    status: str | None = None
    hireDate: str | None = None
    birthDate: str | None = None
    isArchived: bool | None = None


class EmployeeBulkItem(BaseModel):
    """Элемент массовой синхронизации PUT /employees."""

    model_config = ConfigDict(extra="forbid")

    id: str = Field(..., min_length=1, max_length=36)
    userId: str | None = None
    departmentId: str | None = None
    positionId: str | None = None
    orgPositionId: str | None = None
    fullName: str | None = None
    position: str | None = None
    status: str | None = None
    hireDate: str | None = None
    birthDate: str | None = None
    isArchived: bool = False
