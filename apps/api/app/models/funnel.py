"""SalesFunnel model."""
from sqlalchemy import Column, String
from sqlalchemy.dialects.postgresql import JSONB
from app.database import Base
import uuid


def gen_id():
    return str(uuid.uuid4())


class SalesFunnel(Base):
    __tablename__ = "sales_funnels"

    id = Column(String(36), primary_key=True, default=gen_id)
    name = Column(String(255), nullable=False)
    stages = Column(JSONB, default=list)
    sources = Column(JSONB, default=dict)
    created_at = Column(String(50), nullable=True)
    updated_at = Column(String(50), nullable=True)
    is_archived = Column(String(10), default="false")
