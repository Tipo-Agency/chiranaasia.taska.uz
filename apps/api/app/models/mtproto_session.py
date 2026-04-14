"""MTProto (Telethon) сессия на пользователя CRM — таблица ``mtproto_sessions``."""
import uuid

from sqlalchemy import Column, String, Text

from app.db import Base


def gen_id():
    return str(uuid.uuid4())


class MtprotoSessionStatus:
    """Конечный автомат: ``inactive`` → ``pending_code`` → (``pending_password``?) → ``active``."""

    INACTIVE = "inactive"
    PENDING_CODE = "pending_code"
    PENDING_PASSWORD = "pending_password"
    ACTIVE = "active"

    ALL = frozenset({INACTIVE, PENDING_CODE, PENDING_PASSWORD, ACTIVE})


class MtprotoSession(Base):
    __tablename__ = "mtproto_sessions"

    id = Column(String(36), primary_key=True, default=gen_id)
    user_id = Column(String(36), nullable=False, unique=True, index=True)
    status = Column(String(32), nullable=False, default=MtprotoSessionStatus.INACTIVE)
    # Только Fernet ciphertext (``encrypt_secret``); plaintext в БД не хранится
    session_data = Column(Text, nullable=True)
    pending_phone = Column(String(32), nullable=True)
    pending_phone_code_hash = Column(String(255), nullable=True)
    phone_masked = Column(String(16), nullable=True)
    created_at = Column(String(50), nullable=True)
    updated_at = Column(String(50), nullable=True)


def mtproto_can_request_code(status: str) -> bool:
    """Разрешить POST send-code: старт или повтор до входа."""
    return status in (
        MtprotoSessionStatus.INACTIVE,
        MtprotoSessionStatus.PENDING_CODE,
        MtprotoSessionStatus.PENDING_PASSWORD,
    )


def mtproto_can_sign_in_code(status: str) -> bool:
    return status == MtprotoSessionStatus.PENDING_CODE


def mtproto_can_sign_in_password(status: str) -> bool:
    return status == MtprotoSessionStatus.PENDING_PASSWORD


def mtproto_is_active(status: str, has_session_data: bool) -> bool:
    return status == MtprotoSessionStatus.ACTIVE and has_session_data
