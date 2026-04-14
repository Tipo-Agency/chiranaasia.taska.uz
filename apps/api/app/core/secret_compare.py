"""Сравнение секретов без утечки по времени (для вебхуков с переменной длиной строк)."""

from __future__ import annotations

import hashlib
import hmac
import secrets


def compare_string_secrets(a: str | None, b: str | None) -> bool:
    """
    Равенство двух строк в условиях, близких к constant-time по результату:
    сравниваются SHA-256 digest (32 байта) через secrets.compare_digest.
    Подходит для verify_token Meta, Telegram secret_token, длинных API-ключей в открытом виде.
    """
    da = hashlib.sha256((a or "").encode("utf-8")).digest()
    db = hashlib.sha256((b or "").encode("utf-8")).digest()
    return secrets.compare_digest(da, db)


def compare_hex_hmac_sha256(expected_mac_hex: str, message: bytes, secret: str) -> bool:
    """
    HMAC-SHA256(message, secret) в hex, сравнение с expected_mac_hex — только hmac.compare_digest.
    expected_mac_hex должен быть нормализован (длина 64, lower).
    """
    try:
        want = bytes.fromhex(expected_mac_hex)
    except ValueError:
        return False
    mac = hmac.new(secret.encode("utf-8"), message, hashlib.sha256).digest()
    if len(want) != len(mac):
        return False
    return hmac.compare_digest(mac, want)
