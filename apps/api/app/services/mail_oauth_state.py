"""Подпись state для OAuth (redirect Google → callback без сессии в query)."""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from typing import Any

from app.core.config import get_settings


def _b64e(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def _b64d(s: str) -> bytes:
    pad = 4 - len(s) % 4
    if pad != 4:
        s = s + ("=" * pad)
    return base64.urlsafe_b64decode(s.encode())


def create_mail_oauth_state(user_id: str) -> str:
    """State для Google OAuth: user_id + TTL 15 минут, HMAC-SHA256."""
    payload: dict[str, Any] = {
        "u": (user_id or "").strip()[:36],
        "exp": int(time.time()) + 900,
    }
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    key = get_settings().SECRET_KEY.encode()
    sig = hmac.new(key, raw, hashlib.sha256).digest()
    return _b64e(raw) + "." + _b64e(sig)


def parse_mail_oauth_state(state: str) -> str | None:
    """Верификация HMAC; возвращает user_id или None."""
    s = (state or "").strip()
    if "." not in s:
        return None
    try:
        a, b = s.split(".", 1)
        raw = _b64d(a)
        sig = _b64d(b)
        key = get_settings().SECRET_KEY.encode()
        expected = hmac.new(key, raw, hashlib.sha256).digest()
        if not hmac.compare_digest(sig, expected):
            return None
        p = json.loads(raw.decode())
        if int(p.get("exp", 0)) < time.time():
            return None
        uid = str(p.get("u") or "").strip()[:36]
        return uid or None
    except Exception:
        return None
