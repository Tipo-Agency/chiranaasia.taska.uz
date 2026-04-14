"""Pydantic-схемы для bulk PUT дебиторской задолженности."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class AccountsReceivableRead(BaseModel):
    """GET /accounts-receivable — как row_to_accounts_receivable."""

    model_config = ConfigDict(extra="ignore")

    id: str
    clientId: str | None = None
    dealId: str | None = None
    amount: Any = None
    currency: str = "UZS"
    dueDate: str | None = None
    status: str = ""
    description: str | None = None
    paidAmount: Any = None
    paidDate: str | None = None
    createdAt: str | None = None
    updatedAt: str | None = None
    isArchived: bool = False


class AccountsReceivableItem(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str | None = Field(default=None, max_length=36)
    clientId: str = Field(default="", max_length=36)
    dealId: str = Field(default="", max_length=36)
    amount: str | float | int | None = None
    currency: str = Field(default="UZS", max_length=10)
    dueDate: str = Field(default="", max_length=50)
    description: str = Field(default="", max_length=1000)
    paidAmount: str | float | int | None = None
    paidDate: str | None = Field(default=None, max_length=50)
    createdAt: str = Field(default="", max_length=100)
    updatedAt: str | None = Field(default=None, max_length=100)
    isArchived: bool = False
