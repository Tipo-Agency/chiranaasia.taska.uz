"""Opaque refresh tokens: create, rotate, revoke (храним только SHA-256)."""
from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.refresh_token import RefreshToken
from app.models.user import User


def _hash(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


async def issue_refresh_token(db: AsyncSession, user: User, family_id: str | None = None) -> tuple[str, RefreshToken]:
    settings = get_settings()
    raw = secrets.token_urlsafe(48)
    fid = family_id or str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    expires = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    row = RefreshToken(
        id=str(uuid.uuid4()),
        user_id=user.id,
        token_hash=_hash(raw),
        family_id=fid,
        expires_at=expires,
    )
    db.add(row)
    await db.flush()
    return raw, row


async def rotate_refresh_token(
    db: AsyncSession,
    raw_old: str,
) -> tuple[User, str, str] | None:
    """По старому refresh выдать новую пару access+refresh; старый инвалидируется (rotation)."""
    settings = get_settings()
    h = _hash(raw_old)
    result = await db.execute(select(RefreshToken).where(RefreshToken.token_hash == h))
    old = result.scalar_one_or_none()
    if not old or old.revoked_at is not None:
        return None
    now = datetime.now(timezone.utc)
    exp = old.expires_at
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp <= now:
        return None

    user = await db.get(User, old.user_id)
    if not user or user.is_archived:
        return None

    raw_new, row_new = await issue_refresh_token(db, user, family_id=old.family_id)
    old.revoked_at = now
    old.replaced_by_id = row_new.id
    await db.flush()

    from app.core.auth import create_access_token

    access = create_access_token(
        data={"sub": user.id, "tv": user.token_version},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return user, access, raw_new


async def revoke_refresh_token(db: AsyncSession, raw: str) -> bool:
    h = _hash(raw)
    result = await db.execute(select(RefreshToken).where(RefreshToken.token_hash == h))
    row = result.scalar_one_or_none()
    if not row or row.revoked_at is not None:
        return False
    row.revoked_at = datetime.now(timezone.utc)
    await db.flush()
    return True


async def revoke_all_refresh_for_user(db: AsyncSession, user_id: str) -> None:
    await db.execute(delete(RefreshToken).where(RefreshToken.user_id == user_id))
