"""Правила смены стадии сделки: терминальные won/lost, lost_reason, обход при праве crm.deals.edit."""
from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import PERM_CRM_DEALS_EDIT
from app.domain.deals import DealStageTransitionError, check_deal_stage_transition
from app.models.user import User
from app.services.rbac import user_has_permission


async def user_may_bypass_deal_terminal_stage(db: AsyncSession, user: User | None) -> bool:
    """Снятие блокировки выхода из won/lost: право ``crm.deals.edit`` (или ``system.full_access`` через RBAC)."""
    if user is None:
        return False
    return await user_has_permission(db, user, PERM_CRM_DEALS_EDIT)


def assert_deal_stage_transition_allowed(
    *,
    from_stage: str | None,
    to_stage: str | None,
    lost_reason_effective: str | None,
    is_admin: bool,
) -> None:
    """
    Проверка перехода from_stage → to_stage (уже с учётом PATCH/тела запроса).
    - Из won / lost в любую другую стадию — только при ``is_admin`` (см. ``user_may_bypass_deal_terminal_stage`` / ``crm.deals.edit``).
    - Вход в lost — непустой lost_reason (для всех).
    """
    try:
        check_deal_stage_transition(
            from_stage=from_stage,
            to_stage=to_stage,
            lost_reason_effective=lost_reason_effective,
            is_admin=is_admin,
        )
    except DealStageTransitionError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail) from e
