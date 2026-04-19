"""Брендинг организации: публичное чтение, правка только admin.system."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user_admin
from app.db import get_db
from app.models.org_system_prefs import OrgSystemPrefs

_DEFAULT_ID = "default"
_MAX_SVG = 400_000

router = APIRouter(prefix="/org", tags=["org"])


class OrgBrandingRead(BaseModel):
    primaryColor: str
    logoSvgLight: str | None = None
    logoSvgDark: str | None = None


class OrgBrandingPatch(BaseModel):
    primaryColor: str | None = Field(None, max_length=16)
    logoSvgLight: str | None = Field(None, max_length=_MAX_SVG)
    logoSvgDark: str | None = Field(None, max_length=_MAX_SVG)
    logoSvg: str | None = Field(
        None,
        max_length=_MAX_SVG,
        description="Устарело: при отсутствии logoSvgLight записывается как логотип для светлой темы.",
    )


async def _get_row(db: AsyncSession) -> OrgSystemPrefs:
    res = await db.execute(select(OrgSystemPrefs).where(OrgSystemPrefs.id == _DEFAULT_ID))
    row = res.scalar_one_or_none()
    if row is None:
        row = OrgSystemPrefs(id=_DEFAULT_ID, primary_color="#F97316", logo_svg=None, logo_svg_dark=None)
        db.add(row)
        await db.commit()
        await db.refresh(row)
    return row


def _normalize_hex(v: str) -> str:
    s = v.strip()
    if s.startswith("#"):
        s = s[1:]
    if len(s) == 6 and all(c in "0123456789abcdefABCDEF" for c in s):
        return "#" + s.upper()
    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail="primaryColor must be #RRGGBB or RRGGBB",
    )


def _read_response(row: OrgSystemPrefs) -> OrgBrandingRead:
    return OrgBrandingRead(
        primaryColor=(row.primary_color or "#F97316").strip(),
        logoSvgLight=row.logo_svg,
        logoSvgDark=row.logo_svg_dark,
    )


@router.get("/branding", response_model=OrgBrandingRead)
async def get_org_branding(db: AsyncSession = Depends(get_db)) -> Any:
    """Без JWT — для страницы входа и первого кадра SPA."""
    row = await _get_row(db)
    return _read_response(row)


@router.patch("/branding", response_model=OrgBrandingRead, dependencies=[Depends(get_current_user_admin)])
async def patch_org_branding(body: OrgBrandingPatch, db: AsyncSession = Depends(get_db)) -> Any:
    row = await _get_row(db)
    data = body.model_dump(exclude_unset=True)
    if "logoSvg" in data:
        if "logoSvgLight" not in data:
            data["logoSvgLight"] = data["logoSvg"]
        del data["logoSvg"]
    if "primaryColor" in data and data["primaryColor"] is not None:
        row.primary_color = _normalize_hex(str(data["primaryColor"]))
    if "logoSvgLight" in data:
        raw = data["logoSvgLight"]
        if raw is None or (isinstance(raw, str) and not raw.strip()):
            row.logo_svg = None
        elif isinstance(raw, str):
            row.logo_svg = raw.strip()[:_MAX_SVG]
        else:
            raise HTTPException(status_code=422, detail="logoSvgLight must be string or null")
    if "logoSvgDark" in data:
        raw = data["logoSvgDark"]
        if raw is None or (isinstance(raw, str) and not raw.strip()):
            row.logo_svg_dark = None
        elif isinstance(raw, str):
            row.logo_svg_dark = raw.strip()[:_MAX_SVG]
        else:
            raise HTTPException(status_code=422, detail="logoSvgDark must be string or null")
    await db.commit()
    await db.refresh(row)
    return _read_response(row)
