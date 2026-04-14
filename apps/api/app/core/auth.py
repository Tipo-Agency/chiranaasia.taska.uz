"""JWT auth; хеширование паролей — см. ``app.core.password_hashing`` (bcrypt + соль в хеше)."""
from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import Depends, HTTPException, Request, status
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.password_hashing import (
    hash_password_bcrypt,
)
from app.core.password_hashing import (
    looks_like_bcrypt_hash as _looks_like_bcrypt_hash,
)
from app.core.password_hashing import (
    verify_password as _verify_password_bcrypt,
)
from app.db import get_db
from app.models.user import User


def _bearer_from_header(authorization: str | None) -> str | None:
    if not authorization:
        return None
    parts = authorization.split(None, 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    return parts[1].strip() or None


def get_access_token_from_request(request: Request) -> str | None:
    """HttpOnly cookie; при AUTH_ALLOW_BEARER_HEADER — дополнительно Authorization: Bearer."""
    s = get_settings()
    c = request.cookies.get(s.ACCESS_TOKEN_COOKIE_NAME)
    if c:
        return c
    if s.AUTH_ALLOW_BEARER_HEADER:
        return _bearer_from_header(request.headers.get("authorization"))
    return None


def get_password_hash(password: str) -> str:
    """Новый bcrypt-хеш с уникальной солью и стоимостью из ``BCRYPT_ROUNDS``."""
    settings = get_settings()
    return hash_password_bcrypt(password, rounds=int(settings.BCRYPT_ROUNDS))


def verify_password(plain: str, hashed: str) -> bool:
    """Совместимый экспорт для роутеров/тестов: проверка plaintext vs bcrypt-хеш."""
    return _verify_password_bcrypt(plain, hashed)


def looks_like_bcrypt_hash(value: str) -> bool:
    """Совместимый экспорт для bulk-импорта пользователей."""
    return _looks_like_bcrypt_hash(value)


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    settings = get_settings()
    to_encode = data.copy()
    delta = expires_delta if expires_delta is not None else timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    expire = datetime.utcnow() + delta
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict | None:
    settings = get_settings()
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None


def get_current_user_optional(request: Request) -> str | None:
    """User id из JWT или None (без исключения)."""
    token = get_access_token_from_request(request)
    if not token:
        return None
    payload = decode_token(token)
    if not payload:
        return None
    sub = payload.get("sub")
    return str(sub) if sub else None


def require_jwt_payload(request: Request) -> dict:
    """Валидный JWT payload (sub + tv)."""
    token = get_access_token_from_request(request)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    sub = payload.get("sub")
    if not sub:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    return payload


async def get_user_if_authenticated(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """Текущий пользователь по cookie/Bearer или None (без 401). Для опциональных проверок (например смена stage)."""
    token = get_access_token_from_request(request)
    if not token:
        return None
    payload = decode_token(token)
    if not payload:
        return None
    sub = payload.get("sub")
    if not sub:
        return None
    user_id = str(sub)
    tv_claim = payload.get("tv")
    result = await db.execute(select(User).where(User.id == user_id, User.is_archived.is_(False)))
    user = result.scalar_one_or_none()
    if not user:
        return None
    if tv_claim is None:
        if int(user.token_version or 0) != 0:
            return None
    elif int(tv_claim) != int(user.token_version or 0):
        return None
    return user


async def get_current_user(
    payload: dict = Depends(require_jwt_payload),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Load current user from DB by token. Raises 401 if not found or token_version mismatch."""
    user_id = str(payload.get("sub"))
    tv_claim = payload.get("tv")
    result = await db.execute(select(User).where(User.id == user_id, User.is_archived.is_(False)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    if tv_claim is None:
        if int(user.token_version or 0) != 0:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired")
    elif int(tv_claim) != int(user.token_version or 0):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session invalidated")
    return user


def require_permission(permission: str, *, detail: str = "Permission denied"):
    """
    Фабрика зависимости FastAPI: ``Depends(require_permission("tasks.edit"))``.

    Аргумент ``permission`` — строковый ключ RBAC (константы ``PERM_*`` в ``app.core.permissions``).
    Проверка через ``user_has_permission``; без права — **403** с ``detail``.
    """

    async def _dep(
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> User:
        from app.services.rbac import user_has_permission

        if await user_has_permission(db, current_user, permission):
            return current_user
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)

    return _dep


def require_any_permission(*permissions: str, detail: str = "Permission denied"):
    """Depends(require_any_permission('access.roles', 'access.users')) — достаточно одного из прав."""

    if not permissions:
        raise ValueError("require_any_permission: нужен хотя бы один permission")

    async def _dep(
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> User:
        from app.services.rbac import user_has_permission

        for p in permissions:
            if await user_has_permission(db, current_user, p):
                return current_user
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)

    return _dep


# Системная админка (логи, БД, тесты, audit_logs) — право RBAC ``admin.system`` (или ``system.full_access``).
get_current_user_admin = require_permission("admin.system", detail="Admin access required")
require_admin_system = get_current_user_admin


async def require_crm_messaging_access(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Доступ к операциям чата CRM (личный Telegram, Instagram send и т.п.)."""
    from app.services.rbac import user_has_crm_messaging_access

    if await user_has_crm_messaging_access(db, current_user):
        return current_user
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied")
