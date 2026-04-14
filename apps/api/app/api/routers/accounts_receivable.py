"""Accounts receivable router."""
import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.client import AccountsReceivable
from app.schemas.accounts_receivable import AccountsReceivableItem, AccountsReceivableRead
from app.schemas.common_responses import OkResponse
from app.services.domain_events import log_entity_mutation
from app.core.mappers import row_to_accounts_receivable
from app.services.accounts_receivable_status import compute_ar_status_from_row_values
from app.core.auth import get_current_user

router = APIRouter(prefix="/accounts-receivable", tags=["accounts-receivable"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[AccountsReceivableRead])
async def get_accounts_receivable(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AccountsReceivable))
    return [row_to_accounts_receivable(a) for a in result.scalars().all()]


@router.put("", response_model=OkResponse)
async def update_accounts_receivable(items: list[AccountsReceivableItem], db: AsyncSession = Depends(get_db)):
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
        aid = safe_id(a.id)
        existing_ar = await db.get(AccountsReceivable, aid)
        is_new = existing_ar is None
        amount_s = str_val(a.amount) or "0"
        paid_s = str_val(a.paidAmount)
        due_s = a.dueDate or ""
        computed_status = compute_ar_status_from_row_values(amount_s, paid_s, due_s)
        payload = {
            "id": aid,
            "client_id": safe_ref(a.clientId),
            "deal_id": safe_ref(a.dealId),
            "amount": amount_s,
            "currency": a.currency,
            "due_date": due_s,
            "status": computed_status,
            "description": a.description,
            "paid_amount": paid_s,
            "paid_date": a.paidDate,
            "created_at": a.createdAt,
            "updated_at": a.updatedAt,
            "is_archived": a.isArchived,
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
                "status": computed_status,
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
            payload={"clientId": a.clientId, "amount": amount_s, "status": computed_status},
        )
    await db.commit()
    return {"ok": True}
