"""OAuth-подключения личной почты (Google Gmail и т.д.)."""
from __future__ import annotations

import uuid

from sqlalchemy import Column, ForeignKey, String, Text

from app.db import Base


def gen_id() -> str:
    return str(uuid.uuid4())


class UserMailOAuthAccount(Base):
    __tablename__ = "user_mail_oauth_accounts"

    id = Column(String(36), primary_key=True, default=gen_id)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    provider = Column(String(32), nullable=False)  # google
    account_email = Column(String(320), nullable=False)
    refresh_token_encrypted = Column(Text, nullable=False)
    access_token_encrypted = Column(Text, nullable=True)
    token_expires_at = Column(String(50), nullable=True)
    scopes = Column(Text, nullable=True)
    created_at = Column(String(50), nullable=False)
    updated_at = Column(String(50), nullable=True)
