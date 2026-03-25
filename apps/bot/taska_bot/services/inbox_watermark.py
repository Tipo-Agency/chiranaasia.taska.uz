"""Водяной знак по входящим чат-сообщениям CRM: не дублировать старые при рестарте."""
from __future__ import annotations

import json
from pathlib import Path

_WATERMARK_PATH = Path(__file__).resolve().parent.parent / "data" / "inbox_watermark.json"


def load_watermarks() -> dict[str, str]:
    try:
        if not _WATERMARK_PATH.is_file():
            return {}
        raw = json.loads(_WATERMARK_PATH.read_text(encoding="utf-8"))
        return raw if isinstance(raw, dict) else {}
    except Exception:
        return {}


def save_watermarks(data: dict[str, str]) -> None:
    _WATERMARK_PATH.parent.mkdir(parents=True, exist_ok=True)
    _WATERMARK_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=0), encoding="utf-8")
