"""Производственные маршруты (горизонтальная воронка): пайплайн → заказы → передачи между этапами."""
import uuid

from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from app.db import Base


def gen_id():
    return str(uuid.uuid4())


class ProductionPipeline(Base):
    __tablename__ = "production_pipelines"

    id = Column(String(36), primary_key=True, default=gen_id)
    name = Column(String(255), nullable=False)
    color = Column(String(100), nullable=True)
    stages = Column(JSONB, nullable=False, server_default=text("'[]'::jsonb"))
    created_at = Column(String(50), nullable=True)
    updated_at = Column(String(50), nullable=True)
    is_archived = Column(String(10), nullable=False, server_default=text("'false'"))

    orders = relationship("ProductionOrder", back_populates="pipeline")


class ProductionOrder(Base):
    __tablename__ = "production_orders"

    id = Column(String(36), primary_key=True, default=gen_id)
    version = Column(Integer, nullable=False, server_default=text("1"))
    pipeline_id = Column(String(36), ForeignKey("production_pipelines.id", ondelete="RESTRICT"), nullable=False)
    current_stage_id = Column(String(100), nullable=False)
    title = Column(String(500), nullable=False)
    notes = Column(Text, nullable=True)
    status = Column(String(30), nullable=False, server_default=text("'open'"))
    created_at = Column(String(50), nullable=False)
    updated_at = Column(String(50), nullable=True)
    is_archived = Column(Boolean, nullable=False, server_default=text("false"))

    pipeline = relationship("ProductionPipeline", back_populates="orders")
    handoffs = relationship("ProductionHandoff", back_populates="order", cascade="all, delete-orphan")

    __mapper_args__ = {"version_id_col": version}


class ProductionHandoff(Base):
    """Передача с этапа на этап: сдача + приёмка (дефекты фиксируются при приёмке)."""

    __tablename__ = "production_handoffs"

    id = Column(String(36), primary_key=True, default=gen_id)
    order_id = Column(String(36), ForeignKey("production_orders.id", ondelete="CASCADE"), nullable=False)
    from_stage_id = Column(String(100), nullable=False)
    to_stage_id = Column(String(100), nullable=False)
    status = Column(String(30), nullable=False, server_default=text("'pending_accept'"))
    handed_over_by_user_id = Column(String(36), nullable=True)
    handed_over_at = Column(String(50), nullable=False)
    accepted_by_user_id = Column(String(36), nullable=True)
    accepted_at = Column(String(50), nullable=True)
    has_defects = Column(Boolean, nullable=False, server_default=text("false"))
    defect_notes = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)

    order = relationship("ProductionOrder", back_populates="handoffs")
