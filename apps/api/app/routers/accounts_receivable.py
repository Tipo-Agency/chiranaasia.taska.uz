"""Accounts receivable router."""
import uuid
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.client import AccountsReceivable
from app.utils import row_to_accounts_receivable
from app.services.domain_events import log_entity_mutation

router = APIRouter(prefix="/accounts-receivable", tags=["accounts-receivable"])


@router.get("")
async def get_accounts_receivable(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AccountsReceivable))
    return [row_to_accounts_receivable(a) for a in result.scalars().all()]


@router.put("")
async def update_accounts_receivable(items: list[dict], db: AsyncSession = Depends(get_db)):
    def str_val(v):
        return str(v) if v is not None else None
    def safe_ref(raw):
        if raw is None:
            return ""
        return str(raw)[:36]
    def safe_id(raw):
        if not raw:
            return str(uuid.uuid4())
        sid = str(raw)
        if len(sid) > 36:
            return str(uuid.uuid4())
        return sid
    for a in items:
        aid = safe_id(a.get("id"))
        existing_ar = await db.get(AccountsReceivable, aid)
        is_new = existing_ar is None
        payload = {
            "id": aid,
            "client_id": safe_ref(a.get("clientId", "")),
            "deal_id": safe_ref(a.get("dealId", "")),
            "amount": str_val(a.get("amount")) or "0",
            "currency": a.get("currency", "UZS"),
            "due_date": a.get("dueDate", ""),
            "status": a.get("status", "current"),
            "description": a.get("description", ""),
            "paid_amount": str_val(a.get("paidAmount")),
            "paid_date": a.get("paidDate"),
            "created_at": a.get("createdAt", ""),
            "updated_at": a.get("updatedAt"),
            "is_archived": a.get("isArchived", False),
        }
        stmt = insert(AccountsReceivable).values(**payload)
        stmt = stmt.on_conflict_do_update(
            index_elements=[AccountsReceivable.id],
            set_={
                "client_id": payload["client_id"],
                "deal_id": payload["deal_id"],
                "amount": payload["amount"],
                "currency": payload["currency"],
                "due_date": payload["due_date"],
                "status": payload["status"],
                "description": payload["description"],
                "paid_amount": payload["paid_amount"],
                "paid_date": payload["paid_date"],
                "updated_at": payload["updated_at"],
                "is_archived": payload["is_archived"],
            },
        )
        await db.execute(stmt)
        await db.flush()
        await log_entity_mutation(
            db,
            event_type="accounts_receivable.created" if is_new else "accounts_receivable.updated",
            entity_type="accounts_receivable",
            entity_id=aid,
            source="accounts-receivable-router",
            payload={"clientId": payload["client_id"], "amount": payload["amount"], "status": payload["status"]},
        )
    await db.commit()
    return {"ok": True}
