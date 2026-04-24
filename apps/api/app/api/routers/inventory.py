"""Inventory router."""
from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.db import get_db
from app.models.inventory import InventoryItem, InventoryRevision, StockMovement, Warehouse
from app.models.user import User
from app.schemas.common_responses import OkResponse
from app.schemas.inventory import (
    InventoryItemRead,
    InventoryItemSchema,
    InventoryRevisionItem,
    InventoryRevisionRead,
    StockMovementItem,
    StockMovementRead,
    WarehouseItem,
    WarehouseRead,
)
from app.services.audit_log import log_mutation
from app.services.domain_events import log_entity_mutation
from app.services.past_entity_edit_guard import (
    guard_inventory_dated_mutation,
    inventory_revision_effective_date_field,
    stock_movement_effective_date_field,
)

router = APIRouter(prefix="/inventory", tags=["inventory"], dependencies=[Depends(get_current_user)])


def _request_id(request: Request) -> str | None:
    return getattr(request.state, "request_id", None)


def _json_list(col):
    if col is None:
        return []
    return col if isinstance(col, list) else []


def row_to_warehouse(row: Warehouse) -> dict:
    return {
        "id": row.id,
        "name": row.name,
        "departmentId": row.department_id,
        "location": row.location,
        "isDefault": bool(row.is_default),
        "isArchived": bool(row.is_archived),
    }


def row_to_item(row: InventoryItem) -> dict:
    return {
        "id": row.id,
        "sku": row.sku,
        "name": row.name,
        "unit": row.unit,
        "category": row.category,
        "notes": row.notes,
        "attributes": _json_list(getattr(row, "attributes", None)),
        "attachments": _json_list(getattr(row, "attachments", None)),
        "barcode": getattr(row, "barcode", None),
        "manufacturer": getattr(row, "manufacturer", None),
        "consumptionHint": getattr(row, "consumption_hint", None),
        "isArchived": bool(row.is_archived),
    }


def row_to_movement(row: StockMovement) -> dict:
    return {
        "id": row.id,
        "type": row.type,
        "date": row.date,
        "fromWarehouseId": row.from_warehouse_id,
        "toWarehouseId": row.to_warehouse_id,
        "items": row.items or [],
        "reason": row.reason,
        "createdByUserId": row.created_by_user_id,
    }


def row_to_revision(row: InventoryRevision) -> dict:
    return {
        "id": row.id,
        "number": row.number,
        "warehouseId": row.warehouse_id,
        "date": row.date,
        "status": row.status,
        "lines": row.lines or [],
        "reason": row.reason,
        "createdByUserId": row.created_by_user_id,
        "postedAt": row.posted_at,
    }


@router.get("/warehouses", response_model=list[WarehouseRead])
async def get_warehouses(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Warehouse))
    return [row_to_warehouse(w) for w in result.scalars().all()]


