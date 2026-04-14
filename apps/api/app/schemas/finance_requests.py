"""Pydantic-схемы заявок на оплату (GET/POST/PATCH /finance/requests)."""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.pagination import PaginatedResponse

FinanceRequestStatusLiteral = Literal["draft", "pending", "approved", "rejected", "paid", "deferred"]


class FinanceRequestRead(BaseModel):
    """Ответ API (camelCase, сумма строкой)."""

    model_config = ConfigDict(populate_by_name=True)

    id: str
    version: int = 1
    title: str
    amount: str
    currency: str = "UZS"
    category: str | None = None
    counterparty: str | None = None
    requested_by: str | None = Field(default=None, alias="requestedBy")
    approved_by: str | None = Field(default=None, alias="approvedBy")
    status: str
    comment: str | None = None
    payment_date: str | None = Field(default=None, alias="paymentDate")
    paid_at: str | None = Field(default=None, alias="paidAt")
    created_at: str | None = Field(default=None, alias="createdAt")
    updated_at: str | None = Field(default=None, alias="updatedAt")
    is_archived: bool = Field(default=False, alias="isArchived")
    requester_id: str | None = Field(default=None, alias="requesterId")
    category_id: str | None = Field(default=None, alias="categoryId")
    department_id: str | None = Field(default=None, alias="departmentId")
    description: str | None = None
    date: str | None = None
    decision_date: str | None = Field(default=None, alias="decisionDate")


class FinanceRequestListResponse(PaginatedResponse[FinanceRequestRead]):
    """GET /finance/requests."""

    pass


def _amount_to_decimal(v: Any) -> Decimal:
    if v is None:
        return Decimal("0.00")
    if isinstance(v, Decimal):
        return v.quantize(Decimal("0.01"))
    s = str(v).strip().replace(" ", "").replace(",", ".")
    try:
        return Decimal(s).quantize(Decimal("0.01"))
    except Exception:
        return Decimal("0.00")


class FinanceRequestCreate(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    id: str | None = Field(default=None, max_length=36)
    title: str = Field(..., min_length=1, max_length=500)
    amount: Decimal | str | int | float = Field(...)
    currency: str = Field(default="UZS", max_length=10)
    category: str | None = Field(default=None, max_length=100)
    category_id: str | None = Field(default=None, alias="categoryId", max_length=100)
    counterparty: str | None = Field(default=None, max_length=255)
    requested_by: str | None = Field(default=None, alias="requestedBy", max_length=36)
    requester_id: str | None = Field(default=None, alias="requesterId", max_length=36)
    department_id: str | None = Field(default=None, alias="departmentId", max_length=36)
    comment: str | None = None
    description: str | None = None
    payment_date: date | None = Field(default=None, alias="paymentDate")
    status: FinanceRequestStatusLiteral | str = Field(default="pending")
    is_archived: bool = Field(default=False, alias="isArchived")
    approved_by: str | None = Field(default=None, alias="approvedBy", max_length=36)

    @field_validator("amount", mode="before")
    @classmethod
    def _amount(cls, v: Any) -> Decimal:
        return _amount_to_decimal(v)


class FinanceRequestPatch(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    version: int | None = Field(
        default=None,
        ge=1,
        description="Ожидаемая версия (альтернатива If-Match).",
    )
    title: str | None = Field(default=None, max_length=500)
    amount: Decimal | str | int | float | None = None
    currency: str | None = Field(default=None, max_length=10)
    category: str | None = Field(default=None, max_length=100)
    category_id: str | None = Field(default=None, alias="categoryId", max_length=100)
    counterparty: str | None = Field(default=None, max_length=255)
    requested_by: str | None = Field(default=None, alias="requestedBy", max_length=36)
    requester_id: str | None = Field(default=None, alias="requesterId", max_length=36)
    approved_by: str | None = Field(default=None, alias="approvedBy", max_length=36)
    department_id: str | None = Field(default=None, alias="departmentId", max_length=36)
    comment: str | None = None
    description: str | None = None
    payment_date: date | None = Field(default=None, alias="paymentDate")
    status: FinanceRequestStatusLiteral | str | None = None
    is_archived: bool | None = Field(default=None, alias="isArchived")

    @field_validator("amount", mode="before")
    @classmethod
    def _amount(cls, v: Any) -> Any:
        if v is None:
            return None
        return _amount_to_decimal(v)
