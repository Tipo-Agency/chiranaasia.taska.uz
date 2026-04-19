"""Брендинг организации: публичное чтение, правка только admin.system."""

from __future__ import annotations

import re
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user_admin
from app.db import get_db
from app.models.org_system_prefs import OrgSystemPrefs

_DEFAULT_ID = "default"
_HEX_COLOR = re.compile(r"^#[0-9A-Fa-f]{6}$")
_MAX_SVG = 400_000

router = APIRouter(prefix="/org", tags=["org"])


class OrgBrandingRead(BaseModel):
    primaryColor: str
    logoSvg: str | None = None


class OrgBrandingPatch(BaseModel):
    primaryColor: str | None = Field(None, max_length=16)
    logoSvg: str | None = Field(None, max_length=_MAX_SVG)


async def _get_row(db: AsyncSession) -> OrgSystemPrefs:
    res = await db.execute(select(OrgSystemPrefs).where(OrgSystemPrefs.id == _DEFAULT_ID))
    row = res.scalar_one_or_none()
    if row is None:
        row = OrgSystemPrefs(id=_DEFAULT_ID, primary_color="#F97316", logo_svg=None)
        db.add(row)
        await db.commit()
        await db.refresh(row)
    return row


def _validate_color(v: str) -> str:
    s = v.strip()
    if not _HEX_COLOR.match(s):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="primaryColor must be #RRGGBB")
    return s


@router.get("/branding", response_model=OrgBrandingRead)
async def get_org_branding(db: AsyncSession = Depends(get_db)) -> Any:
    """Без JWT — для страницы входа и первого кадра SPA."""
    row = await _get_row(db)
    return OrgBrandingRead(primaryColor=(row.primary_color or "#F97316").strip(), logoSvg=row.logo_svg)


@router.patch("/branding", response_model=OrgBrandingRead, dependencies=[Depends(get_current_user_admin)])
async def patch_org_branding(body: OrgBrandingPatch, db: AsyncSession = Depends(get_db)) -> Any:
    row = await _get_row(db)
    data = body.model_dump(exclude_unset=True)
    if "primaryColor" in data and data["primaryColor"] is not None:
        row.primary_color = _validate_color(str(data["primaryColor"]))
    if "logoSvg" in data:
        raw = data["logoSvg"]
        if raw is None or (isinstance(raw, str) and not raw.strip()):
            row.logo_svg = None
        elif isinstance(raw, str):
            row.logo_svg = raw.strip()[:_MAX_SVG]
        else:
            raise HTTPException(status_code=422, detail="logoSvg must be string or null")
    await db.commit()
    await db.refresh(row)
    return OrgBrandingRead(primaryColor=row.primary_color, logoSvg=row.logo_svg)
