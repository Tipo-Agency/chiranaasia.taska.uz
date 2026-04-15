"""Pydantic-схемы сделок (docs/API.md § Deals, пагинация как у tasks)."""
from __future__ import annotations

from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.clients import ClientRead
from app.schemas.crm_contacts import CrmContactRead
from app.schemas.pagination import PaginatedResponse


def _normalize_camel_deal_keys(data: Any) -> Any:
    if not isinstance(data, dict):
        return data
    key_map = {
        "clientId": "client_id",
        "contactId": "contact_id",
        "contactName": "contact_name",
        "funnelId": "funnel_id",
        "assigneeId": "assignee_id",
        "sourceChatId": "source_chat_id",
        "telegramChatId": "source_chat_id",
        "customFields": "custom_fields",
        "lostReason": "lost_reason",
        "projectId": "project_id",
        "isArchived": "is_archived",
        "createdAt": "created_at",
        "updatedAt": "updated_at",
        "dueDate": "due_date",
        "paidAmount": "paid_amount",
        "paidDate": "paid_date",
        "startDate": "start_date",
        "endDate": "end_date",
        "paymentDay": "payment_day",
        "createdByUserId": "created_by_user_id",
        "updatedByUserId": "updated_by_user_id",
    }
    out = dict(data)
    for camel, snake in key_map.items():
        if camel in out and snake not in out:
            out[snake] = out.pop(camel)
        elif camel in out and snake in out:
            out.pop(camel, None)
    return out


class DealCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str | None = Field(default=None, max_length=36)
    title: str = Field(default="Новая сделка", min_length=1, max_length=500)
    client_id: str | None = Field(default=None, max_length=36)
    contact_id: str | None = Field(default=None, max_length=36)
    contact_name: str | None = Field(default=None, max_length=255)
    amount: Decimal | None = None
    currency: str = Field(default="UZS", max_length=10)
    stage: str = Field(default="new", max_length=100)
    funnel_id: str | None = Field(default=None, max_length=36)
    source: str | None = Field(default=None, max_length=50)
    source_chat_id: str | None = Field(default=None, max_length=255)
    tags: list[str] | None = None
    custom_fields: dict[str, Any] | None = None
    lost_reason: str | None = Field(default=None, max_length=10000)
    assignee_id: str | None = Field(default=None, max_length=36)
    notes: str | None = None
    project_id: str | None = Field(default=None, max_length=36)
    comments: list[dict[str, Any]] | None = None
    created_at: str | None = Field(default=None, max_length=50)
    telegram_username: str | None = Field(default=None, max_length=100)
    created_by_user_id: str | None = Field(default=None, max_length=36)

    @field_validator("assignee_id", "contact_id", mode="before")
    @classmethod
    def _empty_assignee_create(cls, v: Any) -> Any:
        if v == "":
            return None
        return v

    @model_validator(mode="before")
    @classmethod
    def _aliases(cls, data: Any) -> Any:
        return _normalize_camel_deal_keys(data)


class DealUpdate(BaseModel):
    """PATCH /deals/{id} — только переданные поля."""

    model_config = ConfigDict(extra="ignore")

    version: int | None = Field(
        default=None,
        ge=1,
        description="Ожидаемая версия (альтернатива If-Match).",
    )
    title: str | None = Field(default=None, min_length=1, max_length=500)
    client_id: str | None = Field(default=None, max_length=36)
    contact_id: str | None = Field(default=None, max_length=36)
    contact_name: str | None = Field(default=None, max_length=255)
    amount: Decimal | None = None
    currency: str | None = Field(default=None, max_length=10)
    stage: str | None = Field(default=None, max_length=100)
    funnel_id: str | None = Field(default=None, max_length=36)
    source: str | None = Field(default=None, max_length=50)
    source_chat_id: str | None = Field(default=None, max_length=255)
    tags: list[str] | None = None
    custom_fields: dict[str, Any] | None = None
    lost_reason: str | None = Field(default=None, max_length=10000)
    assignee_id: str | None = Field(default=None, max_length=36)
    notes: str | None = None
    project_id: str | None = Field(default=None, max_length=36)
    comments: list[dict[str, Any]] | None = None
    is_archived: bool | None = None
    recurring: bool | None = None
    number: str | None = Field(default=None, max_length=100)
    status: str | None = Field(default=None, max_length=30)
    description: str | None = None
    date: str | None = Field(default=None, max_length=50)
    due_date: str | None = Field(default=None, max_length=50)
    paid_amount: str | None = Field(default=None, max_length=50)
    paid_date: str | None = Field(default=None, max_length=50)
    start_date: str | None = Field(default=None, max_length=50)
    end_date: str | None = Field(default=None, max_length=50)
    payment_day: str | None = Field(default=None, max_length=10)
    updated_at: str | None = Field(default=None, max_length=50)
    telegram_username: str | None = Field(default=None, max_length=100)
    updated_by_user_id: str | None = Field(default=None, max_length=36)

    @model_validator(mode="before")
    @classmethod
    def _aliases(cls, data: Any) -> Any:
        return _normalize_camel_deal_keys(data)

    @field_validator("assignee_id", "contact_id", mode="before")
    @classmethod
    def _empty_assignee(cls, v: Any) -> Any:
        if v == "":
            return None
        return v


