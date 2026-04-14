"""If-Match / поле version + разбор конфликтов optimistic locking (409)."""
from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.exc import StaleDataError


def parse_if_match_header(raw: str | None) -> int | None:
    if raw is None:
        return None
    h = raw.strip()
    if not h or h == "*":
        return None
    if h.upper().startswith("W/"):
        h = h[2:].strip()
    if len(h) >= 2 and h[0] == '"' and h[-1] == '"':
        h = h[1:-1]
    try:
        return int(h.strip())
    except ValueError as e:
        raise HTTPException(status_code=400, detail="invalid_if_match") from e


def merge_expected_version(*, if_match: int | None, body_version: int | None) -> int | None:
    if if_match is not None and body_version is not None and if_match != body_version:
        raise HTTPException(
            status_code=400,
            detail={"code": "version_conflict", "message": "If-Match and body.version must match"},
        )
    return if_match if if_match is not None else body_version


def enforce_expected_version_row(*, row_version: int, expected: int | None) -> None:
    if expected is None:
        return
    if row_version != expected:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "stale_version",
                "message": "Resource was modified; refresh and retry.",
                "current_version": row_version,
            },
        )


async def commit_or_stale_version_conflict(db: AsyncSession) -> None:
    try:
        await db.commit()
    except StaleDataError:
        await db.rollback()
        raise HTTPException(
            status_code=409,
            detail={
                "code": "stale_version",
                "message": "Concurrent update detected; refresh and retry.",
            },
        ) from None
