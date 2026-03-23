"""Deals router."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.client import Deal
from app.utils import row_to_deal
from app.services.domain_events import emit_domain_event

router = APIRouter(prefix="/deals", tags=["deals"])


@router.get("")
async def get_deals(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Deal))
    return [row_to_deal(d) for d in result.scalars().all()]


@router.put("")
async def update_deals(deals: list[dict], db: AsyncSession = Depends(get_db)):
    for d in deals:
        did = d.get("id")
        if not did:
            continue
        existing = await db.get(Deal, did)
        prev_assignee = existing.assignee_id if existing else None
        def str_val(v):
            return str(v) if v is not None else None
        if existing:
            existing.title = d.get("title", existing.title)
            existing.client_id = d.get("clientId")
            existing.contact_name = d.get("contactName")
            existing.amount = str_val(d.get("amount"))
            existing.currency = d.get("currency", existing.currency)
            existing.stage = d.get("stage", existing.stage)
            existing.funnel_id = d.get("funnelId")
            existing.source = d.get("source")
            existing.telegram_chat_id = d.get("telegramChatId")
            existing.telegram_username = d.get("telegramUsername")
            existing.assignee_id = d.get("assigneeId", existing.assignee_id)
            existing.created_at = d.get("createdAt", existing.created_at)
            existing.notes = d.get("notes")
            existing.project_id = d.get("projectId")
            existing.comments = d.get("comments", existing.comments or [])
            existing.is_archived = d.get("isArchived", False)
            existing.recurring = d.get("recurring", False)
            existing.number = d.get("number")
            existing.status = d.get("status")
            existing.description = d.get("description")
            existing.date = d.get("date")
            existing.due_date = d.get("dueDate")
            existing.paid_amount = str_val(d.get("paidAmount"))
            existing.paid_date = d.get("paidDate")
            existing.start_date = d.get("startDate")
            existing.end_date = d.get("endDate")
            existing.payment_day = str(d.get("paymentDay")) if d.get("paymentDay") is not None else None
            existing.updated_at = d.get("updatedAt")
        else:
            db.add(Deal(
                id=did,
                title=d.get("title", ""),
                client_id=d.get("clientId"),
                contact_name=d.get("contactName"),
                amount=str_val(d.get("amount")) or "0",
                currency=d.get("currency", "UZS"),
                stage=d.get("stage", "new"),
                funnel_id=d.get("funnelId"),
                source=d.get("source"),
                telegram_chat_id=d.get("telegramChatId"),
                telegram_username=d.get("telegramUsername"),
                assignee_id=d.get("assigneeId", ""),
                created_at=d.get("createdAt", __import__("datetime").datetime.utcnow().isoformat()),
                notes=d.get("notes"),
                project_id=d.get("projectId"),
                comments=d.get("comments", []),
                is_archived=d.get("isArchived", False),
                recurring=d.get("recurring", False),
                number=d.get("number"),
                status=d.get("status"),
                description=d.get("description"),
                date=d.get("date"),
                due_date=d.get("dueDate"),
                paid_amount=str_val(d.get("paidAmount")),
                paid_date=d.get("paidDate"),
                start_date=d.get("startDate"),
                end_date=d.get("endDate"),
                payment_day=str(d.get("paymentDay")) if d.get("paymentDay") is not None else None,
                updated_at=d.get("updatedAt"),
            ))
        await db.flush()

        assignee = d.get("assigneeId") or (existing.assignee_id if existing else None)
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
                    "title": d.get("title", ""),
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
                    "title": d.get("title", existing.title),
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
    for k, v in updates.items():
        snake = "".join("_" + c.lower() if c.isupper() else c for c in k).lstrip("_")
        if hasattr(deal, snake):
            setattr(deal, snake, v)
    await db.commit()
    await db.refresh(deal)
    return row_to_deal(deal)


@router.delete("/{deal_id}")
async def delete_deal(deal_id: str, db: AsyncSession = Depends(get_db)):
    deal = await db.get(Deal, deal_id)
    if deal:
        deal.is_archived = True
        await db.commit()
    return {"ok": True}
