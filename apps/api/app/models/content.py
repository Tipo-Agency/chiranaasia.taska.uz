"""Doc, Folder, Meeting, ContentPost models."""
import uuid

from sqlalchemy import Boolean, Column, String, Text
from sqlalchemy.dialects.postgresql import JSONB

from app.db import Base


def gen_id():
    return str(uuid.uuid4())


class Doc(Base):
    __tablename__ = "docs"

    id = Column(String(36), primary_key=True, default=gen_id)
    table_id = Column(String(36), nullable=True)
    folder_id = Column(String(36), nullable=True)
    title = Column(String(500), nullable=False)
    type = Column(String(20), nullable=False)  # link, internal
    url = Column(String(1000), nullable=True)
    content = Column(Text, nullable=True)
    tags = Column(JSONB, default=list)  # array of strings
    is_archived = Column(Boolean, default=False)


class Folder(Base):
    __tablename__ = "folders"

    id = Column(String(36), primary_key=True, default=gen_id)
    table_id = Column(String(36), nullable=False)
    name = Column(String(255), nullable=False)
    parent_folder_id = Column(String(36), nullable=True)
    is_archived = Column(Boolean, default=False)


class Meeting(Base):
    __tablename__ = "meetings"

    id = Column(String(36), primary_key=True, default=gen_id)
    table_id = Column(String(36), nullable=True)
    title = Column(String(500), nullable=False)
    date = Column(String(50), nullable=False)
    time = Column(String(10), nullable=False)
    participant_ids = Column(JSONB, default=list)
    participants = Column(JSONB, default=list)  # [{ "userId", "role"? }] — канон; participant_ids дублирует id
    summary = Column(Text, nullable=True)
    type = Column(String(20), default="work")  # client, work, project, shoot
    deal_id = Column(String(36), nullable=True)
    client_id = Column(String(36), nullable=True)
    project_id = Column(String(36), nullable=True)
    shoot_plan_id = Column(String(36), nullable=True)
    recurrence = Column(String(20), default="none")
    is_archived = Column(Boolean, default=False)


class ShootPlan(Base):
    __tablename__ = "shoot_plans"

    id = Column(String(36), primary_key=True, default=gen_id)
    table_id = Column(String(36), nullable=False)
    title = Column(String(500), nullable=False)
    date = Column(String(50), nullable=False)
    time = Column(String(10), nullable=False, default="10:00")
    participant_ids = Column(JSONB, default=list)
    items = Column(JSONB, default=list)  # [{postId, brief, referenceUrl, referenceImages: []}]
    meeting_id = Column(String(36), nullable=True)
    is_archived = Column(Boolean, default=False)


class ContentPost(Base):
    __tablename__ = "content_posts"

    id = Column(String(36), primary_key=True, default=gen_id)
    table_id = Column(String(36), nullable=True)
    topic = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    date = Column(String(50), nullable=False)
    platform = Column(JSONB, default=list)
    format = Column(String(20), default="post")
    status = Column(String(30), default="idea")
    copy = Column(Text, nullable=True)
    media_url = Column(String(500), nullable=True)
    is_archived = Column(Boolean, default=False)
