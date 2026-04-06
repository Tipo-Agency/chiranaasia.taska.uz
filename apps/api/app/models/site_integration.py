"""Site integrations (API keys per funnel for website lead intake)."""

from sqlalchemy import Boolean, Column, DateTime, String
from sqlalchemy.sql import func

from app.database import Base


class SiteIntegrationKey(Base):
    __tablename__ = "site_integration_keys"

    # Random UUID string
    id = Column(String(36), primary_key=True)

    # One active key per funnel (can be rotated)
    funnel_id = Column(String(36), nullable=False, unique=True, index=True)

    # sha256 hex digest of the plaintext API key
    api_key_hash = Column(String(64), nullable=False, unique=True, index=True)

    key_last4 = Column(String(8), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    rotated_at = Column(DateTime(timezone=True), nullable=True)

