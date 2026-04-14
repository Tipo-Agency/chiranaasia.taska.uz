"""Каталог планируемых интеграций (дорожная карта) — без секретов, для UI настроек."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.auth import get_current_user
from app.models.user import User
from app.schemas.integrations_roadmap import IntegrationsRoadmapResponse
from app.services.integrations_roadmap_catalog import build_integrations_roadmap

router = APIRouter(prefix="/integrations", tags=["integrations-roadmap"])


@router.get(
    "/roadmap",
    response_model=IntegrationsRoadmapResponse,
    summary="Каталог планируемых интеграций",
    description=(
        "Структура доменов (почта, 1С, телефония, ЭДО, банки) и видов коннекторов. "
        "Подробности и принципы — `docs/INTEGRATIONS.md` §12."
    ),
)
async def get_integrations_roadmap(_user: User = Depends(get_current_user)) -> IntegrationsRoadmapResponse:
    return build_integrations_roadmap()
