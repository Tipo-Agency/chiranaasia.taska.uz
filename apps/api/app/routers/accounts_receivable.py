"""Accounts receivable router."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.client import AccountsReceivable
from app.utils import row_to_accounts_receivable

router = APIRouter(prefix="/accounts-receivable", tags=["accounts-receivable"])


@router.get("")
async def get_accounts_receivable(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AccountsReceivable))
    return [row_to_accounts_receivable(a) for a in result.scalars().all()]


@router.put("")
async def update_accounts_receivable(items: list[dict], db: AsyncSession = Depends(get_db)):
    def str_val(v):
        return str(v) if v is not None else None
    for a in items:
        aid = a.get("id")
        if not aid:
            continue
        existing = await db.get(AccountsReceivable, aid)
        if existing:
            existing.client_id = a.get("clientId", existing.client_id)
            existing.deal_id = a.get("dealId", existing.deal_id)
            existing.amount = str_val(a.get("amount")) or existing.amount
            existing.currency = a.get("currency", existing.currency)
            existing.due_date = a.get("dueDate", existing.due_date)
            existing.status = a.get("status", existing.status)
            existing.description = a.get("description")
            existing.paid_amount = str_val(a.get("paidAmount"))
            existing.paid_date = a.get("paidDate")
            existing.created_at = a.get("createdAt", existing.created_at)
            existing.updated_at = a.get("updatedAt")
            existing.is_archived = a.get("isArchived", False)
        else:
            db.add(AccountsReceivable(
                id=aid,
                client_id=a.get("clientId", ""),
                deal_id=a.get("dealId", ""),
                amount=str_val(a.get("amount")) or "0",
                currency=a.get("currency", "UZS"),
                due_date=a.get("dueDate", ""),
                status=a.get("status", "current"),
                description=a.get("description", ""),
                paid_amount=str_val(a.get("paidAmount")),
                paid_date=a.get("paidDate"),
                created_at=a.get("createdAt", ""),
                updated_at=a.get("updatedAt"),
                is_archived=a.get("isArchived", False),
            ))
    await db.commit()
    return {"ok": True}
