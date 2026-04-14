"""Ответы JSON для POST /webhook/meta (очередь Meta)."""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class MetaWebhookJsonResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: str
    detail: str | None = None
    queued: bool | None = None
    deduplicated: bool | None = None
