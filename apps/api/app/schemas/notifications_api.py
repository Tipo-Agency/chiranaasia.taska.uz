"""Ответы роутера /notifications (не путать с notification_events)."""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class NotificationRowRead(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    id: str
    userId: str
    type: str
    title: str
    body: str | None = None
    entityType: str | None = None
    entityId: str | None = None
    isRead: bool = False
    createdAt: str | None = None


class NotificationUnreadCountResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    userId: str
    unreadCount: int


class NotificationMarkReadResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ok: bool
    error: str | None = None


class NotificationDeliveriesRunResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ok: bool = True
    queued: int


class NotificationRetentionRunResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ok: bool = True
    days: int
    archived_notifications: int
    deleted_events: int
    deleted_deliveries: int
