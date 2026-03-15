"""Notification models."""
from sqlalchemy import Column, String, Boolean
from sqlalchemy.dialects.postgresql import JSONB
from app.database import Base
import uuid


def gen_id():
    return str(uuid.uuid4())


class NotificationPreferences(Base):
    __tablename__ = "notification_prefs"

    id = Column(String(36), primary_key=True, default=gen_id)
    prefs = Column(JSONB, nullable=False)  # Full NotificationPreferences object
    default_funnel_id = Column(String(36), nullable=True)
    telegram_group_chat_id = Column(String(50), nullable=True)


class AutomationRule(Base):
    __tablename__ = "automation_rules"

    id = Column(String(36), primary_key=True, default=gen_id)
    rule = Column(JSONB, nullable=False)  # Full AutomationRule object
