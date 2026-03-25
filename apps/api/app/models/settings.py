"""Settings-related models: TableCollection, StatusOption, PriorityOption, ActivityLog."""
import uuid

from sqlalchemy import Boolean, Column, String, Text
from sqlalchemy.dialects.postgresql import JSONB

from app.database import Base


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
    """Сообщения входящие/исходящие с возможностью прикреплять сущности."""
    __tablename__ = "inbox_messages"

    id = Column(String(36), primary_key=True, default=gen_id)
    sender_id = Column(String(36), nullable=False)
    recipient_id = Column(String(36), nullable=True)  # null = всем / общий канал
    text = Column(Text, nullable=False)
    attachments = Column(JSONB, default=list)  # [{"entityType": "task", "entityId": "...", "label": "..."}]
    created_at = Column(String(50), nullable=False)
    read = Column(Boolean, default=False)
