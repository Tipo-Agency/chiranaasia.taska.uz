"""System log model for storing errors and audit events."""
from sqlalchemy import Column, DateTime, Integer, String, Text
from sqlalchemy.sql import func

from app.database import Base


class SystemLog(Base):
    """Stores application errors and optional audit events for admin visibility."""

    __tablename__ = "system_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    level = Column(String(20), nullable=False, index=True)  # ERROR, CRITICAL, WARNING, INFO
    message = Column(Text, nullable=False)
    logger_name = Column(String(255), nullable=True)
    path = Column(String(500), nullable=True)  # request path or module
    request_id = Column(String(64), nullable=True, index=True)
    payload = Column(Text, nullable=True)  # JSON extra (stack trace, etc.)
