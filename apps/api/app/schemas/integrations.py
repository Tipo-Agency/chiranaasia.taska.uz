"""Тела запросов для роутеров integrations/* (валидация входящего JSON)."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


class IntegrationDealSendBody(BaseModel):
    """POST …/send и Instagram: ответ клиенту в мессенджере."""

    model_config = ConfigDict(extra="forbid")

    dealId: str = Field(..., min_length=1, max_length=36)
    text: str = Field(..., min_length=1, max_length=100_000)

    @field_validator("dealId", "text", mode="before")
    @classmethod
    def _strip(cls, v: object) -> object:
        if v is None:
            return ""
        return str(v).strip()


class FunnelIdBody(BaseModel):
    """Операции с воронкой по идентификатору (camelCase как во фронте)."""

    model_config = ConfigDict(extra="forbid")

    funnelId: str = Field(..., min_length=1, max_length=36)

    @field_validator("funnelId", mode="before")
    @classmethod
    def _strip_funnel(cls, v: object) -> object:
        if v is None:
            return ""
        return str(v).strip()


class TelegramPersonalSendCodeBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    phone: str = Field(..., min_length=5, max_length=32)

    @field_validator("phone", mode="before")
    @classmethod
    def _strip_phone(cls, v: object) -> object:
        if v is None:
            return ""
        return str(v).strip()


class TelegramPersonalSignInBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    phone: str = Field(..., min_length=5, max_length=32)
    code: str = Field(..., min_length=1, max_length=32)

    @field_validator("phone", "code", mode="before")
    @classmethod
    def _strip(cls, v: object) -> object:
        if v is None:
            return ""
        return str(v).strip()


class TelegramPersonalPasswordBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    password: str = Field(..., min_length=1, max_length=256)

    @field_validator("password", mode="before")
    @classmethod
    def _strip_pw(cls, v: object) -> object:
        if v is None:
            return ""
        return str(v).strip()


class TelegramPersonalSyncMessagesBody(BaseModel):
    """POST …/sync-messages — тело опционально; limit по умолчанию задаёт роутер."""

    model_config = ConfigDict(extra="forbid")

    limit: int | None = Field(default=None, ge=1, le=10_000)


class TelegramPersonalDealSendBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str = Field(..., min_length=1, max_length=100_000)

    @field_validator("text", mode="before")
    @classmethod
    def _strip_text(cls, v: object) -> object:
        if v is None:
            return ""
        return str(v).strip()


class SiteLeadUtm(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source: str | None = None
    medium: str | None = None
    campaign: str | None = None
    term: str | None = None
    content: str | None = None

    @field_validator("source", "medium", "campaign", "term", "content", mode="before")
    @classmethod
    def _strip_opt(cls, v: object) -> object:
        if v is None:
            return None
        s = str(v).strip()
        return s if s else None


class SiteLeadPayload(BaseModel):
    """Публичный intake POST /integrations/site/leads."""

    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, max_length=255)
    contactName: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=64)
    email: str | None = Field(default=None, max_length=255)
    message: str | None = Field(default=None, max_length=10_000)
    notes: str | None = Field(default=None, max_length=10_000)
    title: str | None = Field(default=None, max_length=500)
    utm: SiteLeadUtm | None = None
    metadata: dict[str, Any] | None = None

    @field_validator(
        "name",
        "contactName",
        "phone",
        "email",
        "message",
        "notes",
        "title",
        mode="before",
    )
    @classmethod
    def _strip_strings(cls, v: object) -> object:
        if v is None:
            return None
        return str(v).strip()


# --- Ответы API (camelCase сделки как в row_to_deal) ---


class IntegrationMessagingOk(BaseModel):
    """Успех отправки без тела сделки в ответе."""

    model_config = ConfigDict(extra="forbid")

    ok: bool = True


class DealCamelRead(BaseModel):
    """Сделка в формате row_to_deal (интеграции мессенджеров)."""

    model_config = ConfigDict(extra="ignore")

    id: str
    title: str | None = None
    clientId: str | None = None
    contactName: str | None = None
    amount: float = 0.0
    currency: str | None = None
    stage: str | None = None
    funnelId: str | None = None
    source: str | None = None
    sourceChatId: str | None = None
    telegramChatId: str | None = None
    telegramUsername: str | None = None
    tags: list[str] = Field(default_factory=list)
    customFields: dict[str, Any] = Field(default_factory=dict)
    lostReason: str | None = None
    assigneeId: str | None = None
    createdAt: str | None = None
    notes: str | None = None
    projectId: str | None = None
    comments: list[Any] = Field(default_factory=list)
    isArchived: bool = False
    recurring: bool = False
    number: str | None = None
    status: str | None = None
    description: str | None = None
    date: str | None = None
    dueDate: str | None = None
    paidAmount: Any = None
    paidDate: str | None = None
    startDate: str | None = None
    endDate: str | None = None
    paymentDay: Any = None
    updatedAt: str | None = None


class SiteKeyRotateResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ok: bool = True
    funnelId: str
    apiKey: str
    keyLast4: str


class SiteKeyStatusResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ok: bool = True
    funnelId: str
    active: bool
    keyLast4: str | None = None


class SiteLeadIntakeResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ok: bool = True
    duplicate: bool
    dealId: str
    funnelId: str
    stage: str


class TelegramWebhookAckResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ok: bool = True
    processed: int


class TelegramWebhookRegisterResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ok: bool = True
    webhookUrl: str
    webhookRegistered: bool = True


class TelegramWebhookUnregisterResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ok: bool = True
    webhookRegistered: bool = False


class TelegramWebhookStatusResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ok: bool = True
    funnelId: str
    webhookUrl: str = ""
    webhookRegistered: bool = False
    useWebhook: bool = False
    webhookSecretSet: bool = False


class TelegramPersonalStatusResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    connected: bool
    status: str
    phoneMasked: str | None = None
    apiConfigured: bool


class TelegramPersonalSendCodeResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ok: bool = True
    phoneMasked: str | None = None


class TelegramPersonalSignInResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ok: bool = True
    needPassword: bool = False


class TelegramPersonalSyncQueuedResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ok: bool = True
    queued: bool = True
    dealId: str
    streamId: str
