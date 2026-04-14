"""Website lead intake + API key management bound to sales funnels."""

import hashlib
import re
import secrets
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.rate_limit import limiter
from app.db import get_db
from app.models.client import Deal
from app.models.funnel import SalesFunnel
from app.models.site_integration import SiteIntegrationKey
from app.models.user import User
from app.schemas.integrations import (
    FunnelIdBody,
    SiteKeyRotateResponse,
    SiteKeyStatusResponse,
    SiteLeadIntakeResponse,
    SiteLeadPayload,
)
from app.services.domain_events import emit_domain_event
from app.services.rbac import user_can_manage_funnel_site_key

router = APIRouter(prefix="/integrations/site", tags=["integrations-site"])


def _sha256_hex(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _now_iso() -> str:
    return datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def _normalize_phone_for_dedup(raw: str) -> str:
    """Только цифры — чтобы +998 90 … и 99890… считались одним номером."""
    digits = re.sub(r"\D", "", (raw or "").strip())
    return digits[:32] if digits else ""


def _normalize_email_for_dedup(raw: str) -> str:
    return (raw or "").strip().lower()[:255]


async def _find_duplicate_site_lead(
    db: AsyncSession,
    *,
    funnel_id: str,
    phone_norm: str,
    email_norm: str,
) -> Optional[Deal]:
    if not phone_norm and not email_norm:
        return None
    parts: List[Any] = []
    if phone_norm:
        parts.append(Deal.custom_fields.contains({"_site": {"phone": phone_norm}}))
    if email_norm:
        parts.append(Deal.custom_fields.contains({"_site": {"email": email_norm}}))
    res = await db.execute(
        select(Deal)
        .where(
            Deal.funnel_id == funnel_id,
            Deal.source == "site",
            Deal.is_archived.is_(False),
            or_(*parts),
        )
        .order_by(Deal.created_at.desc())
        .limit(1)
    )
    return res.scalar_one_or_none()


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


def _stage_label(funnel: SalesFunnel, stage_id: str) -> str:
    stages = funnel.stages or []
    if isinstance(stages, list):
        for s in stages:
            if isinstance(s, dict) and str(s.get("id") or "") == str(stage_id):
                lab = s.get("label")
                return str(lab) if lab is not None else str(stage_id)
    return str(stage_id)


def _pick_default_assignee_id(funnel: SalesFunnel) -> Optional[str]:
    sources = funnel.sources or {}
    site = sources.get("site") if isinstance(sources, dict) else None
    if isinstance(site, dict):
        uid = site.get("defaultAssigneeId")
        if isinstance(uid, str) and uid:
            return uid
    uid = getattr(funnel, "owner_user_id", None)
    return uid if isinstance(uid, str) and uid else None


@router.post("/keys/rotate", response_model=SiteKeyRotateResponse)
async def rotate_site_key(
    body: FunnelIdBody,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Rotate / create API key for a funnel. Returns plaintext key once."""
    funnel_id = body.funnelId

    funnel = await db.get(SalesFunnel, funnel_id)
    if not funnel:
        raise HTTPException(status_code=404, detail="funnel_not_found")
    if not await user_can_manage_funnel_site_key(db, current_user, funnel):
        raise HTTPException(status_code=403, detail="forbidden")

    # NOTE: funnel_id has a UNIQUE index — keep one row per funnel and update it on rotate.
    existing = (
        await db.execute(
            select(SiteIntegrationKey).where(
                SiteIntegrationKey.funnel_id == funnel_id,
            )
        )
    ).scalar_one_or_none()

    api_key = secrets.token_urlsafe(32)
    key_hash = _sha256_hex(api_key)
    last4 = api_key[-4:] if len(api_key) >= 4 else api_key
    if existing:
        existing.api_key_hash = key_hash
        existing.key_last4 = last4
        existing.is_active = True
        existing.rotated_at = datetime.utcnow()
        await db.flush()
    else:
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
    return SiteKeyRotateResponse(
        funnelId=funnel_id,
        apiKey=api_key,
        keyLast4=last4,
    )


@router.get("/keys/status", response_model=SiteKeyStatusResponse)
async def site_key_status(
    funnel_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return active key info for funnel (no plaintext key)."""
    funnel = await db.get(SalesFunnel, funnel_id)
    if not funnel:
        raise HTTPException(status_code=404, detail="funnel_not_found")
    if not await user_can_manage_funnel_site_key(db, current_user, funnel):
        raise HTTPException(status_code=403, detail="forbidden")
    row = (
        await db.execute(
            select(SiteIntegrationKey).where(
                SiteIntegrationKey.funnel_id == funnel_id,
                SiteIntegrationKey.is_active.is_(True),
            )
        )
    ).scalar_one_or_none()
    return SiteKeyStatusResponse(
        funnelId=funnel_id,
        active=bool(row),
        keyLast4=row.key_last4 if row else None,
    )


@router.post(
    "/leads",
    response_model=SiteLeadIntakeResponse,
    responses={
        201: {"description": "Лид создан"},
        200: {"description": "Дубликат (тот же телефон или email в воронке)"},
        401: {"description": "Нет или неверный X-Api-Key"},
        429: {"description": "Слишком много запросов с этого IP (30/мин); см. Retry-After"},
    },
)
@limiter.limit("30/minute")
async def create_lead_from_site(
    request: Request,
    lead: SiteLeadPayload = Body(),
    db: AsyncSession = Depends(get_db),
    x_api_key: Optional[str] = Header(default=None, alias="X-Api-Key"),
):
    """
    Public intake endpoint. Creates Deal in a configured funnel.
    Auth: X-Api-Key header (plaintext key); сверка digest через constant-time compare.
    """
    if not x_api_key or not str(x_api_key).strip():
        raise HTTPException(status_code=401, detail="api_key_required")

    candidate_hash = _sha256_hex(str(x_api_key).strip())
    key_row = (
        await db.execute(
            select(SiteIntegrationKey).where(
                SiteIntegrationKey.api_key_hash == candidate_hash,
                SiteIntegrationKey.is_active.is_(True),
            )
        )
    ).scalar_one_or_none()
    # Constant-time сравнение digest (защита от утечек по времени при неверном ключе).
    sentinel_digest = "0" * 64
    expected_digest = key_row.api_key_hash if key_row else sentinel_digest
    if not secrets.compare_digest(candidate_hash, expected_digest) or key_row is None:
        raise HTTPException(status_code=401, detail="invalid_api_key")

    funnel = await db.get(SalesFunnel, key_row.funnel_id)
    if not funnel:
        raise HTTPException(status_code=400, detail="funnel_missing_for_key")
    sources = funnel.sources or {}
    site_cfg = sources.get("site") if isinstance(sources, dict) else None
    # Require explicit enablement in funnel settings
    if not (isinstance(site_cfg, dict) and site_cfg.get("enabled") is True):
        raise HTTPException(status_code=403, detail="site_integration_disabled")

    name = str(lead.name or lead.contactName or "").strip()
    phone = str(lead.phone or "").strip()
    email = str(lead.email or "").strip()
    phone_norm = _normalize_phone_for_dedup(phone)
    email_norm = _normalize_email_for_dedup(email)
    message = str(lead.message or lead.notes or "").strip()
    title = str(lead.title or "Заявка с сайта").strip() or "Заявка с сайта"

    dup = await _find_duplicate_site_lead(
        db,
        funnel_id=key_row.funnel_id,
        phone_norm=phone_norm,
        email_norm=email_norm,
    )
    if dup:
        dup_resp = SiteLeadIntakeResponse(
            duplicate=True,
            dealId=dup.id,
            funnelId=key_row.funnel_id,
            stage=str(dup.stage or ""),
        )
        return JSONResponse(status_code=200, content=dup_resp.model_dump(mode="json"))

    lines: List[str] = []
    if message:
        lines.append(message)
    if phone:
        lines.append(f"Телефон: {phone}")
    if email:
        lines.append(f"Email: {email}")
    utm = lead.utm
    if utm is not None:
        utm_d = utm.model_dump(exclude_none=True)
        if utm_d:
            for k in ["source", "medium", "campaign", "term", "content"]:
                v = utm_d.get(k)
                if v:
                    lines.append(f"utm_{k}: {v}")

    metadata = lead.metadata
    if metadata:
        # Store as JSON-ish string. We intentionally keep it in notes to avoid schema explosion.
        lines.append(f"metadata: {metadata}")

    deal_id = str(uuid.uuid4())
    assignee_id = _pick_default_assignee_id(funnel)
    stage_id = _pick_default_stage_id(funnel)
    site_cf: Dict[str, str] = {}
    if phone_norm:
        site_cf["phone"] = phone_norm
    if email_norm:
        site_cf["email"] = email_norm
    custom_fields: Dict[str, Any] = {"_site": site_cf} if site_cf else {}

    deal = Deal(
        id=deal_id,
        title=title[:500],
        funnel_id=key_row.funnel_id,
        stage=stage_id,
        source="site",
        contact_name=name[:255] if name else None,
        assignee_id=assignee_id,
        amount=Decimal("0"),
        currency="UZS",
        tags=[],
        custom_fields=custom_fields,
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
                "leadSource": "site",
                "funnelId": funnel.id,
                "funnelName": funnel.name,
                "stageLabel": _stage_label(funnel, stage_id),
                "contactName": name or None,
                "phone": phone or None,
                "email": email or None,
                "message": message or None,
            },
        )
    await db.commit()
    saved = await db.get(Deal, deal_id)
    st = saved.stage if saved else deal.stage
    created = SiteLeadIntakeResponse(
        duplicate=False,
        dealId=deal_id,
        funnelId=key_row.funnel_id,
        stage=str(st or ""),
    )
    return JSONResponse(status_code=201, content=created.model_dump(mode="json"))

