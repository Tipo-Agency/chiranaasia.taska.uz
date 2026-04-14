"""При архивации сделки — мягко архивировать связанные задачи, встречи, дебиторку."""

from __future__ import annotations

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import AccountsReceivable, Deal
from app.models.content import Meeting
from app.models.task import Task


async def archive_entities_linked_to_deal(db: AsyncSession, deal_id: str) -> None:
    """
    Idempotent: трогаем только строки с is_archived=False.
    Вызывать в той же транзакции, что и архивация сделки (до commit).
    """
    did = str(deal_id).strip()[:36]
    if not did:
        return

    await db.execute(
        update(Task)
        .where(Task.deal_id == did, Task.is_archived.is_(False))
        .values(is_archived=True, version=Task.version + 1)
    )
    await db.execute(
        update(Meeting).where(Meeting.deal_id == did, Meeting.is_archived.is_(False)).values(is_archived=True)
    )
    await db.execute(
        update(AccountsReceivable)
        .where(AccountsReceivable.deal_id == did, AccountsReceivable.is_archived.is_(False))
        .values(is_archived=True)
    )


def deal_just_archived(*, existing: Deal | None, row: Deal | None) -> bool:
    """Сделка перешла в архив в этом запросе (не была архивной, стала)."""
    if row is None or not bool(row.is_archived):
        return False
    if existing is None:
        return False
    return not bool(existing.is_archived)
