"""MTProto (Telethon) session for sending/receiving as a Telegram user (not bot)."""
import uuid

from sqlalchemy import Column, String, Text

from app.database import Base


def gen_id():
    return str(uuid.uuid4())


class TelegramPersonalSession(Base):
    __tablename__ = "telegram_personal_sessions"

    id = Column(String(36), primary_key=True, default=gen_id)
    user_id = Column(String(36), nullable=False, unique=True, index=True)
    # inactive | pending_code | pending_password | active
    status = Column(String(32), nullable=False, default="inactive")
    encrypted_session = Column(Text, nullable=True)
    pending_phone = Column(String(32), nullable=True)
    pending_phone_code_hash = Column(String(255), nullable=True)
    phone_masked = Column(String(16), nullable=True)
    created_at = Column(String(50), nullable=True)
    updated_at = Column(String(50), nullable=True)
