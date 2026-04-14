"""Журнал мутаций сущностей (одна транзакция с бизнес-операцией)."""
from __future__ import annotations

import uuid

from sqlalchemy import Column, DateTime, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func

from app.db import Base


def _gen_id() -> str:
    return str(uuid.uuid4())


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=_gen_id)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    action = Column(String(20), nullable=False)  # create | update | delete
    entity_type = Column(String(50), nullable=False, index=True)
    entity_id = Column(String(36), nullable=False, index=True)
    actor_id = Column(String(36), nullable=True, index=True)
    source = Column(String(100), nullable=True)
    request_id = Column(String(64), nullable=True, index=True)
    payload = Column(JSONB, nullable=False, default=dict)
