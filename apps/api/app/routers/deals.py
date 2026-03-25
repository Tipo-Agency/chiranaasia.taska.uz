"""Deals router."""
import uuid
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.client import Deal
from app.utils import row_to_deal
from app.services.domain_events import emit_domain_event, log_entity_mutation

router = APIRouter(prefix="/deals", tags=["deals"])


@router.get("")
async def get_deals(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Deal))
    return [row_to_deal(d) for d in result.scalars().all()]


@router.put("")
async def update_deals(deals: list[dict], db: AsyncSession = Depends(get_db)):
    def str_val(v):
        return str(v) if v is not None else None
    def lim(v, size):
        if v is None:
            return None
        return str(v)[:size]
    def safe_id(raw):
        if not raw:
            return str(uuid.uuid4())
        sid = str(raw)
        if len(sid) > 36:
            return str(uuid.uuid4())
        return sid

    for d in deals:
        did = safe_id(d.get("id"))
        existing = await db.get(Deal, did)
        prev_assignee = existing.assignee_id if existing else None
        prev_stage = existing.stage if existing else None
        payload = {
            "id": did,
            "title": lim(d.get("title", ""), 500) or "",
            "client_id": lim(d.get("clientId"), 36),
            "contact_name": lim(d.get("contactName"), 255),
            "amount": str_val(d.get("amount")) or "0",
            "currency": lim(d.get("currency", "UZS"), 10) or "UZS",
            "stage": lim(d.get("stage", "new"), 100) or "new",
            "funnel_id": lim(d.get("funnelId"), 36),
            "source": lim(d.get("source"), 50),
            "telegram_chat_id": lim(d.get("telegramChatId"), 50),
            "telegram_username": lim(d.get("telegramUsername"), 100),
            "assignee_id": lim(d.get("assigneeId", ""), 36) or "",
            "created_at": d.get("createdAt", existing.created_at if existing else __import__("datetime").datetime.utcnow().isoformat()),
            "notes": d.get("notes"),
            "project_id": lim(d.get("projectId"), 36),
            "comments": d.get("comments", existing.comments if existing else []) or [],
            "is_archived": d.get("isArchived", False),
            "recurring": d.get("recurring", False),
            "number": lim(d.get("number"), 100),
            "status": lim(d.get("status"), 30),
            "description": d.get("description"),
            "date": lim(d.get("date"), 50),
            "due_date": lim(d.get("dueDate"), 50),
            "paid_amount": str_val(d.get("paidAmount")),
            "paid_date": lim(d.get("paidDate"), 50),
            "start_date": lim(d.get("startDate"), 50),
            "end_date": lim(d.get("endDate"), 50),
            "payment_day": str(d.get("paymentDay"))[:10] if d.get("paymentDay") is not None else None,
            "updated_at": d.get("updatedAt"),
        }
        stmt = insert(Deal).values(**payload)
        stmt = stmt.on_conflict_do_update(
            index_elements=[Deal.id],
            set_={
                "title": payload["title"],
                "client_id": payload["client_id"],
                "contact_name": payload["contact_name"],
                "amount": payload["amount"],
                "currency": payload["currency"],
                "stage": payload["stage"],
                "funnel_id": payload["funnel_id"],
                "source": payload["source"],
                "telegram_chat_id": payload["telegram_chat_id"],
                "telegram_username": payload["telegram_username"],
                "assignee_id": payload["assignee_id"],
                "notes": payload["notes"],
                "project_id": payload["project_id"],
                "comments": payload["comments"],
                "is_archived": payload["is_archived"],
                "recurring": payload["recurring"],
                "number": payload["number"],
                "status": payload["status"],
                "description": payload["description"],
                "date": payload["date"],
                "due_date": payload["due_date"],
                "paid_amount": payload["paid_amount"],
                "paid_date": payload["paid_date"],
                "start_date": payload["start_date"],
                "end_date": payload["end_date"],
                "payment_day": payload["payment_day"],
                "updated_at": payload["updated_at"],
            },
        )
        await db.execute(stmt)
        await db.flush()
        deal_row = await db.get(Deal, did)
        if existing is not None and deal_row and prev_stage is not None and deal_row.stage != prev_stage:
            await log_entity_mutation(
                db,
                event_type="deal.stage.changed",
                entity_type="deal",
                entity_id=did,
                source="deals-router",
                actor_id=d.get("createdByUserId"),
                payload={
                    "dealId": did,
                    "title": deal_row.title or payload["title"],
                    "fromStage": prev_stage,
                    "toStage": deal_row.stage,
                    "assigneeId": deal_row.assignee_id or payload["assignee_id"] or None,
                },
            )
        if deal_row:
            await log_entity_mutation(
                db,
                event_type="deal.updated" if existing is not None else "deal.created",
                entity_type="deal",
                entity_id=did,
                source="deals-router",
                actor_id=d.get("createdByUserId"),
                payload={"title": deal_row.title or payload["title"], "stage": deal_row.stage},
            )

        assignee = payload["assignee_id"] or (existing.assignee_id if existing else None)
        actor_id = d.get("createdByUserId")
        if existing is None and assignee:
            await emit_domain_event(
                db,
                event_type="deal.assigned",
                org_id="default",
                entity_type="deal",
                entity_id=did,
                source="deals-router",
                actor_id=actor_id,
                payload={
                    "dealId": did,
                    "title": payload["title"],
                    "assigneeId": assignee,
                },
            )
        elif existing and assignee and assignee != prev_assignee:
            await emit_domain_event(
                db,
                event_type="deal.assigned",
                org_id="default",
                entity_type="deal",
                entity_id=did,
                source="deals-router",
                actor_id=actor_id,
                payload={
                    "dealId": did,
                    "title": payload["title"] or existing.title,
                    "assigneeId": assignee,
                },
            )
    await db.commit()
    return {"ok": True}


