"""Website lead intake + API key management bound to sales funnels."""

from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user_admin
from app.database import get_db
from app.models.client import Deal
from app.models.funnel import SalesFunnel
from app.models.site_integration import SiteIntegrationKey
from app.services.domain_events import emit_domain_event

router = APIRouter(prefix="/integrations/site", tags=["integrations-site"])


def _sha256_hex(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _now_iso() -> str:
    return datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def _pick_default_stage_id(funnel: SalesFunnel) -> str:
    sources = funnel.sources or {}
    site = sources.get("site") if isinstance(sources, dict) else None
    if isinstance(site, dict):
        if site.get("enabled") is False:
            return "new"
        ds = site.get("defaultStageId")
        if isinstance(ds, str) and ds:
            return ds
    stages = funnel.stages or []
    if isinstance(stages, list) and stages:
        sid = (stages[0] or {}).get("id") if isinstance(stages[0], dict) else None
        if isinstance(sid, str) and sid:
            return sid
    return "new"


def _pick_default_assignee_id(funnel: SalesFunnel) -> str | None:
    sources = funnel.sources or {}
    site = sources.get("site") if isinstance(sources, dict) else None
    if isinstance(site, dict):
        uid = site.get("defaultAssigneeId")
        if isinstance(uid, str) and uid:
            return uid
    uid = getattr(funnel, "owner_user_id", None)
    return uid if isinstance(uid, str) and uid else None


@router.post("/keys/rotate")
async def rotate_site_key(
    body: dict,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(get_current_user_admin),
):
    """Rotate / create API key for a funnel. Returns plaintext key once."""
    funnel_id = str(body.get("funnelId") or "").strip()
    if not funnel_id:
        raise HTTPException(status_code=400, detail="funnelId_required")

    funnel = await db.get(SalesFunnel, funnel_id)
    if not funnel:
        raise HTTPException(status_code=404, detail="funnel_not_found")

    # Deactivate existing key (if any)
    existing = (
        await db.execute(
            select(SiteIntegrationKey).where(
                SiteIntegrationKey.funnel_id == funnel_id,
                SiteIntegrationKey.is_active.is_(True),
            )
        )
    ).scalar_one_or_none()
    if existing:
        existing.is_active = False
        existing.rotated_at = datetime.utcnow()
        await db.flush()

    api_key = secrets.token_urlsafe(32)
    key_hash = _sha256_hex(api_key)
    last4 = api_key[-4:] if len(api_key) >= 4 else api_key
    row = SiteIntegrationKey(
        id=str(uuid.uuid4()),
        funnel_id=funnel_id,
        api_key_hash=key_hash,
        key_last4=last4,
        is_active=True,
        rotated_at=None,
    )
    db.add(row)
    await db.commit()
    return {"ok": True, "funnelId": funnel_id, "apiKey": api_key, "keyLast4": last4}


@router.get("/keys/status")
async def site_key_status(
    funnel_id: str,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(get_current_user_admin),
):
    """Return active key info for funnel (no plaintext key)."""
    row = (
        await db.execute(
            select(SiteIntegrationKey).where(
                SiteIntegrationKey.funnel_id == funnel_id,
                SiteIntegrationKey.is_active.is_(True),
            )
        )
    ).scalar_one_or_none()
    return {"ok": True, "funnelId": funnel_id, "active": bool(row), "keyLast4": row.key_last4 if row else None}


@router.post("/leads")
async def create_lead_from_site(
    payload: dict[str, Any],
    db: AsyncSession = Depends(get_db),
    x_api_key: str | None = Header(default=None, alias="X-Api-Key"),
):
    """
    Public intake endpoint. Creates Deal in a configured funnel.
    Auth: X-Api-Key header (plaintext key); server matches sha256 hash.
    """
    if not x_api_key or not str(x_api_key).strip():
        raise HTTPException(status_code=401, detail="api_key_required")

    key_hash = _sha256_hex(str(x_api_key).strip())
    key_row = (
        await db.execute(
            select(SiteIntegrationKey).where(
                SiteIntegrationKey.api_key_hash == key_hash,
                SiteIntegrationKey.is_active.is_(True),
            )
        )
    ).scalar_one_or_none()
    if not key_row:
        raise HTTPException(status_code=401, detail="invalid_api_key")

    funnel = await db.get(SalesFunnel, key_row.funnel_id)
    if not funnel:
        raise HTTPException(status_code=400, detail="funnel_missing_for_key")
    sources = funnel.sources or {}
    site_cfg = sources.get("site") if isinstance(sources, dict) else None
    # Require explicit enablement in funnel settings
    if not (isinstance(site_cfg, dict) and site_cfg.get("enabled") is True):
        raise HTTPException(status_code=403, detail="site_integration_disabled")

    name = str(payload.get("name") or payload.get("contactName") or "").strip()
    phone = str(payload.get("phone") or "").strip()
    email = str(payload.get("email") or "").strip()
    message = str(payload.get("message") or payload.get("notes") or "").strip()
    title = str(payload.get("title") or "Заявка с сайта").strip() or "Заявка с сайта"

    lines: list[str] = []
    if message:
        lines.append(message)
    if phone:
        lines.append(f"Телефон: {phone}")
    if email:
        lines.append(f"Email: {email}")
    utm = payload.get("utm")
    if isinstance(utm, dict) and utm:
        # keep a short stable order
        for k in ["source", "medium", "campaign", "term", "content"]:
            v = utm.get(k)
            if v:
                lines.append(f"utm_{k}: {v}")

    metadata = payload.get("metadata")
    if isinstance(metadata, dict) and metadata:
        # Store as JSON-ish string. We intentionally keep it in notes to avoid schema explosion.
        lines.append(f"metadata: {metadata}")

    deal_id = str(uuid.uuid4())
    assignee_id = _pick_default_assignee_id(funnel) or ""
    deal = Deal(
        id=deal_id,
        title=title[:500],
        funnel_id=key_row.funnel_id,
        stage=_pick_default_stage_id(funnel),
        source="site",
        contact_name=name[:255] if name else None,
        assignee_id=assignee_id,
        amount="0",
        currency="UZS",
        created_at=_now_iso(),
        notes="\n".join(lines) if lines else None,
        is_archived=False,
    )
    db.add(deal)
    await db.flush()
    if assignee_id:
        await emit_domain_event(
            db,
            event_type="deal.assigned",
            org_id="default",
            entity_type="deal",
            entity_id=deal_id,
            source="integrations-site",
            actor_id=None,
            payload={
                "dealId": deal_id,
                "title": deal.title,
                "assigneeId": assignee_id,
                "actorName": "Сайт",
            },
        )
    await db.commit()
    saved = await db.get(Deal, deal_id)
    # minimal response for integrators
    return {"ok": True, "dealId": deal_id, "funnelId": key_row.funnel_id, "stage": saved.stage if saved else deal.stage}

