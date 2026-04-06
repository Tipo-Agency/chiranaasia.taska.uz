"""User model."""
import uuid

from sqlalchemy import Boolean, Column, ForeignKey, String

from app.database import Base


def gen_id():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=gen_id)
    name = Column(String(255), nullable=False)
    role_id = Column(String(36), ForeignKey("roles.id"), nullable=False)
    avatar = Column(String(500), nullable=True)
    login = Column(String(100), nullable=True, unique=True)
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    telegram = Column(String(100), nullable=True)
    telegram_user_id = Column(String(50), nullable=True)
    password_hash = Column(String(255), nullable=True)
    must_change_password = Column(Boolean, default=False)
    is_archived = Column(Boolean, default=False)
    calendar_export_token = Column(String(36), nullable=True, unique=True)