@router.post("")
async def create_deal(deal: dict, db: AsyncSession = Depends(get_db)):
    import uuid
    from datetime import datetime
    did = deal.get("id") or str(uuid.uuid4())
    def str_val(v):
        return str(v) if v is not None else None
    db.add(Deal(
        id=did,
        title=deal.get("title", "Новая сделка"),
        client_id=deal.get("clientId"),
        contact_name=deal.get("contactName"),
        amount=str_val(deal.get("amount")) or "0",
        currency=deal.get("currency", "UZS"),
        stage=deal.get("stage", "new"),
        funnel_id=deal.get("funnelId"),
        source=deal.get("source"),
        telegram_chat_id=deal.get("telegramChatId"),
        telegram_username=deal.get("telegramUsername"),
        assignee_id=deal.get("assigneeId", ""),
        created_at=deal.get("createdAt", datetime.utcnow().isoformat()),
        notes=deal.get("notes"),
        project_id=deal.get("projectId"),
        comments=deal.get("comments", []),
        is_archived=False,
    ))
    await db.flush()
    assignee = deal.get("assigneeId")
    if assignee:
        await emit_domain_event(
            db,
            event_type="deal.assigned",
            org_id="default",
            entity_type="deal",
            entity_id=did,
            source="deals-router",
            actor_id=deal.get("createdByUserId"),
            payload={
                "dealId": did,
                "title": deal.get("title", "Новая сделка"),
                "assigneeId": assignee,
            },
        )
    await db.commit()
    result = await db.get(Deal, did)
    return row_to_deal(result)


@router.get("/{deal_id}")
async def get_deal(deal_id: str, db: AsyncSession = Depends(get_db)):
    deal = await db.get(Deal, deal_id)
    if not deal:
        return None
    return row_to_deal(deal)


@router.patch("/{deal_id}")
async def update_deal(deal_id: str, updates: dict, db: AsyncSession = Depends(get_db)):
    deal = await db.get(Deal, deal_id)
    if not deal:
        return None
    prev_stage = deal.stage
    for k, v in updates.items():
        snake = "".join("_" + c.lower() if c.isupper() else c for c in k).lstrip("_")
        if hasattr(deal, snake):
            setattr(deal, snake, v)
    await db.flush()
    if "stage" in updates and deal.stage != prev_stage:
        await log_entity_mutation(
            db,
            event_type="deal.stage.changed",
            entity_type="deal",
            entity_id=deal_id,
            source="deals-router-patch",
            actor_id=updates.get("updatedByUserId"),
            payload={
                "dealId": deal_id,
                "title": deal.title,
                "fromStage": prev_stage,
                "toStage": deal.stage,
                "assigneeId": deal.assignee_id,
            },
        )
    await log_entity_mutation(
        db,
        event_type="deal.patched",
        entity_type="deal",
        entity_id=deal_id,
        source="deals-router-patch",
        actor_id=updates.get("updatedByUserId"),
        payload={"fields": list(updates.keys())},
    )
    await db.commit()
    await db.refresh(deal)
    return row_to_deal(deal)


@router.delete("/{deal_id}")
async def delete_deal(deal_id: str, db: AsyncSession = Depends(get_db)):
    deal = await db.get(Deal, deal_id)
    if deal:
        deal.is_archived = True
        await db.flush()
        await log_entity_mutation(
            db,
            event_type="deal.archived",
            entity_type="deal",
            entity_id=deal_id,
            source="deals-router",
            payload={"title": deal.title},
        )
        await db.commit()
    return {"ok": True}
