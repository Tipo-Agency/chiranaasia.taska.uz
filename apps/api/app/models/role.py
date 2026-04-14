"""Роли и набор прав (JSON)."""

import uuid

from sqlalchemy import JSON, Boolean, Column, Integer, String, Text

from app.db import Base


def gen_id():
    return str(uuid.uuid4())


class Role(Base):
    __tablename__ = "roles"

    id = Column(String(36), primary_key=True, default=gen_id)
    name = Column(String(120), nullable=False)
    slug = Column(String(60), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    is_system = Column(Boolean, default=False)
    sort_order = Column(Integer, default=0)
    # Список строк-ключей прав; system.full_access = полный доступ
    permissions = Column(JSON, nullable=False)
