"""Производственные маршруты: настройка этапов, заказы, передачи с приёмкой."""
from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from typing import Annotated

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Query, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user, require_any_permission
from app.core.json_http_cache import json_304_or_response
from app.core.optimistic_version import (
    commit_or_stale_version_conflict,
    enforce_expected_version_row,
    merge_expected_version,
    parse_if_match_header,
)
from app.core.permissions import FULL_ACCESS
from app.db import get_db
from app.models.production import ProductionHandoff, ProductionOrder, ProductionPipeline
from app.models.user import User
from app.schemas.common_responses import OkResponse
from app.schemas.production import (
    HandOverBody,
    HandoffResolveBody,
    ProductionHandoffRead,
    ProductionOrderCreate,
    ProductionOrderPatch,
    ProductionOrderRead,
    ProductionPipelineBulkItem,
    ProductionPipelineRead,
)
from app.services.domain_events import log_entity_mutation
from app.services.production_route_payload import pipeline_display_name, validate_and_normalize_production_stages

router = APIRouter(prefix="/production", tags=["production"], dependencies=[Depends(get_current_user)])

require_production_access = require_any_permission(
    "org.production",
    FULL_ACCESS,
    detail="production_access_required",
)


def _now_iso() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def _sorted_stages(raw: Any) -> list[dict[str, Any]]:
    if not isinstance(raw, list):
        return []
    items = [x for x in raw if isinstance(x, dict) and str(x.get("id", "")).strip()]
    items.sort(key=lambda x: int(x.get("position", 0) or 0))
    return items


def _first_stage_id(pipeline: ProductionPipeline) -> str:
    st = _sorted_stages(pipeline.stages)
    if not st:
        raise HTTPException(status_code=400, detail="production_pipeline_has_no_stages")
    return str(st[0]["id"])


def _stage_index(stages: list[dict[str, Any]], stage_id: str) -> int:
    for i, s in enumerate(stages):
        if str(s.get("id")) == stage_id:
            return i
    return -1


def _row_to_pipeline(row: ProductionPipeline) -> ProductionPipelineRead:
    name = row.name or ""
    archived = str(row.is_archived or "").lower() == "true"
    return ProductionPipelineRead(
        id=row.id,
        name=name,
        title=name,
        color=row.color,
        stages=_sorted_stages(row.stages),
        createdAt=row.created_at,
        updatedAt=row.updated_at,
        isArchived=archived,
    )


def _row_to_handoff(h: ProductionHandoff) -> ProductionHandoffRead:
    return ProductionHandoffRead(
        id=h.id,
        orderId=h.order_id,
        fromStageId=h.from_stage_id,
        toStageId=h.to_stage_id,
        status=h.status,
        handedOverByUserId=h.handed_over_by_user_id,
        handedOverAt=h.handed_over_at,
        acceptedByUserId=h.accepted_by_user_id,
        acceptedAt=h.accepted_at,
        hasDefects=bool(h.has_defects),
        defectNotes=h.defect_notes,
        notes=h.notes,
    )


async def _pending_handoff(db: AsyncSession, order_id: str) -> ProductionHandoff | None:
    res = await db.execute(
        select(ProductionHandoff).where(
            ProductionHandoff.order_id == order_id,
            ProductionHandoff.status == "pending_accept",
        )
    )
    return res.scalar_one_or_none()


def _row_to_order(row: ProductionOrder, pending: ProductionHandoff | None) -> ProductionOrderRead:
    return ProductionOrderRead(
        id=row.id,
        version=int(row.version or 1),
        pipelineId=row.pipeline_id,
        currentStageId=row.current_stage_id,
        title=row.title or "",
        notes=row.notes,
        status=row.status or "open",
        createdAt=row.created_at,
        updatedAt=row.updated_at,
        isArchived=bool(row.is_archived),
        pendingHandoff=_row_to_handoff(pending) if pending else None,
    )


@router.get("/pipelines", response_model=list[ProductionPipelineRead], dependencies=[Depends(require_production_access)])
async def list_pipelines(request: Request, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(ProductionPipeline).order_by(ProductionPipeline.id))
    data = [_row_to_pipeline(r) for r in res.scalars().all()]
    return json_304_or_response(request, data=data, max_age=120)


