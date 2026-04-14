"""Settings-related models: TableCollection, StatusOption, PriorityOption, ActivityLog."""
import uuid

from sqlalchemy import Boolean, Column, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB

from app.db import Base


def gen_id():
    return str(uuid.uuid4())


class TableCollection(Base):
    __tablename__ = "tables"

    id = Column(String(36), primary_key=True, default=gen_id)
    name = Column(String(255), nullable=False)
    type = Column(String(50), nullable=False)  # tasks, docs, meetings, content-plan, backlog, functionality
    icon = Column(String(50), nullable=False)
    color = Column(String(50), nullable=True)
    is_system = Column(Boolean, default=False)
    is_archived = Column(Boolean, default=False)
    is_public = Column(Boolean, default=False, nullable=False)


class StatusOption(Base):
    __tablename__ = "statuses"

    id = Column(String(36), primary_key=True, default=gen_id)
    name = Column(String(100), nullable=False)
    color = Column(String(200), nullable=False)
    is_archived = Column(Boolean, default=False)


class PriorityOption(Base):
    __tablename__ = "priorities"

    id = Column(String(36), primary_key=True, default=gen_id)
    name = Column(String(100), nullable=False)
    color = Column(String(200), nullable=False)
    is_archived = Column(Boolean, default=False)


class ActivityLog(Base):
    __tablename__ = "activity"

    id = Column(String(36), primary_key=True, default=gen_id)
    user_id = Column(String(36), nullable=False)
    user_name = Column(String(255), nullable=False)
    user_avatar = Column(String(500), nullable=True)
    action = Column(String(255), nullable=False)
    details = Column(Text, nullable=True)
    timestamp = Column(String(50), nullable=False)
    read = Column(Boolean, default=False)


class InboxMessage(Base):
    """Диалог CRM + внутренний чат: секреты только вне этого ряда."""

    __tablename__ = "inbox_messages"
    __table_args__ = (
        UniqueConstraint(
            "channel",
            "external_msg_id",
            name="uq_inbox_messages_channel_external_msg_id",
        ),
    )

    id = Column(String(36), primary_key=True, default=gen_id)
    deal_id = Column(String(36), nullable=True)
    funnel_id = Column(String(36), nullable=True)
    direction = Column(String(16), nullable=False, default="internal")  # in | out | internal
    channel = Column(String(32), nullable=False, default="internal")  # telegram | instagram | site | internal
    sender_id = Column(String(255), nullable=False)
    body = Column(Text, nullable=False, default="")
    media_url = Column(Text, nullable=True)
    external_msg_id = Column(String(512), nullable=True)
    is_read = Column(Boolean, nullable=False, default=False)
    recipient_id = Column(String(36), nullable=True)  # маршрутизация internal / уведомлений
    attachments = Column(JSONB, default=list)
    created_at = Column(String(50), nullable=False)
