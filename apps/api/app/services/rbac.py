"""Проверка прав пользователя по роли."""
from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.role import Role
from app.models.user import User
from app.core.permissions import (
    effective_permissions_for_role_response,
    normalize_permissions,
    role_has_permission,
)


async def user_has_permission(db: AsyncSession, user: User, permission: str) -> bool:
    if not user.role_id:
        return False
    r = await db.get(Role, user.role_id)
    if not r:
        return False
    # Роль ``admin`` по slug — полный доступ (согласовано с ``effective_permissions_for_role_response``).
    if (r.slug or "").strip().lower() == "admin":
        return True
    perms = normalize_permissions(r.permissions)
    return role_has_permission(perms, permission)


async def user_has_crm_messaging_access(db: AsyncSession, user: User) -> bool:
    """Синхрон/отправка в мессенджеры и выдача вложений по сделке."""
    if await user_has_permission(db, user, "system.full_access"):
        return True
    if await user_has_permission(db, user, "crm.client_chats"):
        return True
    if await user_has_permission(db, user, "crm.sales_funnel"):
        return True
    return False


async def get_role_permissions_list(db: AsyncSession, role_id: str | None) -> list[str]:
    if not role_id:
        return []
    r = await db.get(Role, role_id)
    if not r:
        return []
    return effective_permissions_for_role_response(r.slug, r.permissions)


async def user_can_manage_funnel_site_key(db: AsyncSession, user: User, funnel: Any) -> bool:
    """
    Ключи сайта-интеграции: владелец воронки или глобальный админ (как legacy role ADMIN).
    """
    if getattr(funnel, "owner_user_id", None) and funnel.owner_user_id == user.id:
        return True
    if await user_has_permission(db, user, "system.full_access"):
        return True
    if await user_has_permission(db, user, "admin.system"):
        return True
    return False


async def count_users_with_role(db: AsyncSession, role_id: str) -> int:
    from sqlalchemy import func

    result = await db.execute(select(func.count()).select_from(User).where(User.role_id == role_id))
    return int(result.scalar_one() or 0)
