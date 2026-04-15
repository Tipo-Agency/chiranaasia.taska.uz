"""Связка сделки с CRM-контактом: автоподбор/создание при наличии телефона или соцсетей."""
from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.mappers import _legacy_telegram_username
from app.models.client import CrmContact, Deal
from app.services.client_contact import normalize_phone


def _strip_handle(s: str | None, max_len: int) -> str | None:
    if s is None:
        return None
    t = str(s).strip()
    if not t:
        return None
    if t.startswith("@"):
        t = t[1:]
    t = t.strip()
    return t[:max_len].lower() if t else None


def _contact_tags_from_deal(cf: dict[str, Any]) -> list[str]:
    raw = cf.get("contact_tags") if isinstance(cf.get("contact_tags"), list) else []
    out: list[str] = []
    for x in raw[:50]:
        t = str(x).strip()[:200]
        if t and t not in out:
            out.append(t)
    return out


def deal_row_contact_signals(row: Deal) -> tuple[str | None, str | None, str | None, str | None]:
    """(display_name, phone, telegram_handle, instagram_handle) — только непустые каналы дают сигнал."""
    cf = row.custom_fields if isinstance(row.custom_fields, dict) else {}
    raw_phone = cf.get("phone")
    if raw_phone is None:
        raw_phone = cf.get("contactPhone")
    phone = normalize_phone(str(raw_phone)) if raw_phone is not None else None
    ig_raw = cf.get("instagram") or cf.get("instagramUsername") or cf.get("instagram_username")
    ig = _strip_handle(str(ig_raw) if ig_raw is not None else None, 255)
    tgun = _legacy_telegram_username(cf) or None
    tg = _strip_handle(tgun, 100)
    name = (row.contact_name or "").strip()[:255] or None
    display = name or "Контакт"
    has_signal = bool(phone or tg or ig)
    if not has_signal:
        return None, None, None, None
    return display, phone, tg, ig


async def assert_contact_allowed_for_client(
    db: AsyncSession, *, contact_id: str | None, client_id: str | None
) -> None:
    from fastapi import HTTPException

    if not contact_id:
        return
    c = await db.get(CrmContact, contact_id)
    if not c:
        raise HTTPException(status_code=404, detail="contact_not_found")
    if client_id and c.client_id and c.client_id != client_id:
        raise HTTPException(status_code=422, detail="contact_client_mismatch")


async def attach_contact_to_client_if_needed(
    db: AsyncSession, contact: CrmContact, client_id: str | None
) -> None:
    if client_id and contact.client_id is None:
        contact.client_id = client_id


async def maybe_ensure_contact_for_deal(db: AsyncSession, deal: Deal) -> None:
    """Если у сделки уже есть contact_id — ничего. Иначе при компании и каналах — найти или создать контакт."""
    if deal.contact_id:
        c = await db.get(CrmContact, deal.contact_id)
        if c:
            await attach_contact_to_client_if_needed(db, c, deal.client_id)
        return
    if not deal.client_id:
        return
    display, phone, tg, ig = deal_row_contact_signals(deal)
    if not phone and not tg and not ig:
        return

    conds = []
    if phone:
        conds.append(CrmContact.phone == phone)
    if tg:
        conds.append(CrmContact.telegram == tg)
    if ig:
        conds.append(CrmContact.instagram == ig)
    if not conds:
        return

    res = await db.execute(
        select(CrmContact)
        .where(
            CrmContact.client_id == deal.client_id,
            CrmContact.is_archived.is_(False),
            or_(*conds),
        )
        .limit(1)
    )
    found = res.scalar_one_or_none()
    cf = deal.custom_fields if isinstance(deal.custom_fields, dict) else {}
    extra_tags = _contact_tags_from_deal(cf)

    if found:
        if display and (not (found.name or "").strip() or found.name.strip() == "Контакт"):
            found.name = display[:255]
        if phone and not found.phone:
            found.phone = phone
        if tg and not found.telegram:
            found.telegram = tg
        if ig and not found.instagram:
            found.instagram = ig
        if extra_tags:
            cur = list(found.tags) if found.tags is not None else []
            for t in extra_tags:
                if t not in cur:
                    cur.append(t)
            found.tags = cur[:200]
        deal.contact_id = found.id
        return

    cid = str(uuid.uuid4())
    tags = extra_tags
    row = CrmContact(
        id=cid,
        version=1,
        client_id=deal.client_id,
        name=display[:255],
        phone=phone,
        email=None,
        telegram=tg,
        instagram=ig,
        job_title=None,
        notes=None,
        tags=tags,
        is_archived=False,
    )
    db.add(row)
    await db.flush()
    deal.contact_id = cid
