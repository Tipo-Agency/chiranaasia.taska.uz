"""Pydantic-схемы для bulk PUT склада и движения товаров."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class WarehouseItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(..., min_length=1, max_length=100)
    name: str = Field(default="", max_length=500)
    departmentId: str | None = Field(default=None, max_length=100)
    location: str | None = None
    isDefault: bool = False
    isArchived: bool = False
    updatedByUserId: str | None = Field(default=None, max_length=100)


class InventoryItemSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(..., min_length=1, max_length=100)
    sku: str = Field(default="", max_length=200)
    name: str = Field(default="", max_length=500)
    unit: str = Field(default="", max_length=50)
    category: str | None = Field(default=None, max_length=200)
    notes: str | None = None
    isArchived: bool = False
    updatedByUserId: str | None = Field(default=None, max_length=100)


class StockMovementLineItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    itemId: str = Field(..., min_length=1, max_length=100)
    quantity: Any = None


class StockMovementItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(..., min_length=1, max_length=100)
    type: str = Field(default="", max_length=50)
    date: str = Field(default="", max_length=50)
    fromWarehouseId: str | None = Field(default=None, max_length=100)
    toWarehouseId: str | None = Field(default=None, max_length=100)
    items: list[StockMovementLineItem] = Field(default_factory=list)
    reason: str | None = None
    createdByUserId: str = Field(default="", max_length=100)


class InventoryRevisionLineItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    itemId: str = Field(..., min_length=1, max_length=100)
    quantitySystem: Any = None
    quantityFact: Any = None


class InventoryRevisionItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(..., min_length=1, max_length=100)
    number: str = Field(default="", max_length=100)
    warehouseId: str = Field(default="", max_length=100)
    date: str = Field(default="", max_length=50)
    status: str = Field(default="draft", max_length=50)
    lines: list[InventoryRevisionLineItem] = Field(default_factory=list)
    reason: str | None = None
    createdByUserId: str = Field(default="", max_length=100)
    postedAt: str | None = Field(default=None, max_length=100)


# --- Ответы GET (row_to_*), extra=ignore — лишние колонки ORM не ломают ответ ---


class WarehouseRead(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    name: str = ""
    departmentId: str | None = None
    location: str | None = None
    isDefault: bool = False
    isArchived: bool = False


class InventoryItemRead(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    sku: str = ""
    name: str = ""
    unit: str = ""
    category: str | None = None
    notes: str | None = None
    isArchived: bool = False


class StockMovementRead(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    type: str = ""
    date: str = ""
    fromWarehouseId: str | None = None
    toWarehouseId: str | None = None
    items: list[Any] = Field(default_factory=list)
    reason: str | None = None
    createdByUserId: str = ""


class InventoryRevisionRead(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    number: str = ""
    warehouseId: str = ""
    date: str = ""
    status: str = ""
    lines: list[Any] = Field(default_factory=list)
    reason: str | None = None
    createdByUserId: str = ""
    postedAt: str | None = None