class DealRead(BaseModel):
    """Ответ списка/одной сделки: snake_case (docs/API.md § формат ответов, как TaskRead)."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    version: int = 1
    title: str
    client_id: str | None = None
    contact_id: str | None = None
    contact_name: str | None = None
    amount: float = 0.0
    currency: str = "UZS"
    stage: str
    funnel_id: str | None = None
    source: str | None = None
    source_chat_id: str | None = None
    telegram_chat_id: str | None = None
    telegram_username: str | None = None
    tags: list[str] = Field(default_factory=list)
    custom_fields: dict[str, Any] = Field(default_factory=dict)
    lost_reason: str | None = None
    assignee_id: str | None = None
    created_at: str | None = None
    updated_at: str | None = None
    notes: str | None = None
    project_id: str | None = None
    comments: list[dict[str, Any]] = Field(default_factory=list)
    is_archived: bool = False
    recurring: bool = False
    number: str | None = None
    status: str | None = None
    description: str | None = None
    date: str | None = None
    due_date: str | None = None
    paid_amount: str | float | int | None = None
    paid_date: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    payment_day: int | str | None = None
    client: ClientRead | None = None
    contact: CrmContactRead | None = None


class DealListResponse(PaginatedResponse[DealRead]):
    """GET /deals — пагинация по курсору."""

    pass


class DealBulkItem(BaseModel):
    """Элемент массовой синхронизации PUT /deals (legacy bulk sync)."""

    model_config = ConfigDict(extra="forbid")

    id: str | None = Field(default=None, max_length=36)
    title: str = Field(default="", max_length=500)
    clientId: str | None = Field(default=None, max_length=36)
    contactId: str | None = Field(default=None, max_length=36)
    contactName: str | None = Field(default=None, max_length=255)
    amount: Any = None
    currency: str = Field(default="UZS", max_length=10)
    stage: str = Field(default="new", max_length=100)
    funnelId: str | None = Field(default=None, max_length=36)
    source: str | None = Field(default=None, max_length=50)
    sourceChatId: str | None = Field(default=None, max_length=255)
    telegramChatId: str | None = Field(default=None, max_length=255)
    tags: list[str] | None = None
    customFields: dict[str, Any] | None = None
    telegramUsername: str | None = Field(default=None, max_length=100)
    lostReason: Any = None
    assigneeId: str | None = Field(default=None, max_length=36)
    notes: str | None = None
    projectId: str | None = Field(default=None, max_length=36)
    comments: list[dict[str, Any]] = Field(default_factory=list)
    isArchived: bool = False
    recurring: bool = False
    number: str | None = Field(default=None, max_length=100)
    status: str | None = Field(default=None, max_length=30)
    description: str | None = None
    date: str | None = Field(default=None, max_length=50)
    dueDate: str | None = Field(default=None, max_length=50)
    paidAmount: Any = None
    paidDate: str | None = Field(default=None, max_length=50)
    startDate: str | None = Field(default=None, max_length=50)
    endDate: str | None = Field(default=None, max_length=50)
    paymentDay: Any = None
    createdAt: str | None = None
    updatedAt: str | None = None
    createdByUserId: str | None = Field(default=None, max_length=36)
