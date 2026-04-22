"""Finance models."""
import uuid

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func

from app.db import Base


def gen_id():
    return str(uuid.uuid4())


class Department(Base):
    __tablename__ = "departments"

    id = Column(String(36), primary_key=True, default=gen_id)
    name = Column(String(255), nullable=False)
    parent_id = Column(String(36), ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    head_id = Column(String(36), nullable=True)
    description = Column(String(500), nullable=True)
    is_archived = Column(Boolean, default=False)


class FinanceCategory(Base):
    __tablename__ = "finance_categories"

    id = Column(String(36), primary_key=True, default=gen_id)
    name = Column(String(255), nullable=False)
    type = Column(String(20), nullable=False)  # fixed, percent
    value = Column(String(50), nullable=True)
    color = Column(String(100), nullable=True)
    sort_order = Column(Integer, nullable=False, server_default=text("0"))
    is_archived = Column(Boolean, nullable=False, server_default=text("false"))


class FinancePlan(Base):
    __tablename__ = "finance_plan"

    id = Column(String(36), primary_key=True, default=gen_id)
    period = Column(String(20), nullable=False)  # week, month
    sales_plan = Column(String(50), nullable=False)
    current_income = Column(String(50), default="0")


class FinanceRequest(Base):
    """Заявка на оплату (таблица ``finance_requests``)."""

    __tablename__ = "finance_requests"
    __table_args__ = (
        Index("idx_finance_requests_created_at_id", "created_at", "id"),
    )

    id = Column(String(36), primary_key=True, default=gen_id)
    version = Column(Integer, nullable=False, server_default=text("1"))
    title = Column(String(500), nullable=False)
    amount = Column(Numeric(15, 2), nullable=False)
    # Сумма против лимита фонда при частичном одобрении; NULL — вся amount.
    budget_approved_amount = Column(Numeric(15, 2), nullable=True)
    currency = Column(String(10), nullable=False, server_default=text("'UZS'"))
    category = Column(String(100), nullable=True)
    department_id = Column(String(36), nullable=True)
    counterparty = Column(String(255), nullable=True)
    requested_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_by = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    status = Column(String(30), nullable=False, server_default=text("'draft'"))
    comment = Column(Text, nullable=True)
    payment_date = Column(Date, nullable=True)
    paid_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=True)
    is_archived = Column(Boolean, nullable=False, server_default=text("false"))
    attachments = Column(JSONB, default=list)
    counterparty_inn = Column(String(32), nullable=True)
    invoice_number = Column(String(100), nullable=True)
    invoice_date = Column(Date, nullable=True)

    __mapper_args__ = {"version_id_col": version}


# Обратная совместимость импортов
PurchaseRequest = FinanceRequest


class FinancialPlanDocument(Base):
    __tablename__ = "financial_plan_documents"

    id = Column(String(36), primary_key=True, default=gen_id)
    department_id = Column(String(36), nullable=False)
    period = Column(String(10), nullable=False)  # YYYY-MM (якорный месяц)
    income = Column(String(50), nullable=False)
    expenses = Column(JSONB, default=dict)
    status = Column(String(30), nullable=False)
    created_at = Column(String(50), nullable=False)
    updated_at = Column(String(50), nullable=True)
    approved_by = Column(String(36), nullable=True)
    approved_at = Column(String(50), nullable=True)
    is_archived = Column(Boolean, default=False)
    period_start = Column(String(20), nullable=True)  # YYYY-MM-DD
    period_end = Column(String(20), nullable=True)
    plan_series_id = Column(String(36), nullable=True)  # группа недельных отрезков одного месяца
    period_label = Column(String(120), nullable=True)
    week_breakdown = Column(JSONB, nullable=True)  # срезы по неделям внутри одного документа


class FinancialPlanning(Base):
    __tablename__ = "financial_plannings"

    id = Column(String(36), primary_key=True, default=gen_id)
    department_id = Column(String(36), nullable=False)
    period = Column(String(10), nullable=False)
    plan_document_id = Column(String(36), nullable=True)
    income = Column(String(50), nullable=True)
    fund_allocations = Column(JSONB, default=dict)
    request_fund_ids = Column(JSONB, default=dict)
    request_ids = Column(JSONB, default=list)
    status = Column(String(30), nullable=False)
    created_at = Column(String(50), nullable=False)
    updated_at = Column(String(50), nullable=True)
    approved_by = Column(String(36), nullable=True)
    approved_at = Column(String(50), nullable=True)
    notes = Column(String(500), nullable=True)
    is_archived = Column(Boolean, default=False)
    period_start = Column(String(20), nullable=True)
    period_end = Column(String(20), nullable=True)
    plan_document_ids = Column(JSONB, default=list)
    income_report_id = Column(String(36), nullable=True)
    income_report_ids = Column(JSONB, default=list)
    fund_movements = Column(JSONB, default=list)
    expense_distribution = Column(JSONB, default=dict)


class BankStatement(Base):
    """Выписка банка (загруженный файл / период)."""
    __tablename__ = "bank_statements"

    id = Column(String(36), primary_key=True, default=gen_id)
    name = Column(String(255), nullable=True)  # имя файла или подпись
    period = Column(String(20), nullable=True)  # например YYYY-MM
    bank_code = Column(String(32), nullable=True)  # kapital, tenge, …
    created_at = Column(String(50), nullable=False)


class BankStatementLine(Base):
    """Строка выписки: дата, описание, сумма (приход/расход)."""
    __tablename__ = "bank_statement_lines"

    id = Column(String(36), primary_key=True, default=gen_id)
    statement_id = Column(String(36), nullable=False)  # FK → bank_statements.id
    line_date = Column(String(20), nullable=False)  # YYYY-MM-DD
    description = Column(String(500), nullable=True)
    amount = Column(String(50), nullable=False)  # число как строка
    line_type = Column(String(10), nullable=False)  # 'in' | 'out'


class FinanceReconciliationGroup(Base):
    """Ручная группировка строк выписки (несколько расходов → одна заявка ФП)."""

    __tablename__ = "finance_reconciliation_groups"

    id = Column(String(36), primary_key=True, default=gen_id)
    line_ids = Column(JSONB, default=list)
    request_id = Column(String(36), nullable=True)
    manual_resolved = Column(Boolean, nullable=False, server_default=text("false"))
    updated_at = Column(String(50), nullable=True)


class IncomeReport(Base):
    """Отчёт по приходам (сводка по дням для сверки с выписками)."""
    __tablename__ = "income_reports"

    id = Column(String(36), primary_key=True, default=gen_id)
    period = Column(String(20), nullable=False)  # YYYY-MM
    data = Column(JSONB, default=dict)  # например {"2024-01-15": 1000.5, ...} — дата -> сумма прихода
    created_at = Column(String(50), nullable=False)
    updated_at = Column(String(50), nullable=True)
    locked_by_planning_id = Column(String(36), nullable=True)


class Bdr(Base):
    """БДР — бюджет доходов и расходов. Один документ на год; данные по строкам и суммам по месяцам в JSONB."""
    __tablename__ = "bdr"
    __table_args__ = (UniqueConstraint("year", name="uq_bdr_year"),)

    id = Column(String(36), primary_key=True, default=gen_id)  # обычно год, например "2025"
    year = Column(String(4), nullable=False)  # год планирования
    rows = Column(JSONB, default=list)  # [ {"id": "uuid", "name": "...", "type": "income"|"expense", "amounts": {"2025-01": 100, ...} }, ... ]
    updated_at = Column(String(50), nullable=True)
