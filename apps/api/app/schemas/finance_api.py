"""Схемы ответов GET /finance/* (не путать с телами bulk PUT из finance_bulk)."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class FinanceCategoryRead(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    name: str = ""
    type: str = ""
    value: Any = None
    color: str | None = None


class FinanceFundRead(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    name: str = ""
    order: Any = None
    isArchived: bool = False


class FinancePlanRowRead(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str | None = None
    period: str = ""
    salesPlan: Any = None
    currentIncome: Any = None


class FinancialPlanDocumentRead(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    departmentId: str = ""
    period: str = ""
    income: Any = None
    expenses: dict[str, Any] = Field(default_factory=dict)
    status: str = ""
    createdAt: str = ""
    updatedAt: str | None = None
    approvedBy: str | None = None
    approvedAt: str | None = None
    isArchived: bool = False


class FinancialPlanningRead(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    departmentId: str = ""
    period: str = ""
    planDocumentId: str | None = None
    income: Any = None
    fundAllocations: dict[str, Any] = Field(default_factory=dict)
    requestFundIds: dict[str, Any] = Field(default_factory=dict)
    requestIds: list[Any] = Field(default_factory=list)
    status: str = ""
    createdAt: str = ""
    updatedAt: str | None = None
    approvedBy: str | None = None
    approvedAt: str | None = None
    notes: str | None = None
    isArchived: bool = False


class BankStatementLineRead(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    statementId: str | None = None
    lineDate: str = ""
    description: str | None = None
    amount: Any = None
    lineType: str = "in"


class BankStatementRead(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    name: str | None = None
    period: str | None = None
    createdAt: str = ""
    lines: list[BankStatementLineRead] = Field(default_factory=list)


class IncomeReportRead(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    period: str = ""
    data: dict[str, Any] = Field(default_factory=dict)
    createdAt: str = ""
    updatedAt: str | None = None


class BdrGetResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    year: str
    rows: list[dict[str, Any]]
    totals: dict[str, Any]