@router.put("/pipelines", response_model=OkResponse, dependencies=[Depends(require_production_access)])
async def put_pipelines(items: list[ProductionPipelineBulkItem], db: AsyncSession = Depends(get_db)):
    for it in items:
        pid = it.id.strip()
        if not pid:
            continue
        fs = it.model_fields_set
        existing = await db.get(ProductionPipeline, pid)
        is_new = existing is None
        dump = it.model_dump(exclude_unset=True)
        display_name = pipeline_display_name(dump)
        now = _now_iso()
        if existing:
            existing.name = display_name
            if "color" in fs:
                existing.color = it.color
            if "stages" in fs and it.stages is not None:
                existing.stages = validate_and_normalize_production_stages([s.model_dump(mode="python") for s in it.stages])
            if "createdAt" in fs:
                existing.created_at = it.createdAt
            if "updatedAt" in fs:
                existing.updated_at = it.updatedAt
            else:
                existing.updated_at = now
            if "isArchived" in fs:
                existing.is_archived = "true" if it.isArchived else "false"
        else:
            stages_raw = it.stages if it.stages is not None else []
            db.add(
                ProductionPipeline(
                    id=pid,
                    name=display_name,
                    color=it.color,
                    stages=validate_and_normalize_production_stages([s.model_dump(mode="python") for s in stages_raw]),
                    created_at=it.createdAt or now,
                    updated_at=it.updatedAt or now,
                    is_archived="true" if it.isArchived else "false",
                )
            )
        await db.flush()
        await log_entity_mutation(
            db,
            event_type="production_pipeline.created" if is_new else "production_pipeline.updated",
            entity_type="production_pipeline",
            entity_id=pid,
            source="production-router",
            payload={"name": display_name},
        )
    await db.commit()
    return OkResponse()


@router.get("/orders", response_model=list[ProductionOrderRead], dependencies=[Depends(require_production_access)])
async def list_orders(
    request: Request,
    db: AsyncSession = Depends(get_db),
    pipeline_id: str | None = Query(default=None, alias="pipelineId"),
):
    stmt = select(ProductionOrder).where(ProductionOrder.is_archived.is_(False))
    if pipeline_id and pipeline_id.strip():
        stmt = stmt.where(ProductionOrder.pipeline_id == pipeline_id.strip()[:36])
    stmt = stmt.order_by(ProductionOrder.created_at.desc())
    res = await db.execute(stmt)
    rows = list(res.scalars().all())
    out: list[ProductionOrderRead] = []
    for row in rows:
        pend = await _pending_handoff(db, row.id)
        out.append(_row_to_order(row, pend))
    return json_304_or_response(request, data=out, max_age=15)


