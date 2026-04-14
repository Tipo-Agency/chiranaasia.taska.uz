"""Минимальные ответы без тела сущности."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class PublicHealthResponse(BaseModel):
    """Публичный GET /health: только факт готовности, без версии и без текста ошибок инфраструктуры."""

    model_config = ConfigDict(extra="forbid")

    status: Literal["ok", "unavailable"]


class SystemPublicHealthResponse(BaseModel):
    """GET {API_PREFIX}/system/health — лёгкий публичный ping (документированный контракт с версией строки API)."""

    model_config = ConfigDict(extra="forbid")

    status: Literal["ok"] = "ok"
    version: str = "1.0"


class OkResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ok: bool = True


class OkWithIdResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ok: bool = True
    id: str = Field(..., min_length=1, max_length=100)


class PresignedUrlResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    url: str
    expiresIn: int


class MessageCreateResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ok: bool = True
    id: str
    deduplicated: bool


class IdOkResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(..., min_length=1, max_length=100)
    ok: bool = True
