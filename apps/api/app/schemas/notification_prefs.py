"""Тело PUT /notification-prefs: только известные ключи верхнего уровня (остальное — ошибка)."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field, RootModel


class NotificationPrefsGetResponse(RootModel[dict[str, Any]]):
    """GET /notification-prefs — полный объект настроек (произвольные ключи)."""


class NotificationPrefsPut(BaseModel):
    """Значения секций — произвольные JSON-объекты; лишние ключи верхнего уровня запрещены."""

    model_config = ConfigDict(extra="forbid")

    id: str | None = Field(default=None, max_length=100)
    defaultFunnelId: str | None = Field(default=None, max_length=100)
    telegramGroupChatId: str | None = Field(default=None, max_length=255)
    telegramChatId: str | None = Field(default=None, max_length=255)
    channels: dict[str, Any] | None = None
    quietHours: dict[str, Any] | None = None
    types: dict[str, Any] | None = None
    newTask: dict[str, Any] | None = None
    statusChange: dict[str, Any] | None = None
    taskAssigned: dict[str, Any] | None = None
    taskComment: dict[str, Any] | None = None
    taskDeadline: dict[str, Any] | None = None
    docCreated: dict[str, Any] | None = None
    docUpdated: dict[str, Any] | None = None
    docShared: dict[str, Any] | None = None
    meetingCreated: dict[str, Any] | None = None
    meetingReminder: dict[str, Any] | None = None
    meetingUpdated: dict[str, Any] | None = None
    postCreated: dict[str, Any] | None = None
    postStatusChanged: dict[str, Any] | None = None
    purchaseRequestCreated: dict[str, Any] | None = None
    purchaseRequestStatusChanged: dict[str, Any] | None = None
    financePlanUpdated: dict[str, Any] | None = None
    dealCreated: dict[str, Any] | None = None
    dealStatusChanged: dict[str, Any] | None = None
    clientCreated: dict[str, Any] | None = None
    contractCreated: dict[str, Any] | None = None
    employeeCreated: dict[str, Any] | None = None
    employeeUpdated: dict[str, Any] | None = None
    processStarted: dict[str, Any] | None = None
    processStepCompleted: dict[str, Any] | None = None
    processStepRequiresApproval: dict[str, Any] | None = None
