"""Watermark for group broadcast (recipientId=None) messages."""
from __future__ import annotations

import json
import os
from pathlib import Path


def _path() -> Path:
    base = Path(__file__).resolve().parents[1] / "data"
    base.mkdir(parents=True, exist_ok=True)
    return base / "group_broadcast_watermark.json"


def load_group_broadcast_watermark() -> str:
    p = _path()
    if not p.exists():
        return ""
    try:
        raw = json.loads(p.read_text(encoding="utf-8") or "{}")
        if isinstance(raw, dict):
            return str(raw.get("createdAt") or "")
        if isinstance(raw, str):
            return raw
    except Exception:
        return ""
    return ""


def save_group_broadcast_watermark(created_at: str) -> None:
    p = _path()
    p.write_text(json.dumps({"createdAt": created_at}, ensure_ascii=False, indent=2), encoding="utf-8")

