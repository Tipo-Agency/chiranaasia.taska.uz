"""Doc, Folder, Meeting, ContentPost models."""
from sqlalchemy import Column, String, Boolean, Text
from sqlalchemy.dialects.postgresql import JSONB, ARRAY
from sqlalchemy import String as SAString
from app.database import Base
import uuid


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
    date = Column(String(20), nullable=False)
    time = Column(String(10), nullable=False)
    participant_ids = Column(JSONB, default=list)
    summary = Column(Text, nullable=True)
    type = Column(String(20), default="work")  # client, work
    deal_id = Column(String(36), nullable=True)
    client_id = Column(String(36), nullable=True)
    recurrence = Column(String(20), default="none")
    is_archived = Column(Boolean, default=False)


class ContentPost(Base):
    __tablename__ = "content_posts"

    id = Column(String(36), primary_key=True, default=gen_id)
    table_id = Column(String(36), nullable=True)
    topic = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    date = Column(String(20), nullable=False)
    platform = Column(JSONB, default=list)
    format = Column(String(20), default="post")
    status = Column(String(30), default="idea")
    copy = Column(Text, nullable=True)
    media_url = Column(String(500), nullable=True)
    is_archived = Column(Boolean, default=False)
