"""Client, Deal, EmployeeInfo, AccountsReceivable models."""
import uuid

from sqlalchemy import Boolean, Column, ForeignKey, Index, Integer, Numeric, String, Text, text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import relationship

from app.db import Base


def gen_id():
    return str(uuid.uuid4())


class Client(Base):
    """Клиент (docs/ENTITIES): без дублей contact_person/company_info/funnel_id — в notes/tags."""

    __tablename__ = "clients"

    id = Column(String(36), primary_key=True, default=gen_id)
    version = Column(Integer, nullable=False, server_default=text("1"))
    name = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=True)
    email = Column(String(255), nullable=True)
    telegram = Column(String(100), nullable=True)
    instagram = Column(String(255), nullable=True)
    company_name = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    tags = Column(ARRAY(Text), nullable=False, server_default=text("ARRAY[]::text[]"))
    is_archived = Column(Boolean, default=False)

    deals = relationship("Deal", back_populates="client")
    crm_contacts = relationship("CrmContact", back_populates="client")

    __mapper_args__ = {"version_id_col": version}


class CrmContact(Base):
    """Контактное лицо компании (клиента); каналы — телефон, Telegram, Instagram."""

    __tablename__ = "crm_contacts"

    id = Column(String(36), primary_key=True, default=gen_id)
    version = Column(Integer, nullable=False, server_default=text("1"))
    client_id = Column(String(36), ForeignKey("clients.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=True)
    email = Column(String(255), nullable=True)
    telegram = Column(String(100), nullable=True)
    instagram = Column(String(255), nullable=True)
    job_title = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    tags = Column(ARRAY(Text), nullable=False, server_default=text("ARRAY[]::text[]"))
    is_archived = Column(Boolean, default=False)

    client = relationship("Client", back_populates="crm_contacts")
    deals = relationship("Deal", back_populates="contact")

    __mapper_args__ = {"version_id_col": version}


class Deal(Base):
    """
    CRM Deal — целевые поля docs/ENTITIES.md §4.
    Дополнительные колонки (договор/разовая продажа, комментарии) сохранены для совместимости UI.
    """

    __tablename__ = "deals"

    id = Column(String(36), primary_key=True, default=gen_id)
    version = Column(Integer, nullable=False, server_default=text("1"))
    title = Column(String(500), nullable=False)
    stage = Column(String(100), nullable=False)
    funnel_id = Column(String(36), nullable=True)
    client_id = Column(String(36), ForeignKey("clients.id", ondelete="SET NULL"), nullable=True)
    contact_id = Column(String(36), ForeignKey("crm_contacts.id", ondelete="SET NULL"), nullable=True)
    assignee_id = Column(String(36), nullable=True)
    amount = Column(Numeric(18, 2), nullable=False, server_default=text("0"))
    currency = Column(String(10), nullable=False, server_default=text("'UZS'"))
    source = Column(String(50), nullable=True)
    source_chat_id = Column(String(255), nullable=True)
    tags = Column(ARRAY(Text), nullable=False, server_default=text("ARRAY[]::text[]"))
    custom_fields = Column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))
    lost_reason = Column(Text, nullable=True)
    is_archived = Column(Boolean, default=False)
    # --- legacy / UI (не в краткой таблице ENTITIES §4) ---
    contact_name = Column(String(255), nullable=True)
    created_at = Column(String(50), nullable=False)
    notes = Column(Text, nullable=True)
    project_id = Column(String(36), nullable=True)
    comments = Column(JSONB, default=list)
    recurring = Column(Boolean, default=False)
    number = Column(String(100), nullable=True)
    status = Column(String(30), nullable=True)
    description = Column(Text, nullable=True)
    date = Column(String(50), nullable=True)
    due_date = Column(String(50), nullable=True)
    paid_amount = Column(String(50), nullable=True)
    paid_date = Column(String(50), nullable=True)
    start_date = Column(String(50), nullable=True)
    end_date = Column(String(50), nullable=True)
    payment_day = Column(String(10), nullable=True)
    updated_at = Column(String(50), nullable=True)

    client = relationship("Client", back_populates="deals", foreign_keys=[client_id])
    contact = relationship("CrmContact", back_populates="deals", foreign_keys=[contact_id])

    __mapper_args__ = {"version_id_col": version}


class EmployeeInfo(Base):
    __tablename__ = "employee_infos"
    __table_args__ = (
        Index("idx_employee_infos_dept_archived_fullname_id", "department_id", "is_archived", "full_name", "id"),
    )

    id = Column(String(36), primary_key=True, default=gen_id)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    department_id = Column(String(36), nullable=True)
    org_position_id = Column(String(36), nullable=True)
    full_name = Column(String(255), nullable=False, server_default=text("''"))
    status = Column(String(50), nullable=False, server_default=text("'active'"))
    position = Column(String(255), nullable=True)
    hire_date = Column(String(50), nullable=True)
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
    status = Column(String(30), nullable=False)
    description = Column(Text, nullable=True)
    paid_amount = Column(String(50), nullable=True)
    paid_date = Column(String(50), nullable=True)
    created_at = Column(String(50), nullable=False)
    updated_at = Column(String(50), nullable=True)
    is_archived = Column(Boolean, default=False)
