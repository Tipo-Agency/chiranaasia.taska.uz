"""Pydantic-схемы для bulk PUT: docs, content_posts, activity."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class DocItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(..., min_length=1, max_length=100)
    tableId: str | None = Field(default=None, max_length=100)
    folderId: str | None = Field(default=None, max_length=100)
    title: str = Field(default="", max_length=1000)
    type: str = Field(default="internal", max_length=50)
    url: str | None = None
    content: str | None = None
    tags: list[str] = Field(default_factory=list)
    isArchived: bool = False
    updatedByUserId: str | None = Field(default=None, max_length=100)
    createdByUserId: str | None = Field(default=None, max_length=100)
    recipientIds: list[str] = Field(default_factory=list)
    sharedByUserId: str | None = Field(default=None, max_length=100)


class ContentPostItem(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    id: str = Field(..., min_length=1, max_length=100)
    tableId: str | None = Field(default=None, max_length=100)
    topic: str = Field(default="", max_length=500)
    description: str | None = None
    date: str = Field(default="", max_length=50)
    platform: list[str] = Field(default_factory=list)
    format: str = Field(default="post", max_length=100)
    status: str = Field(default="idea", max_length=100)
    # Не «copy»: затеняет BaseModel — вход JSON по-прежнему { "copy": "..." }
    post_copy: str | None = Field(default=None, validation_alias="copy", serialization_alias="copy")
    mediaUrl: str | None = None
    isArchived: bool = False
    updatedByUserId: str | None = Field(default=None, max_length=100)
    createdByUserId: str | None = Field(default=None, max_length=100)


class ContentPostRead(BaseModel):
    """GET /content-posts и публичный контент-план — как row_to_post."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True, serialize_by_alias=True)

    id: str
    tableId: str = ""
    topic: str = ""
    description: str | None = None
    date: str = ""
    platform: list[str] = Field(default_factory=list)
    format: str = ""
    status: str = ""
    post_copy: str | None = Field(default=None, validation_alias="copy", serialization_alias="copy")
    mediaUrl: str | None = None
    isArchived: bool = False


class ActivityLogItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(..., min_length=1, max_length=100)
    userId: str = Field(default="", max_length=100)
    userName: str = Field(default="", max_length=255)
    userAvatar: str | None = None
    action: str = Field(default="", max_length=500)
    details: Any = None
    timestamp: str = Field(default="", max_length=100)
    read: bool = False


class DocRead(BaseModel):
    """GET /docs — только поля из row_to_doc."""

    model_config = ConfigDict(extra="ignore")

    id: str
    tableId: str | None = None
    folderId: str | None = None
    title: str = ""
    type: str = "internal"
    url: str | None = None
    content: str | None = None
    tags: list[str] = Field(default_factory=list)
    isArchived: bool = False


class ActivityLogRead(BaseModel):
    """GET /activity — без лишних полей от ORM."""

    model_config = ConfigDict(extra="ignore")

    id: str
    userId: str = ""
    userName: str = ""
    userAvatar: str | None = None
    action: str = ""
    details: Any = None
    timestamp: str = ""
    read: bool = False


class ActivityLogCreate(BaseModel):
    """POST /activity — одна запись лога (id опционален)."""

    model_config = ConfigDict(extra="forbid")

    id: str | None = Field(default=None, max_length=100)
    userId: str = Field(default="", max_length=100)
    userName: str = Field(default="", max_length=255)
    userAvatar: str | None = None
    action: str = Field(default="", max_length=500)
    details: Any = None
    timestamp: str = Field(default="", max_length=100)
    read: bool = False
