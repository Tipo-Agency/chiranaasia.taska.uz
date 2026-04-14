"""Inventory router."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.inventory import InventoryItem, InventoryRevision, StockMovement, Warehouse
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
from app.services.domain_events import log_entity_mutation
from app.core.auth import get_current_user

router = APIRouter(prefix="/inventory", tags=["inventory"], dependencies=[Depends(get_current_user)])


def _bool(val):
    return str(val).lower() in ("true", "1", "yes") if val else False


def row_to_warehouse(row):
    return {
        "id": row.id,
        "name": row.name,
        "departmentId": row.department_id,
        "location": row.location,
        "isDefault": _bool(row.is_default),
        "isArchived": _bool(row.is_archived),
    }


def row_to_item(row):
    return {
        "id": row.id,
        "sku": row.sku,
        "name": row.name,
        "unit": row.unit,
        "category": row.category,
        "notes": row.notes,
        "isArchived": _bool(row.is_archived),
    }


def row_to_movement(row):
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


def row_to_revision(row):
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
async def update_warehouses(warehouses: list[WarehouseItem], db: AsyncSession = Depends(get_db)):
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
            existing.is_default = "true" if w.isDefault else "false"
            existing.is_archived = "true" if w.isArchived else "false"
        else:
            db.add(Warehouse(
                id=wid,
                name=w.name or "",
                department_id=w.departmentId,
                location=w.location,
                is_default="true" if w.isDefault else "false",
                is_archived="true" if w.isArchived else "false",
            ))
        await db.flush()
        await log_entity_mutation(
            db,
            event_type="inventory.warehouse.created" if is_new else "inventory.warehouse.updated",
            entity_type="warehouse",
            entity_id=wid,
            source="inventory-router",
            payload={"name": w.name},
            actor_id=w.updatedByUserId,
        )
    await db.commit()
    return {"ok": True}


@router.get("/items", response_model=list[InventoryItemRead])
async def get_items(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(InventoryItem))
    return [row_to_item(i) for i in result.scalars().all()]


@router.put("/items", response_model=OkResponse)
async def update_items(items: list[InventoryItemSchema], db: AsyncSession = Depends(get_db)):
    for i in items:
        iid = i.id
        if not iid:
            continue
        existing = await db.get(InventoryItem, iid)
        is_new = existing is None
        if existing:
            existing.sku = i.sku or existing.sku
            existing.name = i.name or existing.name
            existing.unit = i.unit or existing.unit
            existing.category = i.category
            existing.notes = i.notes
            existing.is_archived = "true" if i.isArchived else "false"
        else:
            db.add(InventoryItem(
                id=iid,
                sku=i.sku or "",
                name=i.name or "",
                unit=i.unit or "",
                category=i.category,
                notes=i.notes,
                is_archived="true" if i.isArchived else "false",
            ))
        await db.flush()
        await log_entity_mutation(
            db,
            event_type="inventory.item.created" if is_new else "inventory.item.updated",
            entity_type="inventory_item",
            entity_id=iid,
            source="inventory-router",
            payload={"sku": i.sku, "name": i.name},
            actor_id=i.updatedByUserId,
        )
    await db.commit()
    return {"ok": True}


@router.get("/movements", response_model=list[StockMovementRead])
async def get_movements(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(StockMovement))
    return [row_to_movement(m) for m in result.scalars().all()]


@router.put("/movements", response_model=OkResponse)
async def update_movements(movements: list[StockMovementItem], db: AsyncSession = Depends(get_db)):
    for m in movements:
        mid = m.id
        if not mid:
            continue
        payload_items = [ln.model_dump(mode="python") for ln in m.items]
        existing = await db.get(StockMovement, mid)
        is_new = existing is None
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
            payload={"type": m.type, "date": m.date},
            actor_id=m.createdByUserId or None,
        )
    await db.commit()
    return {"ok": True}


@router.get("/revisions", response_model=list[InventoryRevisionRead])
async def get_revisions(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(InventoryRevision))
    return [row_to_revision(r) for r in result.scalars().all()]


@router.put("/revisions", response_model=OkResponse)
async def update_revisions(revisions: list[InventoryRevisionItem], db: AsyncSession = Depends(get_db)):
    for r in revisions:
        rid = r.id
        if not rid:
            continue
        payload_lines = [ln.model_dump(mode="python") for ln in r.lines]
        existing = await db.get(InventoryRevision, rid)
        is_new = existing is None
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
            payload={"number": r.number, "status": r.status},
            actor_id=r.createdByUserId or None,
        )
    await db.commit()
    return {"ok": True}
