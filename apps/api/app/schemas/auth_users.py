"""Pydantic-схемы для bulk PUT /auth/users."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class AuthUserOut(BaseModel):
    """Пользователь в JSON (как row_to_user) для /auth/me, /auth/login, списков."""

    model_config = ConfigDict(extra="ignore")

    id: str
    name: str | None = None
    roleId: str | None = None
    avatar: str | None = None
    login: str | None = None
    email: str | None = None
    phone: str | None = None
    telegram: str | None = None
    telegramUserId: str | None = None
    isArchived: bool | None = None
    mustChangePassword: bool | None = None
    roleSlug: str | None = None
    roleName: str | None = None
    permissions: list[Any] = Field(default_factory=list)
    role: str | None = None
    calendarExportToken: str | None = None
    calendarExportUrl: str | None = None


class UserBulkItem(BaseModel):
    """Тело PUT /auth/users: допускаем поля ответа GET (roleSlug, permissions, …) — игнорируем лишнее."""
    model_config = ConfigDict(extra="ignore")

    id: str | None = Field(default=None, max_length=36)
    name: str | None = Field(default=None, max_length=255)
    login: str | None = Field(default=None, max_length=255)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    telegram: str | None = Field(default=None, max_length=100)
    telegramUserId: str | None = Field(default=None, max_length=100)
    roleId: str | None = Field(default=None, max_length=36)
    role: str | None = Field(default=None, max_length=50)
    avatar: str | None = None
    password: str | None = None
    mustChangePassword: bool = False
    isArchived: bool = False
