"""Finance models."""
from sqlalchemy import Column, String, Boolean
from sqlalchemy.dialects.postgresql import JSONB
from app.database import Base
import uuid


def gen_id():
    return str(uuid.uuid4())


class Department(Base):
    __tablename__ = "departments"

    id = Column(String(36), primary_key=True, default=gen_id)
    name = Column(String(255), nullable=False)
    head_id = Column(String(36), nullable=True)
    description = Column(String(500), nullable=True)


class FinanceCategory(Base):
    __tablename__ = "finance_categories"

    id = Column(String(36), primary_key=True, default=gen_id)
    name = Column(String(255), nullable=False)
    type = Column(String(20), nullable=False)  # fixed, percent
    value = Column(String(50), nullable=True)
    color = Column(String(100), nullable=True)


class Fund(Base):
    __tablename__ = "funds"

    id = Column(String(36), primary_key=True, default=gen_id)
    name = Column(String(255), nullable=False)
    order_val = Column(String(10), default="0")
    is_archived = Column(Boolean, default=False)


class FinancePlan(Base):
    __tablename__ = "finance_plan"

    id = Column(String(36), primary_key=True, default=gen_id)
    period = Column(String(20), nullable=False)  # week, month
    sales_plan = Column(String(50), nullable=False)
    current_income = Column(String(50), default="0")


class PurchaseRequest(Base):
    __tablename__ = "purchase_requests"

    id = Column(String(36), primary_key=True, default=gen_id)
    requester_id = Column(String(36), nullable=False)
    department_id = Column(String(36), nullable=False)
    category_id = Column(String(36), nullable=False)
    amount = Column(String(50), nullable=False)
    description = Column(String(500), nullable=False)
    status = Column(String(30), nullable=False)
    date = Column(String(20), nullable=False)
    decision_date = Column(String(20), nullable=True)
    is_archived = Column(Boolean, default=False)


class FinancialPlanDocument(Base):
    __tablename__ = "financial_plan_documents"

    id = Column(String(36), primary_key=True, default=gen_id)
    department_id = Column(String(36), nullable=False)
    period = Column(String(10), nullable=False)  # YYYY-MM
    income = Column(String(50), nullable=False)
    expenses = Column(JSONB, default=dict)
    status = Column(String(30), nullable=False)
    created_at = Column(String(30), nullable=False)
    updated_at = Column(String(30), nullable=True)
    approved_by = Column(String(36), nullable=True)
    approved_at = Column(String(30), nullable=True)
    is_archived = Column(Boolean, default=False)


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
    created_at = Column(String(30), nullable=False)
    updated_at = Column(String(30), nullable=True)
    approved_by = Column(String(36), nullable=True)
    approved_at = Column(String(30), nullable=True)
    notes = Column(String(500), nullable=True)
    is_archived = Column(Boolean, default=False)
