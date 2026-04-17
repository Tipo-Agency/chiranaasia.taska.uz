"""Pydantic-схемы для bulk PUT финансовых справочников и документов."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class FinanceCategoryItem(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    id: str = Field(..., min_length=1, max_length=100)
    name: str = Field(default="", max_length=500)
    type: str = Field(default="fixed", max_length=50)
    value: Any = None
    color: str | None = Field(default=None, max_length=200)
    order: int = Field(default=0, ge=0)
    isArchived: bool = False


class FinancialPlanWeekSliceItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    start: str = Field(default="", max_length=20)
    end: str = Field(default="", max_length=20)
    label: str | None = Field(default=None, max_length=240)
    income: Any = None
    expenses: dict[str, Any] = Field(default_factory=dict)


class FinancialPlanDocItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(..., min_length=1, max_length=100)
    departmentId: str = Field(default="", max_length=100)
    period: str = Field(default="", max_length=50)
    income: Any = None
    expenses: dict[str, Any] = Field(default_factory=dict)
    status: str = Field(default="created", max_length=50)
    createdAt: str = Field(default="", max_length=100)
    updatedAt: str | None = Field(default=None, max_length=100)
    approvedBy: str | None = Field(default=None, max_length=100)
    approvedAt: str | None = Field(default=None, max_length=100)
    isArchived: bool = False
    periodStart: str | None = Field(default=None, max_length=20)
    periodEnd: str | None = Field(default=None, max_length=20)
    planSeriesId: str | None = Field(default=None, max_length=36)
    periodLabel: str | None = Field(default=None, max_length=120)
    weekBreakdown: list[FinancialPlanWeekSliceItem] | None = None


class FinancialPlanningItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(..., min_length=1, max_length=100)
    departmentId: str = Field(default="", max_length=100)
    period: str = Field(default="", max_length=50)
    planDocumentId: str | None = Field(default=None, max_length=100)
    income: Any = None
    fundAllocations: dict[str, Any] = Field(default_factory=dict)
    requestFundIds: dict[str, Any] = Field(default_factory=dict)
    requestIds: list[str] = Field(default_factory=list)
    status: str = Field(default="created", max_length=50)
    createdAt: str = Field(default="", max_length=100)
    updatedAt: str | None = Field(default=None, max_length=100)
    approvedBy: str | None = Field(default=None, max_length=100)
    approvedAt: str | None = Field(default=None, max_length=100)
    notes: str | None = None
    isArchived: bool = False
    periodStart: str | None = Field(default=None, max_length=20)
    periodEnd: str | None = Field(default=None, max_length=20)
    planDocumentIds: list[str] = Field(default_factory=list)
    incomeReportId: str | None = Field(default=None, max_length=36)
    incomeReportIds: list[str] = Field(default_factory=list)
    fundMovements: list[dict[str, Any]] = Field(default_factory=list)
    expenseDistribution: dict[str, Any] = Field(default_factory=dict)


class BankStatementLineItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str | None = Field(default=None, max_length=36)
    statementId: str | None = Field(default=None, max_length=100)
    lineDate: str = Field(default="", max_length=50)
    description: str | None = None
    amount: Any = None
    lineType: str = Field(default="in", max_length=20)


class BankStatementItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(..., min_length=1, max_length=100)
    name: str | None = Field(default=None, max_length=500)
    period: str | None = Field(default=None, max_length=50)
    createdAt: str = Field(default="", max_length=100)
    lines: list[BankStatementLineItem] = Field(default_factory=list)


class IncomeReportItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(..., min_length=1, max_length=100)
    period: str = Field(default="", max_length=50)
    data: dict[str, Any] = Field(default_factory=dict)
    createdAt: str = Field(default="", max_length=100)
    updatedAt: str | None = Field(default=None, max_length=100)
    lockedByPlanningId: str | None = Field(default=None, max_length=36)


class FinanceReconciliationGroupItem(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    id: str = Field(..., min_length=1, max_length=36)
    lineIds: list[str] = Field(default_factory=list)
    requestId: str | None = Field(default=None, max_length=36)
    manualResolved: bool = False


class FinancePlanUpsert(BaseModel):
    """PUT /finance/plan — одна запись плана."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    id: str | None = Field(default=None, max_length=36)
    period: str = Field(default="month", max_length=20)
    salesPlan: Any = 0
    currentIncome: Any = 0


class BdrPutBody(BaseModel):
    """PUT /finance/bdr."""

    model_config = ConfigDict(extra="forbid")

    year: str = Field(..., min_length=4, max_length=4)
    rows: list[Any] = Field(default_factory=list)
