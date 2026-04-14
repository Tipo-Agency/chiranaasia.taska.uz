"""Pydantic-схемы воронки (docs/ENTITIES.md §6): stages, sources."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator


class FunnelStageItem(BaseModel):
    """
    Стадия: в доке `{ id, title, color, position }`; в UI часто `label` вместо `title` — оба допустимы.
    Дополнительные поля (например taskTemplate) сохраняются в JSONB.
    """

    model_config = ConfigDict(extra="allow")

    id: str = Field(..., min_length=1, max_length=100)
    title: str | None = Field(default=None, max_length=500)
    label: str | None = Field(default=None, max_length=500)
    color: str | None = Field(default=None, max_length=300)
    position: int | None = Field(default=None, ge=0, le=999_999)

    @model_validator(mode="after")
    def _title_or_label(self) -> FunnelStageItem:
        t = (self.title or "").strip()
        lbl = (self.label or "").strip()
        if not t and not lbl:
            raise ValueError("stage must have non-empty title or label")
        return self

    def normalized_dict(self, index: int) -> dict[str, Any]:
        d = self.model_dump(mode="python")
        sid = str(d.pop("id", self.id)).strip()[:100]
        title = (d.pop("title", None) or d.pop("label", None) or "").strip() or sid
        title = title[:500]
        color_raw = d.pop("color", None)
        pos = d.pop("position", None)
        label_out = ((self.label or "").strip()[:500]) or title
        color = (
            str(color_raw).strip()[:300]
            if color_raw and str(color_raw).strip()
            else "bg-gray-200 dark:bg-gray-700"
        )
        position = index if pos is None else int(pos)
        extras = {k: v for k, v in d.items()}
        return {
            **extras,
            "id": sid,
            "title": title,
            "label": label_out,
            "color": color,
            "position": position,
        }


class TelegramSourceBlock(BaseModel):
    model_config = ConfigDict(extra="allow")

    enabled: bool | None = None
    chat_id: str | None = Field(default=None, max_length=255)
    token_encrypted: str | None = Field(default=None, max_length=50_000)
    webhook_secret_encrypted: str | None = Field(default=None, max_length=50_000)


class InstagramSourceBlock(BaseModel):
    model_config = ConfigDict(extra="allow")

    enabled: bool | None = None
    page_id: str | None = Field(default=None, max_length=255)
    access_token_encrypted: str | None = Field(default=None, max_length=50_000)


class SiteSourceBlock(BaseModel):
    model_config = ConfigDict(extra="allow")

    enabled: bool | None = None
    api_key_encrypted: str | None = Field(default=None, max_length=50_000)


class FunnelSourcesRoot(BaseModel):
    """
    Корень `sources`: только каналы из ENTITIES.md §6.
    Внутри блоков — extra=\"allow\" (plaintext при записи с клиента шифруется на сервере).
    """

    model_config = ConfigDict(extra="forbid")

    telegram: TelegramSourceBlock | None = None
    instagram: InstagramSourceBlock | None = None
    site: SiteSourceBlock | None = None


class FunnelBulkItem(BaseModel):
    """Элемент массовой синхронизации PUT /funnels."""

    model_config = ConfigDict(extra="forbid")

    id: str = Field(..., min_length=1, max_length=100)
    title: str | None = Field(default=None, max_length=500)
    name: str | None = Field(default=None, max_length=500)
    color: str | None = Field(default=None, max_length=200)
    ownerUserId: str | None = Field(default=None, max_length=100)
    stages: list[FunnelStageItem] | None = None
    sources: dict[str, Any] | None = None
    notificationTemplates: dict[str, Any] | None = None
    createdAt: str | None = None
    updatedAt: str | None = None
    isArchived: bool = False


class FunnelCreateBody(BaseModel):
    """POST /funnels."""

    model_config = ConfigDict(extra="forbid")

    id: str | None = Field(default=None, max_length=100)
    title: str | None = Field(default=None, max_length=500)
    name: str | None = Field(default=None, max_length=500)
    color: str | None = Field(default=None, max_length=200)
    ownerUserId: str | None = Field(default=None, max_length=100)
    stages: list[FunnelStageItem] | None = None
    sources: dict[str, Any] | None = None
    notificationTemplates: dict[str, Any] | None = None


class FunnelPatchBody(BaseModel):
    """PATCH /funnels/{id}."""

    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, max_length=500)
    name: str | None = Field(default=None, max_length=500)
    color: str | None = Field(default=None, max_length=200)
    ownerUserId: str | None = Field(default=None, max_length=100)
    stages: list[FunnelStageItem] | None = None
    sources: dict[str, Any] | None = None
    notificationTemplates: dict[str, Any] | None = None
    isArchived: bool | None = None


class FunnelRead(BaseModel):
    """GET /funnels — как row_to_funnel."""

    model_config = ConfigDict(extra="ignore")

    id: str
    title: str = ""
    name: str = ""
    color: str | None = None
    ownerUserId: str | None = None
    stages: list[FunnelStageItem] = Field(default_factory=list)
    sources: dict[str, object] = Field(default_factory=dict)
    notificationTemplates: dict[str, object] = Field(default_factory=dict)
    createdAt: str | None = None
    updatedAt: str | None = None
    isArchived: bool = False
