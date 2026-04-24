"""Схемы API: OAuth почты (Gmail) и операции с ящиком."""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class MailOAuthStatusResponse(BaseModel):
    """Статус подключения и доступности OAuth на сервере."""

    model_config = ConfigDict(extra="ignore")

    configured: bool
    connected: bool
    provider: str | None = None
    accountEmail: str | None = None


class MailOAuthAuthorizeResponse(BaseModel):
    url: str


class MailMessageItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    threadId: str = ""
    subject: str = ""
    from_: str = Field(default="", alias="from")
    date: str = ""
    snippet: str = ""


class MailSendBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    to: str = Field(..., min_length=3, max_length=500)
    subject: str = Field(default="", max_length=998)
    body: str = Field(default="", max_length=500_000)


class MailSendResponse(BaseModel):
    id: str = ""
    threadId: str = ""
