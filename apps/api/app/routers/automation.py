"""Automation rules router."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.notification import AutomationRule as ARModel
from app.services.domain_events import log_entity_mutation

router = APIRouter(prefix="/automation", tags=["automation"])


@router.get("/rules")
async def get_rules(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ARModel))
    rows = result.scalars().all()
    return [dict(r.rule, id=r.id) for r in rows]


@router.put("/rules")
async def update_rules(rules: list[dict], db: AsyncSession = Depends(get_db)):
    for r in rules:
        rid = r.get("id")
        if not rid:
            continue
        rule_data = {k: v for k, v in r.items() if k != "id"}
        existing = await db.get(ARModel, rid)
        is_new = existing is None
        if existing:
            existing.rule = rule_data
        else:
            db.add(ARModel(id=rid, rule=rule_data))
        await db.flush()
        rule_name = rule_data.get("name") if isinstance(rule_data, dict) else None
        await log_entity_mutation(
            db,
            event_type="automation.rule.created" if is_new else "automation.rule.updated",
            entity_type="automation_rule",
            entity_id=rid,
            source="automation-router",
            payload={"name": rule_name},
        )
    await db.commit()
    return {"ok": True}
