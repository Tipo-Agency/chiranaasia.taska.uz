"""Telegram integration state (server-side polling watermarks)."""

from sqlalchemy import BigInteger, Column, DateTime, String
from sqlalchemy.sql import func

from app.database import Base


class TelegramIntegrationState(Base):
    __tablename__ = "telegram_integration_state"

    # funnel_id is a natural key; one state per funnel
    funnel_id = Column(String(36), primary_key=True)

    last_update_id = Column(BigInteger, nullable=False, default=0)

    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

