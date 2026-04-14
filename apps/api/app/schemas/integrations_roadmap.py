"""Схемы каталога планируемых интеграций (без секретов, для UI и документации)."""

from __future__ import annotations

from pydantic import BaseModel, Field


class IntegrationConnectorKind(BaseModel):
    """Вид коннектора внутри домена (например разные способы выгрузки из 1С)."""

    id: str = Field(..., description="Стабильный ключ, например odata_v4, exchange_xml")
    title: str
    description: str | None = None


class IntegrationProviderHint(BaseModel):
    """Провайдер или стек, под который закладывается поддержка."""

    id: str
    title: str


class IntegrationRoadmapItem(BaseModel):
    """Одна запись в дорожной карте внутри домена."""

    id: str
    title: str
    description: str | None = None
    status: str = Field(
        default="planned",
        description="planned | design | alpha | beta | stable — для UI; не путать с рантайм-статусом подключения",
    )
    connector_kinds: list[IntegrationConnectorKind] = Field(default_factory=list)
    provider_hints: list[IntegrationProviderHint] = Field(default_factory=list)


class IntegrationRoadmapDomain(BaseModel):
    """Крупный раздел продукта (отдельный «зонтик» в настройках интеграций)."""

    id: str = Field(..., description="Например email_corp, onec, telephony, edo, banking")
    title: str
    summary: str | None = None
    items: list[IntegrationRoadmapItem] = Field(default_factory=list)


class IntegrationsRoadmapResponse(BaseModel):
    """Ответ GET …/integrations/roadmap."""

    version: str = Field(default="2", description="Версия схемы каталога")
    domains: list[IntegrationRoadmapDomain]
