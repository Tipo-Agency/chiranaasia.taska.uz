"""API производственных маршрутов."""
from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ProductionRouteStageItem(BaseModel):
    """Этап маршрута: как у воронки + ответственный по умолчанию."""

    model_config = ConfigDict(extra="allow")

    id: str = Field(..., min_length=1, max_length=100)
    title: str | None = Field(default=None, max_length=500)
    label: str | None = Field(default=None, max_length=500)
    color: str | None = Field(default=None, max_length=300)
    position: int | None = Field(default=None, ge=0, le=999_999)
    defaultAssigneeUserId: str | None = Field(default=None, max_length=36)

    @model_validator(mode="after")
    def _title_or_label(self) -> ProductionRouteStageItem:
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
        def_assign = d.pop("defaultAssigneeUserId", None)
        label_out = ((self.label or "").strip()[:500]) or title
        color = (
            str(color_raw).strip()[:300]
            if color_raw and str(color_raw).strip()
            else "bg-gray-200 dark:bg-gray-700"
        )
        position = index if pos is None else int(pos)
        extras = {k: v for k, v in d.items()}
        out = {
            **extras,
            "id": sid,
            "title": title,
            "label": label_out,
            "color": color,
            "position": position,
        }
        if def_assign and str(def_assign).strip():
            out["defaultAssigneeUserId"] = str(def_assign).strip()[:36]
        return out


class ProductionPipelineBulkItem(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    id: str = Field(..., min_length=1, max_length=36)
    name: str | None = Field(default=None, max_length=255)
    title: str | None = Field(default=None, max_length=255)
    color: str | None = Field(default=None, max_length=100)
    stages: list[ProductionRouteStageItem] | None = None
    createdAt: str | None = Field(default=None, max_length=50)
    updatedAt: str | None = Field(default=None, max_length=50)
    isArchived: bool = False


class ProductionPipelineRead(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    name: str
    title: str | None = None
    color: str | None = None
    stages: list[dict[str, Any]] = Field(default_factory=list)
    createdAt: str | None = None
    updatedAt: str | None = None
    isArchived: bool = False


class ProductionHandoffRead(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    orderId: str
    fromStageId: str
    toStageId: str
    status: str
    handedOverByUserId: str | None = None
    handedOverAt: str
    acceptedByUserId: str | None = None
    acceptedAt: str | None = None
    hasDefects: bool = False
    defectNotes: str | None = None
    notes: str | None = None


class ProductionOrderRead(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    version: int = 1
    pipelineId: str
    currentStageId: str
    title: str
    notes: str | None = None
    status: str
    createdAt: str
    updatedAt: str | None = None
    isArchived: bool = False
    pendingHandoff: ProductionHandoffRead | None = None


class ProductionOrderCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    pipelineId: str = Field(..., min_length=1, max_length=36)
    title: str = Field(..., min_length=1, max_length=500)
    notes: str | None = None


class ProductionOrderPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    version: int | None = Field(default=None, ge=1)
    title: str | None = Field(default=None, min_length=1, max_length=500)
    notes: str | None = None
    status: str | None = Field(default=None, max_length=30)
    isArchived: bool | None = None


class HandOverBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    notes: str | None = None


class HandoffResolveBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action: Literal["accept", "reject"]
    hasDefects: bool = False
    defectNotes: str | None = None
