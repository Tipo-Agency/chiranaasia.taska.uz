"""Clients router."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.client import Client
from app.services.domain_events import log_entity_mutation
from app.utils import row_to_client

router = APIRouter(prefix="/clients", tags=["clients"])


@router.get("")
async def get_clients(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Client))
    return [row_to_client(c) for c in result.scalars().all()]


@router.put("")
async def update_clients(clients: list[dict], db: AsyncSession = Depends(get_db)):
    for c in clients:
        cid = c.get("id")
        if not cid:
            continue
        existing = await db.get(Client, cid)
        is_new = existing is None
        if existing:
            existing.name = c.get("name", existing.name)
            existing.contact_person = c.get("contactPerson")
            existing.phone = c.get("phone")
            existing.email = c.get("email")
            existing.telegram = c.get("telegram")
            existing.instagram = c.get("instagram")
            existing.company_name = c.get("companyName")
            existing.company_info = c.get("companyInfo")
            existing.notes = c.get("notes")
            existing.funnel_id = c.get("funnelId")
            existing.is_archived = c.get("isArchived", False)
        else:
            db.add(Client(
                id=cid,
                name=c.get("name", ""),
                contact_person=c.get("contactPerson"),
                phone=c.get("phone"),
                email=c.get("email"),
                telegram=c.get("telegram"),
                instagram=c.get("instagram"),
                company_name=c.get("companyName"),
                company_info=c.get("companyInfo"),
                notes=c.get("notes"),
                funnel_id=c.get("funnelId"),
                is_archived=c.get("isArchived", False),
            ))
        await db.flush()
        row = await db.get(Client, cid)
        await log_entity_mutation(
            db,
            event_type="client.created" if is_new else "client.updated",
            entity_type="client",
            entity_id=cid,
            source="clients-router",
            payload={"name": row.name if row else c.get("name"), "isArchived": getattr(row, "is_archived", False) if row else c.get("isArchived")},
        )
    await db.commit()
    return {"ok": True}
