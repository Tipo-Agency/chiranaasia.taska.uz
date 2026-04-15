"""Нормализация этапов производственного маршрута."""
from __future__ import annotations

from typing import Any

from fastapi import HTTPException
from pydantic import TypeAdapter, ValidationError

from app.schemas.production import ProductionRouteStageItem

_MAX_STAGES = 80


def pipeline_display_name(payload: dict[str, Any]) -> str:
    for key in ("title", "name"):
        v = payload.get(key)
        if v is None:
            continue
        s = str(v).strip()
        if s:
            return s[:255]
    return "Новый маршрут"


def validate_and_normalize_production_stages(raw: Any) -> list[dict[str, Any]]:
    if raw is None:
        return []
    if not isinstance(raw, list):
        raise HTTPException(status_code=400, detail="production_stages_must_be_array")
    if len(raw) > _MAX_STAGES:
        raise HTTPException(status_code=400, detail="production_stages_too_many")
    try:
        adapter = TypeAdapter(list[ProductionRouteStageItem])
        items = adapter.validate_python(raw)
    except ValidationError as e:
        raise HTTPException(status_code=400, detail={"production_stages_validation": e.errors()}) from e
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for i, it in enumerate(items):
        sid = it.id.strip()
        if sid in seen:
            raise HTTPException(status_code=400, detail={"production_stages_duplicate_id": sid})
        seen.add(sid)
        out.append(it.normalized_dict(i))
    return out
