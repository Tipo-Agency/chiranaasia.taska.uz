"""Ответ публичного GET /tables/public/content-plan/{table_id} (узкий контракт)."""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class PublicTableRead(BaseModel):
    """Таблица для публичной страницы — без системных/архивных/флага публикации."""

    model_config = ConfigDict(extra="forbid")

    id: str
    name: str = ""
    type: str = ""
    icon: str | None = None
    color: str | None = None


class PublicContentPostRead(BaseModel):
    """Поле текста поста — `post_copy` в Python (не затеняет BaseModel.copy), в JSON — `copy`."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True, serialize_by_alias=True)

    id: str
    topic: str = ""
    description: str | None = None
    date: str = ""
    platform: list[str] = Field(default_factory=list)
    format: str = ""
    status: str = ""
    post_copy: str | None = Field(default=None, validation_alias="copy", serialization_alias="copy")
    mediaUrl: str | None = None


class PublicShootPlanRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    title: str = ""
    date: str = ""
    time: str = ""
    items: list[dict[str, object]] = Field(default_factory=list)


class PublicContentPlanResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    table: PublicTableRead | None = None
    posts: list[PublicContentPostRead] = Field(default_factory=list)
    shootPlans: list[PublicShootPlanRead] = Field(default_factory=list)
