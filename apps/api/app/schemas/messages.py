"""Тела запросов для роутера сообщений."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.pagination import PaginatedResponse


class InboxMessageRead(BaseModel):
    """GET /messages — как row_to_inbox_message."""

    model_config = ConfigDict(extra="ignore")

    id: str
    senderId: str | None = None
    recipientId: str | None = None
    text: str = ""
    body: str = ""
    attachments: list[Any] = Field(default_factory=list)
    createdAt: str | None = None
    read: bool = False
    isRead: bool = False
    dealId: str | None = None
    funnelId: str | None = None
    direction: str = "internal"
    channel: str = "internal"
    mediaUrl: str | None = None
    externalMsgId: str | None = None


class MessageListResponse(PaginatedResponse[InboxMessageRead]):
    """GET /messages."""

    pass


class MessageCreateBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str | None = Field(default=None, max_length=100)
    recipientId: str | None = Field(default=None, max_length=100)
    body: str | None = Field(default=None, max_length=100_000)
    text: str | None = Field(default=None, max_length=100_000)
    channel: str | None = Field(default=None, max_length=50)
    externalMsgId: str | None = Field(default=None, max_length=255)
    external_msg_id: str | None = Field(default=None, max_length=255)
    direction: str | None = Field(default=None, max_length=20)
    dealId: str | None = Field(default=None, max_length=36)
    deal_id: str | None = Field(default=None, max_length=36)
    funnelId: str | None = Field(default=None, max_length=36)
    funnel_id: str | None = Field(default=None, max_length=36)
    mediaUrl: str | None = None
    media_url: str | None = None
    senderId: str | None = Field(default=None, max_length=100)
    attachments: list[Any] = Field(default_factory=list)
    createdAt: str | None = Field(default=None, max_length=100)


class MessageReadPatchBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    read: bool | None = None
    isRead: bool | None = None
