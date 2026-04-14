"""Notification models."""
import uuid

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func

from app.db import Base


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


class NotificationEvent(Base):
    """Canonical domain event log for notification bus."""

    __tablename__ = "notification_events"

    id = Column(String(36), primary_key=True, default=gen_id)
    event_type = Column(String(120), nullable=False, index=True)
    occurred_at = Column(DateTime(timezone=True), nullable=False, index=True)
    actor_id = Column(String(36), nullable=True, index=True)
    org_id = Column(String(36), nullable=False, index=True)
    entity_type = Column(String(60), nullable=False, index=True)
    entity_id = Column(String(120), nullable=False, index=True)
    source = Column(String(120), nullable=False)
    correlation_id = Column(String(120), nullable=True, index=True)
    payload = Column(JSONB, nullable=False)
    published_to_stream = Column(Boolean, nullable=False, default=False)
    stream_id = Column(String(120), nullable=True)
    hub_processed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Notification(Base):
    """User-facing notification center entry."""

    __tablename__ = "notifications"

    id = Column(String(36), primary_key=True, default=gen_id)
    user_id = Column(String(36), nullable=False, index=True)
    type = Column(String(120), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)
    entity_type = Column(String(60), nullable=True, index=True)
    entity_id = Column(String(120), nullable=True, index=True)
    is_read = Column(Boolean, nullable=False, default=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)


class NotificationDelivery(Base):
    """Внешняя доставка уведомления (telegram / email).

    State machine: pending → sending → sent | retry → pending → … → dead
    (ошибка конфигурации / получателя — сразу dead).
    """

    __tablename__ = "notification_deliveries"

    id = Column(String(36), primary_key=True, default=gen_id)
    notification_id = Column(String(36), nullable=False, index=True)
    channel = Column(String(30), nullable=False, index=True)  # telegram, email
    recipient = Column(String(512), nullable=False, default="")  # chat_id или email
    status = Column(String(30), nullable=False, default="pending", index=True)
    attempts = Column(Integer, nullable=False, default=0)
    last_error = Column(String(2000), nullable=True)
    next_retry_at = Column(DateTime(timezone=True), nullable=True, index=True)
    sent_at = Column(DateTime(timezone=True), nullable=True)


class NotificationArchive(Base):
    """Archived user notifications kept beyond hot retention window."""

    __tablename__ = "notifications_archive"

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), nullable=False, index=True)
    type = Column(String(120), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)
    entity_type = Column(String(60), nullable=True, index=True)
    entity_id = Column(String(120), nullable=True, index=True)
    is_read = Column(Boolean, nullable=False, default=False, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, index=True)
    archived_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
