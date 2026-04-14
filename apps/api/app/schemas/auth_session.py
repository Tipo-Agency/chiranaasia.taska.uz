"""Ответы login/refresh: только поле user; access/refresh — только HttpOnly cookies."""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict

from app.schemas.auth_users import AuthUserOut


class AuthSessionResponse(BaseModel):
    """Set-Cookie: access_token / refresh_token (HttpOnly), csrf_token (читается JS на мутирующих запросах)."""

    model_config = ConfigDict(extra="forbid")

    user: AuthUserOut
