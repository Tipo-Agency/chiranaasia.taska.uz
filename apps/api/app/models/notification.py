"""Notification models."""
from sqlalchemy import Column, String, DateTime, Boolean
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
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
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Notification(Base):
    """User-facing notification center entry."""

    __tablename__ = "notifications"

    id = Column(String(36), primary_key=True, default=gen_id)
    event_id = Column(String(36), nullable=True, index=True)
    recipient_id = Column(String(36), nullable=False, index=True)
    type = Column(String(120), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    body = Column(String(2000), nullable=False)
    priority = Column(String(20), nullable=False, default="normal", index=True)
    entity_type = Column(String(60), nullable=True, index=True)
    entity_id = Column(String(120), nullable=True, index=True)
    payload = Column(JSONB, nullable=False, default=dict)
    is_read = Column(Boolean, nullable=False, default=False, index=True)
    read_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)


class NotificationDelivery(Base):
    """Delivery attempts/status per notification and channel."""

    __tablename__ = "notification_deliveries"

    id = Column(String(36), primary_key=True, default=gen_id)
    notification_id = Column(String(36), nullable=False, index=True)
    channel = Column(String(30), nullable=False, index=True)  # in_app, chat, telegram, email
    status = Column(String(30), nullable=False, default="pending", index=True)  # pending, sent, failed
    attempts = Column(String(10), nullable=False, default="0")
    last_error = Column(String(2000), nullable=True)
    next_attempt_at = Column(DateTime(timezone=True), nullable=True, index=True)
    delivered_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class NotificationArchive(Base):
    """Archived user notifications kept beyond hot retention window."""

    __tablename__ = "notifications_archive"

    id = Column(String(36), primary_key=True)
    event_id = Column(String(36), nullable=True, index=True)
    recipient_id = Column(String(36), nullable=False, index=True)
    type = Column(String(120), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    body = Column(String(2000), nullable=False)
    priority = Column(String(20), nullable=False, default="normal", index=True)
    entity_type = Column(String(60), nullable=True, index=True)
    entity_id = Column(String(120), nullable=True, index=True)
    payload = Column(JSONB, nullable=False, default=dict)
    is_read = Column(Boolean, nullable=False, default=False, index=True)
    read_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, index=True)
    archived_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
