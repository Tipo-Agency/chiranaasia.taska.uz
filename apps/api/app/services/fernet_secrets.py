"""Fernet (симметричное шифрование) на базе SECRET_KEY — общий для воронок и др. секретов в БД."""
from __future__ import annotations

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import get_settings


def get_app_fernet() -> Fernet:
    settings = get_settings()
    key = base64.urlsafe_b64encode(hashlib.sha256(settings.SECRET_KEY.encode()).digest())
    return Fernet(key)


def encrypt_secret(plaintext: str) -> str:
    if not plaintext or not str(plaintext).strip():
        return ""
    return get_app_fernet().encrypt(str(plaintext).strip().encode()).decode()


def decrypt_secret(ciphertext: str) -> str:
    return get_app_fernet().decrypt(str(ciphertext).strip().encode()).decode()


def decrypt_secret_or_plaintext(blob: str) -> str:
    """
    Расшифровка Fernet; если токен не Fernet (старые plaintext в JSONB) — вернуть как есть.
    """
    s = str(blob or "").strip()
    if not s:
        return ""
    try:
        return decrypt_secret(s)
    except (InvalidToken, ValueError, TypeError):
        return s
