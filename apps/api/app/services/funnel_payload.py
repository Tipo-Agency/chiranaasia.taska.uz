"""Валидация и нормализация JSONB воронки (docs/ENTITIES.md §6)."""
from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from fastapi import HTTPException
from pydantic import TypeAdapter, ValidationError

from app.schemas.funnels import FunnelSourcesRoot, FunnelStageItem

_MAX_STAGES = 150

_ALLOWED_SOURCE_ROOT = frozenset({"telegram", "instagram", "site"})


def funnel_name_from_payload(payload: Mapping[str, Any]) -> str:
    """Колонка БД `name` = сущность `title` из ENTITIES §6; в API допускаются оба ключа."""
    for key in ("title", "name"):
        if key not in payload:
            continue
        v = payload.get(key)
        if v is None:
            continue
        s = str(v).strip()
        if s:
            return s[:255]
    return "Новая воронка"


def validate_and_normalize_stages(raw: Any) -> list[dict[str, Any]]:
    if raw is None:
        return []
    if not isinstance(raw, list):
        raise HTTPException(status_code=400, detail="funnel_stages_must_be_array")
    if len(raw) > _MAX_STAGES:
        raise HTTPException(status_code=400, detail="funnel_stages_too_many")
    try:
        adapter = TypeAdapter(list[FunnelStageItem])
        items = adapter.validate_python(raw)
    except ValidationError as e:
        raise HTTPException(status_code=400, detail={"funnel_stages_validation": e.errors()}) from e
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for i, it in enumerate(items):
        sid = it.id.strip()
        if sid in seen:
            raise HTTPException(status_code=400, detail={"funnel_stages_duplicate_id": sid})
        seen.add(sid)
        out.append(it.normalized_dict(i))
    return out


def validate_sources_tree(raw: Any) -> dict[str, Any]:
    """
    Проверка корня `sources`: только telegram | instagram | site (ENTITIES §6).
    Внутри блоков допускаются поля UI/API сверх доки (extra allow).
    """
    if raw is None:
        return {}
    if not isinstance(raw, dict):
        raise HTTPException(status_code=400, detail="funnel_sources_must_be_object")
    unknown = set(raw.keys()) - _ALLOWED_SOURCE_ROOT
    if unknown:
        raise HTTPException(
            status_code=400,
            detail={"funnel_sources_unknown_root_keys": sorted(unknown)},
        )
    try:
        root = FunnelSourcesRoot.model_validate(raw)
    except ValidationError as e:
        raise HTTPException(status_code=400, detail={"funnel_sources_validation": e.errors()}) from e
    dumped = root.model_dump(mode="python", exclude_none=False)
    return {k: v for k, v in dumped.items() if v is not None}
