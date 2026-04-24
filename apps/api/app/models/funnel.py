"""SalesFunnel model."""
import uuid

import sqlalchemy as sa
from sqlalchemy import Boolean, Column, String
from sqlalchemy.dialects.postgresql import JSONB

from app.db import Base


def gen_id():
    return str(uuid.uuid4())


class SalesFunnel(Base):
    __tablename__ = "sales_funnels"

    id = Column(String(36), primary_key=True, default=gen_id)
    name = Column(String(255), nullable=False)
    color = Column(String(100), nullable=True)
    # Funnel owner / default assignee for new leads
    owner_user_id = Column(String(36), nullable=True)
    stages = Column(JSONB, default=list)
    sources = Column(JSONB, default=dict)
    notification_templates = Column(JSONB, default=dict)
    created_at = Column(String(50), nullable=True)
    updated_at = Column(String(50), nullable=True)
    is_archived = Column(Boolean, nullable=False, server_default=sa.text("false"))
