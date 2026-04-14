"""Записи DLQ: неуспешные сообщения очередей для разбора и ручного resolved."""
import uuid

from sqlalchemy import Boolean, Column, DateTime, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func

from app.db import Base


def gen_id() -> str:
    return str(uuid.uuid4())


class DeadLetterQueue(Base):
    __tablename__ = "dead_letter_queue"

    id = Column(String(36), primary_key=True, default=gen_id)
    queue_name = Column(String(120), nullable=False, index=True)
    payload = Column(JSONB, nullable=False)
    error = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    resolved = Column(Boolean, nullable=False, default=False, index=True)