@router.put("/warehouses", response_model=OkResponse)
async def update_warehouses(
    request: Request,
    warehouses: list[WarehouseItem],
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    for w in warehouses:
        wid = w.id
        if not wid:
            continue
        existing = await db.get(Warehouse, wid)
        is_new = existing is None
        if existing:
            existing.name = w.name or existing.name
            existing.department_id = w.departmentId
            existing.location = w.location
            existing.is_default = bool(w.isDefault)
            existing.is_archived = bool(w.isArchived)
        else:
            db.add(Warehouse(
                id=wid,
                name=w.name or "",
                department_id=w.departmentId,
                location=w.location,
                is_default=bool(w.isDefault),
                is_archived=bool(w.isArchived),
            ))
        await db.flush()
        await log_entity_mutation(
            db,
            event_type="inventory.warehouse.created" if is_new else "inventory.warehouse.updated",
            entity_type="warehouse",
            entity_id=wid,
            source="inventory-router",
            actor_id=actor.id,
            payload={"name": w.name},
        )
        await log_mutation(
            db,
            "create" if is_new else "update",
            "warehouse",
            wid,
            actor_id=actor.id,
            source="inventory-router",
            request_id=_request_id(request),
            payload={"name": w.name},
        )
    await db.commit()
    return {"ok": True}


@router.get("/items", response_model=list[InventoryItemRead])
async def get_items(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(InventoryItem))
    return [row_to_item(i) for i in result.scalars().all()]


@router.put("/items", response_model=OkResponse)
async def update_items(
    request: Request,
    items: list[InventoryItemSchema],
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    for i in items:
        iid = i.id
        if not iid:
            continue
        existing = await db.get(InventoryItem, iid)
        is_new = existing is None
        attr_payload = [a.model_dump(mode="python") for a in i.attributes]
        att_payload = [a.model_dump(mode="python") for a in i.attachments]
        if existing:
            existing.sku = i.sku or existing.sku
            existing.name = i.name or existing.name
            existing.unit = i.unit or existing.unit
            existing.category = i.category
            existing.notes = i.notes
            existing.attributes = attr_payload
            existing.attachments = att_payload
            existing.barcode = i.barcode
            existing.manufacturer = i.manufacturer
            existing.consumption_hint = i.consumptionHint
            existing.is_archived = bool(i.isArchived)
        else:
            db.add(InventoryItem(
                id=iid,
                sku=i.sku or "",
                name=i.name or "",
                unit=i.unit or "",
                category=i.category,
                notes=i.notes,
                attributes=attr_payload,
                attachments=att_payload,
                barcode=i.barcode,
                manufacturer=i.manufacturer,
                consumption_hint=i.consumptionHint,
                is_archived=bool(i.isArchived),
            ))
        await db.flush()
        await log_entity_mutation(
            db,
            event_type="inventory.item.created" if is_new else "inventory.item.updated",
            entity_type="inventory_item",
            entity_id=iid,
            source="inventory-router",
            actor_id=actor.id,
            payload={"sku": i.sku, "name": i.name},
        )
        await log_mutation(
            db,
            "create" if is_new else "update",
            "inventory_item",
            iid,
            actor_id=actor.id,
            source="inventory-router",
            request_id=_request_id(request),
            payload={"sku": i.sku, "name": i.name},
        )
    await db.commit()
    return {"ok": True}


@router.get("/movements", response_model=list[StockMovementRead])
async def get_movements(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(StockMovement))
    return [row_to_movement(m) for m in result.scalars().all()]


@router.put("/movements", response_model=OkResponse)
async def update_movements(
    request: Request,
    movements: list[StockMovementItem],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    for m in movements:
        mid = m.id
        if not mid:
            continue
        payload_items = [ln.model_dump(mode="python") for ln in m.items]
        existing = await db.get(StockMovement, mid)
        is_new = existing is None
        eff_date = stock_movement_effective_date_field(m, existing)
        await guard_inventory_dated_mutation(
            db,
            current_user,
            existing_date=existing.date if existing else None,
            effective_date=eff_date,
        )
        if existing:
            existing.type = m.type or existing.type
            existing.date = m.date or existing.date
            existing.from_warehouse_id = m.fromWarehouseId
            existing.to_warehouse_id = m.toWarehouseId
            existing.items = payload_items
            existing.reason = m.reason
            existing.created_by_user_id = m.createdByUserId or existing.created_by_user_id
        else:
            db.add(StockMovement(
                id=mid,
                type=m.type or "",
                date=m.date or "",
                from_warehouse_id=m.fromWarehouseId,
                to_warehouse_id=m.toWarehouseId,
                items=payload_items,
                reason=m.reason,
                created_by_user_id=m.createdByUserId or "",
            ))
        await db.flush()
        await log_entity_mutation(
            db,
            event_type="inventory.movement.created" if is_new else "inventory.movement.updated",
            entity_type="stock_movement",
            entity_id=mid,
            source="inventory-router",
            actor_id=current_user.id,
            payload={"type": m.type, "date": m.date},
        )
        await log_mutation(
            db,
            "create" if is_new else "update",
            "stock_movement",
            mid,
            actor_id=current_user.id,
            source="inventory-router",
            request_id=_request_id(request),
            payload={"type": m.type, "date": m.date},
        )
    await db.commit()
    return {"ok": True}


@router.get("/revisions", response_model=list[InventoryRevisionRead])
async def get_revisions(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(InventoryRevision))
    return [row_to_revision(r) for r in result.scalars().all()]


@router.put("/revisions", response_model=OkResponse)
async def update_revisions(
    request: Request,
    revisions: list[InventoryRevisionItem],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    for r in revisions:
        rid = r.id
        if not rid:
            continue
        payload_lines = [ln.model_dump(mode="python") for ln in r.lines]
        existing = await db.get(InventoryRevision, rid)
        is_new = existing is None
        eff_date = inventory_revision_effective_date_field(r, existing)
        await guard_inventory_dated_mutation(
            db,
            current_user,
            existing_date=existing.date if existing else None,
            effective_date=eff_date,
        )
        if existing:
            existing.number = r.number or existing.number
            existing.warehouse_id = r.warehouseId or existing.warehouse_id
            existing.date = r.date or existing.date
            existing.status = r.status or existing.status
            existing.lines = payload_lines
            existing.reason = r.reason
            existing.created_by_user_id = r.createdByUserId or existing.created_by_user_id
            existing.posted_at = r.postedAt
        else:
            db.add(InventoryRevision(
                id=rid,
                number=r.number or "",
                warehouse_id=r.warehouseId or "",
                date=r.date or "",
                status=r.status or "",
                lines=payload_lines,
                reason=r.reason,
                created_by_user_id=r.createdByUserId or "",
                posted_at=r.postedAt,
            ))
        await db.flush()
        await log_entity_mutation(
            db,
            event_type="inventory.revision.created" if is_new else "inventory.revision.updated",
            entity_type="inventory_revision",
            entity_id=rid,
            source="inventory-router",
            actor_id=current_user.id,
            payload={"number": r.number, "status": r.status},
        )
        await log_mutation(
            db,
            "create" if is_new else "update",
            "inventory_revision",
            rid,
            actor_id=current_user.id,
            source="inventory-router",
            request_id=_request_id(request),
            payload={"number": r.number, "status": r.status},
        )
    await db.commit()
    return {"ok": True}
