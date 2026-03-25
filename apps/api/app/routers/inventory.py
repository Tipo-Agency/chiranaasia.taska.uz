"""Inventory router."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.inventory import Warehouse, InventoryItem, StockMovement, InventoryRevision
from app.services.domain_events import log_entity_mutation

router = APIRouter(prefix="/inventory", tags=["inventory"])


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


@router.get("/warehouses")
async def get_warehouses(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Warehouse))
    return [row_to_warehouse(w) for w in result.scalars().all()]


@router.put("/warehouses")
async def update_warehouses(warehouses: list[dict], db: AsyncSession = Depends(get_db)):
    for w in warehouses:
        wid = w.get("id")
        if not wid:
            continue
        existing = await db.get(Warehouse, wid)
        is_new = existing is None
        if existing:
            existing.name = w.get("name", existing.name)
            existing.department_id = w.get("departmentId")
            existing.location = w.get("location")
            existing.is_default = "true" if w.get("isDefault") else "false"
            existing.is_archived = "true" if w.get("isArchived") else "false"
        else:
            db.add(Warehouse(
                id=wid,
                name=w.get("name", ""),
                department_id=w.get("departmentId"),
                location=w.get("location"),
                is_default="true" if w.get("isDefault") else "false",
                is_archived="true" if w.get("isArchived") else "false",
            ))
        await db.flush()
        await log_entity_mutation(
            db,
            event_type="inventory.warehouse.created" if is_new else "inventory.warehouse.updated",
            entity_type="warehouse",
            entity_id=wid,
            source="inventory-router",
            payload={"name": w.get("name")},
            actor_id=w.get("updatedByUserId"),
        )
    await db.commit()
    return {"ok": True}


@router.get("/items")
async def get_items(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(InventoryItem))
    return [row_to_item(i) for i in result.scalars().all()]


@router.put("/items")
async def update_items(items: list[dict], db: AsyncSession = Depends(get_db)):
    for i in items:
        iid = i.get("id")
        if not iid:
            continue
        existing = await db.get(InventoryItem, iid)
        is_new = existing is None
        if existing:
            existing.sku = i.get("sku", existing.sku)
            existing.name = i.get("name", existing.name)
            existing.unit = i.get("unit", existing.unit)
            existing.category = i.get("category")
            existing.notes = i.get("notes")
            existing.is_archived = "true" if i.get("isArchived") else "false"
        else:
            db.add(InventoryItem(
                id=iid,
                sku=i.get("sku", ""),
                name=i.get("name", ""),
                unit=i.get("unit", ""),
                category=i.get("category"),
                notes=i.get("notes"),
                is_archived="true" if i.get("isArchived") else "false",
            ))
        await db.flush()
        await log_entity_mutation(
            db,
            event_type="inventory.item.created" if is_new else "inventory.item.updated",
            entity_type="inventory_item",
            entity_id=iid,
            source="inventory-router",
            payload={"sku": i.get("sku"), "name": i.get("name")},
            actor_id=i.get("updatedByUserId"),
        )
    await db.commit()
    return {"ok": True}


@router.get("/movements")
async def get_movements(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(StockMovement))
    return [row_to_movement(m) for m in result.scalars().all()]


@router.put("/movements")
async def update_movements(movements: list[dict], db: AsyncSession = Depends(get_db)):
    for m in movements:
        mid = m.get("id")
        if not mid:
            continue
        existing = await db.get(StockMovement, mid)
        is_new = existing is None
        if existing:
            existing.type = m.get("type", existing.type)
            existing.date = m.get("date", existing.date)
            existing.from_warehouse_id = m.get("fromWarehouseId")
            existing.to_warehouse_id = m.get("toWarehouseId")
            existing.items = m.get("items", existing.items or [])
            existing.reason = m.get("reason")
            existing.created_by_user_id = m.get("createdByUserId", existing.created_by_user_id)
        else:
            db.add(StockMovement(
                id=mid,
                type=m.get("type", ""),
                date=m.get("date", ""),
                from_warehouse_id=m.get("fromWarehouseId"),
                to_warehouse_id=m.get("toWarehouseId"),
                items=m.get("items", []),
                reason=m.get("reason"),
                created_by_user_id=m.get("createdByUserId", ""),
            ))
        await db.flush()
        await log_entity_mutation(
            db,
            event_type="inventory.movement.created" if is_new else "inventory.movement.updated",
            entity_type="stock_movement",
            entity_id=mid,
            source="inventory-router",
            payload={"type": m.get("type"), "date": m.get("date")},
            actor_id=m.get("createdByUserId"),
        )
    await db.commit()
    return {"ok": True}


@router.get("/revisions")
async def get_revisions(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(InventoryRevision))
    return [row_to_revision(r) for r in result.scalars().all()]


@router.put("/revisions")
async def update_revisions(revisions: list[dict], db: AsyncSession = Depends(get_db)):
    for r in revisions:
        rid = r.get("id")
        if not rid:
            continue
        existing = await db.get(InventoryRevision, rid)
        is_new = existing is None
        if existing:
            existing.number = r.get("number", existing.number)
            existing.warehouse_id = r.get("warehouseId", existing.warehouse_id)
            existing.date = r.get("date", existing.date)
            existing.status = r.get("status", existing.status)
            existing.lines = r.get("lines", existing.lines or [])
            existing.reason = r.get("reason")
            existing.created_by_user_id = r.get("createdByUserId", existing.created_by_user_id)
            existing.posted_at = r.get("postedAt")
        else:
            db.add(InventoryRevision(
                id=rid,
                number=r.get("number", ""),
                warehouse_id=r.get("warehouseId", ""),
                date=r.get("date", ""),
                status=r.get("status", ""),
                lines=r.get("lines", []),
                reason=r.get("reason"),
                created_by_user_id=r.get("createdByUserId", ""),
                posted_at=r.get("postedAt"),
            ))
        await db.flush()
        await log_entity_mutation(
            db,
            event_type="inventory.revision.created" if is_new else "inventory.revision.updated",
            entity_type="inventory_revision",
            entity_id=rid,
            source="inventory-router",
            payload={"number": r.get("number"), "status": r.get("status")},
            actor_id=r.get("createdByUserId"),
        )
    await db.commit()
    return {"ok": True}
