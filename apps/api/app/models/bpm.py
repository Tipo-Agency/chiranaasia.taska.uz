"""BPM models: OrgPosition, BusinessProcess."""
import uuid

from sqlalchemy import Boolean, Column, String
from sqlalchemy.dialects.postgresql import JSONB

from app.database import Base


def gen_id():
    return str(uuid.uuid4())


class OrgPosition(Base):
    __tablename__ = "org_positions"

    id = Column(String(36), primary_key=True, default=gen_id)
    title = Column(String(255), nullable=False)
    department_id = Column(String(36), nullable=True)
    manager_position_id = Column(String(36), nullable=True)
    holder_user_id = Column(String(36), nullable=True)
    order_val = Column(String(10), default="0")
    is_archived = Column(Boolean, default=False)


class BusinessProcess(Base):
    __tablename__ = "business_processes"

    id = Column(String(36), primary_key=True, default=gen_id)
    version = Column(String(10), default="1")
    title = Column(String(255), nullable=False)
    description = Column(String(500), nullable=True)
    steps = Column(JSONB, default=list)
    instances = Column(JSONB, default=list)
    is_archived = Column(String(10), default="false")  # JSON compat
    created_at = Column(String(50), nullable=True)
    updated_at = Column(String(50), nullable=True)