@router.post("/orders", response_model=ProductionOrderRead, dependencies=[Depends(require_production_access)])
async def create_order(body: ProductionOrderCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    pl = await db.get(ProductionPipeline, body.pipelineId.strip()[:36])
    if not pl or str(pl.is_archived or "").lower() == "true":
        raise HTTPException(status_code=404, detail="production_pipeline_not_found")
    sid = _first_stage_id(pl)
    now = _now_iso()
    oid = str(uuid.uuid4())
    row = ProductionOrder(
        id=oid,
        version=1,
        pipeline_id=pl.id,
        current_stage_id=sid,
        title=body.title.strip()[:500],
        notes=body.notes,
        status="open",
        created_at=now,
        updated_at=now,
        is_archived=False,
    )
    db.add(row)
    await db.flush()
    await log_entity_mutation(
        db,
        event_type="production_order.created",
        entity_type="production_order",
        entity_id=oid,
        source="production-router",
        actor_id=user.id,
        payload={"title": row.title, "pipelineId": pl.id, "stageId": sid},
    )
    await db.commit()
    await db.refresh(row)
    return _row_to_order(row, None)


@router.patch("/orders/{order_id}", response_model=ProductionOrderRead, dependencies=[Depends(require_production_access)])
async def patch_order(
    order_id: str,
    body: ProductionOrderPatch,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    if_match: Annotated[str | None, Header(alias="If-Match")] = None,
):
    row = await db.get(ProductionOrder, order_id)
    if not row or row.is_archived:
        raise HTTPException(status_code=404, detail="production_order_not_found")
    exp = merge_expected_version(
        if_match=parse_if_match_header(if_match),
        body_version=body.version if "version" in body.model_fields_set else None,
    )
    enforce_expected_version_row(row_version=int(row.version), expected=exp)
    fs = body.model_fields_set
    if "title" in fs and body.title is not None:
        row.title = body.title.strip()[:500]
    if "notes" in fs:
        row.notes = body.notes
    if "status" in fs and body.status is not None:
        row.status = str(body.status).strip()[:30] or row.status
    if "isArchived" in fs and body.isArchived is not None:
        row.is_archived = bool(body.isArchived)
    row.updated_at = _now_iso()
    await db.flush()
    await log_entity_mutation(
        db,
        event_type="production_order.updated",
        entity_type="production_order",
        entity_id=order_id,
        source="production-router",
        actor_id=user.id,
        payload={"fields": sorted(fs)},
    )
    await commit_or_stale_version_conflict(db)
    pend = await _pending_handoff(db, order_id)
    return _row_to_order(row, pend)


@router.post("/orders/{order_id}/hand-over", response_model=ProductionOrderRead, dependencies=[Depends(require_production_access)])
async def hand_over_order(
    order_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    body: HandOverBody = Body(default_factory=HandOverBody),
):
    row = await db.get(ProductionOrder, order_id)
    if not row or row.is_archived:
        raise HTTPException(status_code=404, detail="production_order_not_found")
    if (row.status or "") != "open":
        raise HTTPException(status_code=400, detail="production_order_not_open")
    if await _pending_handoff(db, order_id):
        raise HTTPException(status_code=409, detail="production_handoff_already_pending")
    pl = await db.get(ProductionPipeline, row.pipeline_id)
    if not pl:
        raise HTTPException(status_code=404, detail="production_pipeline_not_found")
    stages = _sorted_stages(pl.stages)
    idx = _stage_index(stages, row.current_stage_id)
    if idx < 0:
        raise HTTPException(status_code=400, detail="production_invalid_current_stage")
    if idx >= len(stages) - 1:
        raise HTTPException(status_code=400, detail="production_use_complete_on_last_stage")
    to_stage = stages[idx + 1]
    to_id = str(to_stage["id"])
    from_id = str(stages[idx]["id"])
    hid = str(uuid.uuid4())
    now = _now_iso()
    h = ProductionHandoff(
        id=hid,
        order_id=row.id,
        from_stage_id=from_id,
        to_stage_id=to_id,
        status="pending_accept",
        handed_over_by_user_id=user.id,
        handed_over_at=now,
        notes=body.notes,
        has_defects=False,
    )
    db.add(h)
    await db.flush()
    await log_entity_mutation(
        db,
        event_type="production_handoff.submitted",
        entity_type="production_handoff",
        entity_id=hid,
        source="production-router",
        actor_id=user.id,
        payload={"orderId": order_id, "fromStageId": from_id, "toStageId": to_id},
    )
    await db.commit()
    await db.refresh(row)
    pend = await _pending_handoff(db, order_id)
    return _row_to_order(row, pend)


@router.post("/orders/{order_id}/complete", response_model=ProductionOrderRead, dependencies=[Depends(require_production_access)])
async def complete_order(order_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    row = await db.get(ProductionOrder, order_id)
    if not row or row.is_archived:
        raise HTTPException(status_code=404, detail="production_order_not_found")
    if await _pending_handoff(db, order_id):
        raise HTTPException(status_code=409, detail="production_complete_blocked_pending_handoff")
    pl = await db.get(ProductionPipeline, row.pipeline_id)
    if not pl:
        raise HTTPException(status_code=404, detail="production_pipeline_not_found")
    stages = _sorted_stages(pl.stages)
    idx = _stage_index(stages, row.current_stage_id)
    if idx != len(stages) - 1:
        raise HTTPException(status_code=400, detail="production_complete_only_on_last_stage")
    row.status = "done"
    row.updated_at = _now_iso()
    await db.flush()
    await log_entity_mutation(
        db,
        event_type="production_order.completed",
        entity_type="production_order",
        entity_id=order_id,
        source="production-router",
        actor_id=user.id,
        payload={"stageId": row.current_stage_id},
    )
    await db.commit()
    await db.refresh(row)
    return _row_to_order(row, None)


@router.post("/handoffs/{handoff_id}/resolve", response_model=ProductionOrderRead, dependencies=[Depends(require_production_access)])
async def resolve_handoff(
    handoff_id: str,
    body: HandoffResolveBody,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    h = await db.get(ProductionHandoff, handoff_id)
    if not h or h.status != "pending_accept":
        raise HTTPException(status_code=404, detail="production_handoff_not_pending")
    row = await db.get(ProductionOrder, h.order_id)
    if not row or row.is_archived:
        raise HTTPException(status_code=404, detail="production_order_not_found")
    if row.current_stage_id != h.from_stage_id:
        raise HTTPException(status_code=409, detail="production_handoff_stage_mismatch")
    now = _now_iso()
    if body.action == "reject":
        h.status = "rejected"
        h.accepted_by_user_id = user.id
        h.accepted_at = now
        await db.flush()
        await log_entity_mutation(
            db,
            event_type="production_handoff.rejected",
            entity_type="production_handoff",
            entity_id=handoff_id,
            source="production-router",
            actor_id=user.id,
            payload={"orderId": row.id},
        )
        await db.commit()
        await db.refresh(row)
        pend = await _pending_handoff(db, row.id)
        return _row_to_order(row, pend)
    h.status = "accepted"
    h.accepted_by_user_id = user.id
    h.accepted_at = now
    h.has_defects = bool(body.hasDefects)
    h.defect_notes = body.defectNotes
    row.current_stage_id = h.to_stage_id
    row.updated_at = now
    await db.flush()
    await log_entity_mutation(
        db,
        event_type="production_handoff.accepted",
        entity_type="production_handoff",
        entity_id=handoff_id,
        source="production-router",
        actor_id=user.id,
        payload={"orderId": row.id, "toStageId": h.to_stage_id, "hasDefects": h.has_defects},
    )
    await db.commit()
    await db.refresh(row)
    pend = await _pending_handoff(db, row.id)
    return _row_to_order(row, pend)