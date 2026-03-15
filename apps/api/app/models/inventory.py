"""Inventory models."""
from sqlalchemy import Column, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from app.database import Base
import uuid


def gen_id():
    return str(uuid.uuid4())


class Warehouse(Base):
    __tablename__ = "warehouses"

    id = Column(String(36), primary_key=True, default=gen_id)
    name = Column(String(255), nullable=False)
    department_id = Column(String(36), nullable=True)
    location = Column(String(255), nullable=True)
    is_default = Column(String(10), default="false")
    is_archived = Column(String(10), default="false")


class InventoryItem(Base):
    __tablename__ = "inventory_items"

    id = Column(String(36), primary_key=True, default=gen_id)
    sku = Column(String(100), nullable=False)
    name = Column(String(255), nullable=False)
    unit = Column(String(50), nullable=False)
    category = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    is_archived = Column(String(10), default="false")


class StockMovement(Base):
    __tablename__ = "stock_movements"

    id = Column(String(36), primary_key=True, default=gen_id)
    type = Column(String(30), nullable=False)
    date = Column(String(20), nullable=False)
    from_warehouse_id = Column(String(36), nullable=True)
    to_warehouse_id = Column(String(36), nullable=True)
    items = Column(JSONB, default=list)
    reason = Column(String(500), nullable=True)
    created_by_user_id = Column(String(36), nullable=False)


class InventoryRevision(Base):
    __tablename__ = "inventory_revisions"

    id = Column(String(36), primary_key=True, default=gen_id)
    number = Column(String(100), nullable=False)
    warehouse_id = Column(String(36), nullable=False)
    date = Column(String(20), nullable=False)
    status = Column(String(30), nullable=False)
    lines = Column(JSONB, default=list)
    reason = Column(String(500), nullable=True)
    created_by_user_id = Column(String(36), nullable=False)
    posted_at = Column(String(30), nullable=True)
