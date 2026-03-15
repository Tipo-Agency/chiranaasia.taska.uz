"""Site content models: PartnerLogo, News, Case, Tag."""
from sqlalchemy import Column, String, Boolean, Text
from sqlalchemy.dialects.postgresql import JSONB
from app.database import Base
import uuid


def gen_id():
    return str(uuid.uuid4())


class PartnerLogo(Base):
    __tablename__ = "partner_logos"

    id = Column(String(36), primary_key=True, default=gen_id)
    name = Column(String(255), nullable=False)
    logo_url = Column(String(500), nullable=False)
    website_url = Column(String(500), nullable=True)
    order_val = Column(String(10), default="0")
    created_at = Column(String(30), nullable=True)
    updated_at = Column(String(30), nullable=True)
    is_archived = Column(String(10), default="false")


class News(Base):
    __tablename__ = "news"

    id = Column(String(36), primary_key=True, default=gen_id)
    title = Column(String(500), nullable=False)
    content = Column(Text, nullable=True)
    image_url = Column(String(500), nullable=True)
    excerpt = Column(String(500), nullable=True)
    tags = Column(JSONB, default=list)
    published = Column(String(10), default="false")
    published_at = Column(String(30), nullable=True)
    created_at = Column(String(30), nullable=True)
    updated_at = Column(String(30), nullable=True)
    is_archived = Column(String(10), default="false")


class Case(Base):
    __tablename__ = "cases"

    id = Column(String(36), primary_key=True, default=gen_id)
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    image_url = Column(String(500), nullable=True)
    excerpt = Column(String(500), nullable=True)
    client_name = Column(String(255), nullable=True)
    website_url = Column(String(500), nullable=True)
    instagram_url = Column(String(500), nullable=True)
    tags = Column(JSONB, default=list)
    order_val = Column(String(10), default="0")
    published = Column(String(10), default="false")
    created_at = Column(String(30), nullable=True)
    updated_at = Column(String(30), nullable=True)
    is_archived = Column(String(10), default="false")


class Tag(Base):
    __tablename__ = "tags"

    id = Column(String(36), primary_key=True, default=gen_id)
    name = Column(String(255), nullable=False)
    color = Column(String(50), nullable=True)
    created_at = Column(String(30), nullable=True)
    updated_at = Column(String(30), nullable=True)
    is_archived = Column(String(10), default="false")
