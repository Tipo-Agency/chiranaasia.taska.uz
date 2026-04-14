"""Sales funnels router — stages/sources JSONB по docs/ENTITIES.md §6, валидация на запись."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.json_http_cache import json_304_or_response
from app.db import get_db
from app.models.funnel import SalesFunnel
from app.schemas.common_responses import OkResponse
from app.schemas.funnels import (
    FunnelBulkItem,
    FunnelCreateBody,
    FunnelPatchBody,
    FunnelRead,
    FunnelStageItem,
)
from app.services.domain_events import log_entity_mutation
from app.services.funnel_payload import (
    funnel_name_from_payload,
    validate_and_normalize_stages,
    validate_sources_tree,
)
from app.services.funnel_sources_crypto import encrypt_funnel_sources_for_storage

router = APIRouter(prefix="/funnels", tags=["funnels"], dependencies=[Depends(get_current_user)])


def _stages_to_validate(stages: list[FunnelStageItem] | None) -> list:
    if not stages:
        return []
    return [x.model_dump(mode="python") for x in stages]

_TG_SECRET_KEYS = frozenset(
    {"botToken", "token_encrypted", "webhookSecret", "webhook_secret_encrypted"}
)
_IG_SECRET_KEYS = frozenset({"accessToken", "access_token_encrypted"})
_SITE_SECRET_KEYS = frozenset({"apiKey", "api_key", "plaintextKey", "api_key_encrypted"})


def _persist_sources(raw: dict[str, Any]) -> dict[str, Any]:
    """Валидация + Fernet для секретов перед записью в JSONB."""
    return encrypt_funnel_sources_for_storage(validate_sources_tree(raw))


def _merge_telegram_sources(old: dict | None, new: dict | None) -> dict:
    if not isinstance(new, dict):
        return dict(old) if isinstance(old, dict) else {}
    if not isinstance(old, dict):
        old = {}
    merged = {**old, **new}
    if "botToken" not in new:
        if "token_encrypted" in old:
            merged["token_encrypted"] = old["token_encrypted"]
        elif "botToken" in old:
            merged["botToken"] = old["botToken"]
    if "webhookSecret" not in new:
        if "webhook_secret_encrypted" in old:
            merged["webhook_secret_encrypted"] = old["webhook_secret_encrypted"]
        elif "webhookSecret" in old:
            merged["webhookSecret"] = old["webhookSecret"]
    return merged


def _merge_instagram_sources(old: dict | None, new: dict | None) -> dict:
    if not isinstance(new, dict):
        return dict(old) if isinstance(old, dict) else {}
    if not isinstance(old, dict):
        old = {}
    merged = {**old, **new}
    if "accessToken" not in new:
        if "access_token_encrypted" in old:
            merged["access_token_encrypted"] = old["access_token_encrypted"]
        elif "accessToken" in old:
            merged["accessToken"] = old["accessToken"]
    return merged


def _merge_sources(existing: dict | None, incoming: dict | None) -> dict:
    if not isinstance(incoming, dict):
        return existing if isinstance(existing, dict) else {}
    if not isinstance(existing, dict):
        existing = {}
    merged = {**existing, **incoming}
    if isinstance(existing.get("telegram"), dict) and isinstance(incoming.get("telegram"), dict):
        merged["telegram"] = _merge_telegram_sources(existing.get("telegram"), incoming.get("telegram"))
    if isinstance(existing.get("instagram"), dict) and isinstance(incoming.get("instagram"), dict):
        merged["instagram"] = _merge_instagram_sources(existing.get("instagram"), incoming.get("instagram"))
    return merged


def _sanitize_sources(sources) -> dict[str, object]:
    if not isinstance(sources, dict):
        return {}
    out: dict[str, object] = {}
    for k, v in sources.items():
        if k == "telegram" and isinstance(v, dict):
            tv = {kk: vv for kk, vv in v.items() if kk not in _TG_SECRET_KEYS}
            if v.get("token_encrypted") or str(v.get("botToken") or "").strip():
                tv["botTokenSet"] = True
            if v.get("webhook_secret_encrypted") or str(v.get("webhookSecret") or "").strip():
                tv["webhookSecretSet"] = True
            out[k] = tv
        elif k == "instagram" and isinstance(v, dict):
            iv = {kk: vv for kk, vv in v.items() if kk not in _IG_SECRET_KEYS}
            if v.get("access_token_encrypted") or str(v.get("accessToken") or "").strip():
                iv["accessTokenSet"] = True
            out[k] = iv
        elif k == "site" and isinstance(v, dict):
            out[k] = {kk: vv for kk, vv in v.items() if kk not in _SITE_SECRET_KEYS}
        else:
            out[k] = v
    return out


def _stages_for_response(raw: list | None) -> list[FunnelStageItem]:
    """В ответе API: id, title, label, color, position (док + совместимость с UI)."""
    if not raw:
        return []
    out: list[FunnelStageItem] = []
    for i, s in enumerate(raw):
        if not isinstance(s, dict):
            continue
        sid = str(s.get("id", "")).strip()
        if not sid:
            continue
        title = (s.get("title") or s.get("label") or sid).strip()[:500]
        lab = (s.get("label") or title)[:500]
        row_d = {
            **s,
            "id": sid,
            "title": title,
            "label": lab,
            "position": s.get("position", i),
            "color": s.get("color") or "bg-gray-200 dark:bg-gray-700",
        }
        out.append(FunnelStageItem.model_validate(row_d))
    return out


def row_to_funnel(row: SalesFunnel) -> FunnelRead:
    nt = getattr(row, "notification_templates", None) or {}
    name = row.name or ""
    templates: dict[str, object] = nt if isinstance(nt, dict) else {}
    return FunnelRead(
        id=row.id,
        title=name,
        name=name,
        color=row.color,
        ownerUserId=getattr(row, "owner_user_id", None),
        stages=_stages_for_response(row.stages or []),
        sources=_sanitize_sources(row.sources or {}),
        notificationTemplates=templates,
        createdAt=row.created_at,
        updatedAt=row.updated_at,
        isArchived=str(row.is_archived).lower() == "true" if row.is_archived else False,
    )


@router.get("", response_model=list[FunnelRead])
async def get_funnels(request: Request, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SalesFunnel).order_by(SalesFunnel.id))
    data = [row_to_funnel(f) for f in result.scalars().all()]
    return json_304_or_response(request, data=data, max_age=300)


@router.put("", response_model=OkResponse)
async def update_funnels(funnels: list[FunnelBulkItem], db: AsyncSession = Depends(get_db)):
    for f in funnels:
        fid = f.id
        if not fid:
            continue
        fs = f.model_fields_set
        existing = await db.get(SalesFunnel, fid)
        is_new = existing is None
        display_name = funnel_name_from_payload(f.model_dump(mode="python"))
        if existing:
            existing.name = display_name
            if "color" in fs:
                existing.color = f.color
            if "ownerUserId" in fs:
                existing.owner_user_id = f.ownerUserId
            if "stages" in fs:
                existing.stages = validate_and_normalize_stages(_stages_to_validate(f.stages))
            if "sources" in fs:
                merged_src = _merge_sources(existing.sources or {}, f.sources or {})
                existing.sources = _persist_sources(merged_src)
            if "notificationTemplates" in fs:
                existing.notification_templates = f.notificationTemplates or {}
            if "createdAt" in fs:
                existing.created_at = f.createdAt
            if "updatedAt" in fs:
                existing.updated_at = f.updatedAt
            if "isArchived" in fs:
                existing.is_archived = "true" if f.isArchived else "false"
        else:
            stages_in = validate_and_normalize_stages(_stages_to_validate(f.stages))
            src_in = f.sources or {}
            db.add(
                SalesFunnel(
                    id=fid,
                    name=display_name,
                    color=f.color,
                    owner_user_id=f.ownerUserId,
                    stages=stages_in,
                    sources=_persist_sources(src_in),
                    notification_templates=f.notificationTemplates or {},
                    created_at=f.createdAt,
                    updated_at=f.updatedAt,
                    is_archived="true" if f.isArchived else "false",
                )
            )
        await db.flush()
        await log_entity_mutation(
            db,
            event_type="sales_funnel.created" if is_new else "sales_funnel.updated",
            entity_type="sales_funnel",
            entity_id=fid,
            source="funnels-router",
            payload={"name": display_name},
        )
    await db.commit()
    return OkResponse()


@router.post("", response_model=FunnelRead)
async def create_funnel(funnel: FunnelCreateBody, db: AsyncSession = Depends(get_db)):
    fid = funnel.id or f"funnel-{int(datetime.utcnow().timestamp() * 1000)}"
    now = datetime.utcnow().isoformat()
    display_name = funnel_name_from_payload(funnel.model_dump(mode="python"))
    stages_in = validate_and_normalize_stages(_stages_to_validate(funnel.stages))
    src_in = funnel.sources or {}
    db.add(
        SalesFunnel(
            id=fid,
            name=display_name,
            color=funnel.color,
            owner_user_id=funnel.ownerUserId,
            stages=stages_in,
            sources=_persist_sources(src_in),
            notification_templates=funnel.notificationTemplates or {},
            created_at=now,
            updated_at=now,
            is_archived="false",
        )
    )
    await db.flush()
    await log_entity_mutation(
        db,
        event_type="sales_funnel.created",
        entity_type="sales_funnel",
        entity_id=fid,
        source="funnels-router",
        payload={"name": display_name},
    )
    await db.commit()
    result = await db.get(SalesFunnel, fid)
    return row_to_funnel(result)


@router.get("/{funnel_id}", response_model=Optional[FunnelRead])
async def get_funnel(funnel_id: str, db: AsyncSession = Depends(get_db)):
    f = await db.get(SalesFunnel, funnel_id)
    if not f:
        return None
    return row_to_funnel(f)


@router.patch("/{funnel_id}", response_model=Optional[FunnelRead])
async def update_funnel(funnel_id: str, updates: FunnelPatchBody, db: AsyncSession = Depends(get_db)):
    f = await db.get(SalesFunnel, funnel_id)
    if not f:
        return None
    fs = updates.model_fields_set
    if "title" in fs or "name" in fs:
        payload = {"name": f.name}
        if "title" in fs:
            payload["title"] = updates.title
        if "name" in fs:
            payload["name"] = updates.name
        f.name = funnel_name_from_payload(payload)
    if "color" in fs:
        f.color = updates.color
    if "ownerUserId" in fs:
        f.owner_user_id = updates.ownerUserId
    if "stages" in fs:
        f.stages = validate_and_normalize_stages(_stages_to_validate(updates.stages))
    if "sources" in fs and updates.sources is not None:
        merged = _merge_sources(f.sources or {}, updates.sources or {})
        f.sources = _persist_sources(merged)
    if "notificationTemplates" in fs:
        f.notification_templates = updates.notificationTemplates or {}
    if "isArchived" in fs:
        f.is_archived = "true" if updates.isArchived else "false"
    f.updated_at = datetime.utcnow().isoformat()
    await db.flush()
    await log_entity_mutation(
        db,
        event_type="sales_funnel.patched",
        entity_type="sales_funnel",
        entity_id=funnel_id,
        source="funnels-router",
        payload={"name": f.name, "updates": sorted(fs)},
    )
    await db.commit()
    await db.refresh(f)
    return row_to_funnel(f)


@router.delete("/{funnel_id}", response_model=OkResponse)
async def delete_funnel(funnel_id: str, db: AsyncSession = Depends(get_db)):
    f = await db.get(SalesFunnel, funnel_id)
    if f:
        f.is_archived = "true"
        await db.flush()
        await log_entity_mutation(
            db,
            event_type="sales_funnel.archived",
            entity_type="sales_funnel",
            entity_id=funnel_id,
            source="funnels-router",
            payload={"name": f.name},
        )
        await db.commit()
    return OkResponse()
