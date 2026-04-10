"""Проверка прав пользователя по роли."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.role import Role
from app.models.user import User
from app.permissions import normalize_permissions, role_has_permission


async def user_has_permission(db: AsyncSession, user: User, permission: str) -> bool:
    if not user.role_id:
        return False
    r = await db.get(Role, user.role_id)
    if not r:
        return False
    perms = normalize_permissions(r.permissions)
    # Как на фронте: роль admin без явного списка прав — полный доступ
    if (r.slug or "").strip().lower() == "admin" and not perms:
        return True
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
    return normalize_permissions(r.permissions)


async def count_users_with_role(db: AsyncSession, role_id: str) -> int:
    from sqlalchemy import func

    result = await db.execute(select(func.count()).select_from(User).where(User.role_id == role_id))
    return int(result.scalar_one() or 0)
