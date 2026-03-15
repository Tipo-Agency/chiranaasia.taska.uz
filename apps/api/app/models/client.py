"""Client, Deal, EmployeeInfo, AccountsReceivable models."""
from sqlalchemy import Column, String, Boolean, Text
from sqlalchemy.dialects.postgresql import JSONB
from app.database import Base
import uuid


def gen_id():
    return str(uuid.uuid4())


class Client(Base):
    __tablename__ = "clients"

    id = Column(String(36), primary_key=True, default=gen_id)
    name = Column(String(255), nullable=False)
    contact_person = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    email = Column(String(255), nullable=True)
    telegram = Column(String(100), nullable=True)
    instagram = Column(String(255), nullable=True)
    company_name = Column(String(255), nullable=True)
    company_info = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    funnel_id = Column(String(36), nullable=True)
    is_archived = Column(Boolean, default=False)


class Deal(Base):
    """CRM Deal - sales funnel deal with title, stage, assignee."""
    __tablename__ = "deals"

    id = Column(String(36), primary_key=True, default=gen_id)
    title = Column(String(500), nullable=False)
    client_id = Column(String(36), nullable=True)
    contact_name = Column(String(255), nullable=True)
    amount = Column(String(50), default="0")  # numeric as string for flexibility
    currency = Column(String(10), default="UZS")
    stage = Column(String(100), nullable=False)
    funnel_id = Column(String(36), nullable=True)
    source = Column(String(50), nullable=True)
    telegram_chat_id = Column(String(50), nullable=True)
    telegram_username = Column(String(100), nullable=True)
    assignee_id = Column(String(36), nullable=False)
    created_at = Column(String(50), nullable=False)
    notes = Column(Text, nullable=True)
    project_id = Column(String(36), nullable=True)
    comments = Column(JSONB, default=list)
    is_archived = Column(Boolean, default=False)
    # Contract/recurring deal fields
    recurring = Column(Boolean, default=False)
    number = Column(String(100), nullable=True)
    status = Column(String(30), nullable=True)  # pending, paid, overdue, active, completed
    description = Column(Text, nullable=True)
    date = Column(String(50), nullable=True)
    due_date = Column(String(50), nullable=True)
    paid_amount = Column(String(50), nullable=True)
    paid_date = Column(String(50), nullable=True)
    start_date = Column(String(50), nullable=True)
    end_date = Column(String(50), nullable=True)
    payment_day = Column(String(10), nullable=True)
    updated_at = Column(String(50), nullable=True)


class EmployeeInfo(Base):
    __tablename__ = "employee_infos"

    id = Column(String(36), primary_key=True, default=gen_id)
    user_id = Column(String(36), nullable=False)
    department_id = Column(String(36), nullable=True)
    position = Column(String(255), nullable=False)
    hire_date = Column(String(50), nullable=False)
    birth_date = Column(String(50), nullable=True)
    is_archived = Column(Boolean, default=False)


class AccountsReceivable(Base):
    __tablename__ = "accounts_receivable"

    id = Column(String(36), primary_key=True, default=gen_id)
    client_id = Column(String(36), nullable=False)
    deal_id = Column(String(36), nullable=False)
    amount = Column(String(50), nullable=False)
    currency = Column(String(10), nullable=False)
    due_date = Column(String(50), nullable=False)
    status = Column(String(30), nullable=False)  # current, overdue, paid
    description = Column(Text, nullable=True)
    paid_amount = Column(String(50), nullable=True)
    paid_date = Column(String(50), nullable=True)
    created_at = Column(String(50), nullable=False)
    updated_at = Column(String(50), nullable=True)
    is_archived = Column(Boolean, default=False)
