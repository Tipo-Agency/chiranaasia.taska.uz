"""Sales funnels router."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.funnel import SalesFunnel
from app.services.domain_events import log_entity_mutation

router = APIRouter(prefix="/funnels", tags=["funnels"])


def _merge_telegram_sources(old: dict | None, new: dict | None) -> dict:
    if not isinstance(new, dict):
        return old if isinstance(old, dict) else {}
    if not isinstance(old, dict):
        old = {}
    merged = {**old, **new}
    if "webhookSecret" not in new and old.get("webhookSecret"):
        merged["webhookSecret"] = old["webhookSecret"]
    return merged


def _merge_sources(existing: dict | None, incoming: dict | None) -> dict:
    if not isinstance(incoming, dict):
        return existing if isinstance(existing, dict) else {}
    if not isinstance(existing, dict):
        existing = {}
    merged = {**existing, **incoming}
    if isinstance(existing.get("telegram"), dict) and isinstance(incoming.get("telegram"), dict):
        merged["telegram"] = _merge_telegram_sources(existing.get("telegram"), incoming.get("telegram"))
    return merged


def _sanitize_sources(sources) -> dict:
    if not isinstance(sources, dict):
        return {}
    out: dict = {}
    for k, v in sources.items():
        if k == "telegram" and isinstance(v, dict):
            tv = {**v}
            if "webhookSecret" in tv:
                del tv["webhookSecret"]
                tv["webhookSecretSet"] = True
            out[k] = tv
        else:
            out[k] = v
    return out


def row_to_funnel(row):
    nt = getattr(row, "notification_templates", None) or {}
    return {
        "id": row.id,
        "name": row.name,
        "color": row.color,
        "ownerUserId": getattr(row, "owner_user_id", None),
        "stages": row.stages or [],
        "sources": _sanitize_sources(row.sources or {}),
        "notificationTemplates": nt if isinstance(nt, dict) else {},
        "createdAt": row.created_at,
        "updatedAt": row.updated_at,
        "isArchived": str(row.is_archived).lower() == "true" if row.is_archived else False,
    }


@router.get("")
async def get_funnels(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SalesFunnel))
    return [row_to_funnel(f) for f in result.scalars().all()]


@router.put("")
async def update_funnels(funnels: list[dict], db: AsyncSession = Depends(get_db)):
    for f in funnels:
        fid = f.get("id")
        if not fid:
            continue
        existing = await db.get(SalesFunnel, fid)
        is_new = existing is None
        if existing:
            existing.name = f.get("name", existing.name)
            existing.color = f.get("color", existing.color)
            existing.owner_user_id = f.get("ownerUserId", getattr(existing, "owner_user_id", None))
            existing.stages = f.get("stages", existing.stages or [])
            existing.sources = _merge_sources(existing.sources or {}, f.get("sources", existing.sources or {}))
            if f.get("notificationTemplates") is not None:
                existing.notification_templates = f.get("notificationTemplates") or {}
            existing.created_at = f.get("createdAt")
            existing.updated_at = f.get("updatedAt")
            existing.is_archived = "true" if f.get("isArchived") else "false"
        else:
            db.add(SalesFunnel(
                id=fid,
                name=f.get("name", ""),
                color=f.get("color"),
                owner_user_id=f.get("ownerUserId"),
                stages=f.get("stages", []),
                sources=f.get("sources", {}),
                notification_templates=f.get("notificationTemplates") or {},
                created_at=f.get("createdAt"),
                updated_at=f.get("updatedAt"),
                is_archived="true" if f.get("isArchived") else "false",
            ))
        await db.flush()
        await log_entity_mutation(
            db,
            event_type="sales_funnel.created" if is_new else "sales_funnel.updated",
            entity_type="sales_funnel",
            entity_id=fid,
            source="funnels-router",
            payload={"name": f.get("name")},
        )
    await db.commit()
    return {"ok": True}


@router.post("")
async def create_funnel(funnel: dict, db: AsyncSession = Depends(get_db)):
    from datetime import datetime
    fid = funnel.get("id") or f"funnel-{int(datetime.utcnow().timestamp() * 1000)}"
    now = datetime.utcnow().isoformat()
    db.add(SalesFunnel(
        id=fid,
        name=funnel.get("name", "Новая воронка"),
        color=funnel.get("color"),
        owner_user_id=funnel.get("ownerUserId"),
        stages=funnel.get("stages", []),
        sources=funnel.get("sources", {}),
        notification_templates=funnel.get("notificationTemplates") or {},
        created_at=now,
        updated_at=now,
        is_archived="false",
    ))
    await db.flush()
    await log_entity_mutation(
        db,
        event_type="sales_funnel.created",
        entity_type="sales_funnel",
        entity_id=fid,
        source="funnels-router",
        payload={"name": funnel.get("name", "Новая воронка")},
    )
    await db.commit()
    result = await db.get(SalesFunnel, fid)
    return row_to_funnel(result)


@router.get("/{funnel_id}")
async def get_funnel(funnel_id: str, db: AsyncSession = Depends(get_db)):
    f = await db.get(SalesFunnel, funnel_id)
    if not f:
        return None
    return row_to_funnel(f)


@router.patch("/{funnel_id}")
async def update_funnel(funnel_id: str, updates: dict, db: AsyncSession = Depends(get_db)):
    f = await db.get(SalesFunnel, funnel_id)
    if not f:
        return None
    if "name" in updates:
        f.name = updates["name"]
    if "color" in updates:
        f.color = updates["color"]
    if "ownerUserId" in updates:
        f.owner_user_id = updates["ownerUserId"]
    if "stages" in updates:
        f.stages = updates["stages"]
    if "sources" in updates:
        f.sources = _merge_sources(f.sources or {}, updates["sources"])
    if "isArchived" in updates:
        f.is_archived = "true" if updates["isArchived"] else "false"
    from datetime import datetime
    f.updated_at = datetime.utcnow().isoformat()
    await db.flush()
    await log_entity_mutation(
        db,
        event_type="sales_funnel.patched",
        entity_type="sales_funnel",
        entity_id=funnel_id,
        source="funnels-router",
        payload={"name": f.name, "updates": list(updates.keys())},
    )
    await db.commit()
    await db.refresh(f)
    return row_to_funnel(f)


@router.delete("/{funnel_id}")
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
    return {"ok": True}
