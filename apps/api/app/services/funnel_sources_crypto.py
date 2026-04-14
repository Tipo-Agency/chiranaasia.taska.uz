"""
Шифрование чувствительных полей в `sales_funnels.sources` (JSONB).

- При сохранении: plaintext с фронта → Fernet, в БД только `*_encrypted`.
- В ответах API: `_sanitize_sources` в `app.api.routers.funnels` (без секретов и ciphertext).
- При использовании (polling, webhooks, send): `telegram_config_for_runtime`.
"""
from __future__ import annotations

from typing import Any

from app.services.fernet_secrets import decrypt_secret_or_plaintext, encrypt_secret


def encrypt_telegram_channel(d: dict | None) -> dict[str, Any]:
    if not d or not isinstance(d, dict):
        return {}
    out = dict(d)
    if "botToken" in out:
        raw = out.pop("botToken", None)
        if raw is not None:
            bt = str(raw).strip()
            if bt:
                out["token_encrypted"] = encrypt_secret(bt)
            else:
                out.pop("token_encrypted", None)
    if "webhookSecret" in out:
        raw = out.pop("webhookSecret", None)
        if raw is not None:
            ws = str(raw).strip()
            if ws:
                out["webhook_secret_encrypted"] = encrypt_secret(ws)
            else:
                out.pop("webhook_secret_encrypted", None)
    out.pop("botToken", None)
    out.pop("webhookSecret", None)
    return out


def encrypt_instagram_channel(d: dict | None) -> dict[str, Any]:
    if not d or not isinstance(d, dict):
        return {}
    out = dict(d)
    if "accessToken" in out:
        raw = out.pop("accessToken", None)
        if raw is not None:
            at = str(raw).strip()
            if at:
                out["access_token_encrypted"] = encrypt_secret(at)
            else:
                out.pop("access_token_encrypted", None)
    out.pop("accessToken", None)
    return out


def encrypt_site_channel(d: dict | None) -> dict[str, Any]:
    """Ключ сайта хранится в site_integration_keys; из sources убираем случайный plaintext."""
    if not d or not isinstance(d, dict):
        return {}
    out = dict(d)
    for k in ("apiKey", "api_key", "plaintextKey", "api_key_encrypted"):
        out.pop(k, None)
    return out


def encrypt_funnel_sources_for_storage(sources: dict | None) -> dict[str, Any]:
    if not sources or not isinstance(sources, dict):
        return {}
    out = dict(sources)
    if isinstance(out.get("telegram"), dict):
        out["telegram"] = encrypt_telegram_channel(out["telegram"])
    if isinstance(out.get("instagram"), dict):
        out["instagram"] = encrypt_instagram_channel(out["instagram"])
    if isinstance(out.get("site"), dict):
        out["site"] = encrypt_site_channel(out["site"])
    return out


def decrypt_telegram_channel(d: dict | None) -> dict[str, Any]:
    """Внутреннее использование: добавляет botToken / webhookSecret в plaintext."""
    if not d or not isinstance(d, dict):
        return {}
    out = dict(d)
    te = out.get("token_encrypted")
    if te:
        out["botToken"] = decrypt_secret_or_plaintext(str(te))
    else:
        out["botToken"] = str(out.get("botToken") or "").strip()
    ws = out.get("webhook_secret_encrypted")
    if ws:
        out["webhookSecret"] = decrypt_secret_or_plaintext(str(ws))
    else:
        out["webhookSecret"] = str(out.get("webhookSecret") or "").strip()
    return out


def telegram_config_for_runtime(raw: dict | None) -> dict[str, Any] | None:
    """Конфиг Telegram воронки для сервера: расшифровка + без полей *_encrypted."""
    if not raw or not isinstance(raw, dict):
        return None
    c = decrypt_telegram_channel(raw)
    c.pop("token_encrypted", None)
    c.pop("webhook_secret_encrypted", None)
    return c


def telegram_webhook_secret_configured_raw(raw: dict | None) -> bool:
    """Проверка «секрет вебхука задан» без расшифровки (для статуса API)."""
    if not raw or not isinstance(raw, dict):
        return False
    return bool(
        str(raw.get("webhook_secret_encrypted") or "").strip()
        or str(raw.get("webhookSecret") or "").strip()
    )
