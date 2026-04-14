"""
Исходящие запросы к Meta Graph API (Instagram / Messenger от имени страницы).

См. [Send API](https://developers.facebook.com/docs/messenger-platform/reference/send-api):
``POST /{page-id}/messages`` с Page Access Token, тело — ``recipient``, ``messaging_type``, ``message``.
Для ответа в Instagram Direct в пределах окна — ``messaging_type: RESPONSE``.
"""
from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass
from typing import Any

import httpx

from app.services.http_client import async_http_client

log = logging.getLogger("uvicorn.error")

DEFAULT_GRAPH_VERSION = "v21.0"
_DEFAULT_5XX_RETRIES = 3
_BACKOFF_BASE_SEC = 0.6


@dataclass(frozen=True)
class MetaGraphSendResult:
    ok: bool
    http_status: int | None
    data: dict[str, Any] | None = None
    error_message: str | None = None


def _graph_error_message(data: Any, fallback: str) -> str:
    if isinstance(data, dict):
        err = data.get("error")
        if isinstance(err, dict):
            msg = str(err.get("message") or "").strip()
            if msg:
                code = err.get("code")
                return f"{msg}" + (f" (code={code})" if code is not None else "")
    return fallback


async def send_instagram_page_message(
    *,
    page_id: str,
    recipient_psid: str,
    text: str,
    access_token: str,
    graph_version: str = DEFAULT_GRAPH_VERSION,
    timeout_sec: float = 30.0,
    max_5xx_retries: int = _DEFAULT_5XX_RETRIES,
) -> MetaGraphSendResult:
    """
    Отправить текст в Instagram Direct (PSID получателя) от имени страницы.

    - **5xx** и сетевые сбои: повтор с экспоненциальной задержкой (до ``max_5xx_retries`` повторов).
    - **4xx**: без повторов, сразу результат с текстом ошибки из Graph.
    - Ответ **200** с полем ``error`` в JSON трактуется как ошибка запроса (без повторов).
    """
    url = f"https://graph.facebook.com/{graph_version}/{page_id}/messages"
    body: dict[str, Any] = {
        "recipient": {"id": recipient_psid},
        "messaging_type": "RESPONSE",
        "message": {"text": text[:2000]},
    }
    params = {"access_token": access_token}

    for attempt in range(max_5xx_retries + 1):
        try:
            async with async_http_client(timeout=httpx.Timeout(timeout_sec)) as client:
                r = await client.post(url, params=params, json=body)
        except httpx.TimeoutException as exc:
            err = f"meta_timeout:{exc}"
            if attempt < max_5xx_retries:
                delay = _BACKOFF_BASE_SEC * (2**attempt)
                log.warning(
                    "meta_sender: timeout POST /messages page_id=%s attempt=%s retry in %.1fs",
                    page_id,
                    attempt + 1,
                    delay,
                )
                await asyncio.sleep(delay)
                continue
            return MetaGraphSendResult(ok=False, http_status=None, error_message=err)
        except httpx.RequestError as exc:
            err = f"meta_network:{exc}"
            if attempt < max_5xx_retries:
                delay = _BACKOFF_BASE_SEC * (2**attempt)
                log.warning(
                    "meta_sender: network error POST /messages page_id=%s attempt=%s retry in %.1fs: %s",
                    page_id,
                    attempt + 1,
                    delay,
                    exc,
                )
                await asyncio.sleep(delay)
                continue
            return MetaGraphSendResult(ok=False, http_status=None, error_message=err)
        try:
            data = r.json()
        except json.JSONDecodeError:
            data = {"raw": r.text[:500] if r.text else ""}

        if 500 <= r.status_code < 600:
            err_msg = _graph_error_message(data, r.text[:500] if r.text else f"http_{r.status_code}")
            if attempt < max_5xx_retries:
                delay = _BACKOFF_BASE_SEC * (2**attempt)
                log.warning(
                    "meta_sender: HTTP %s POST /messages page_id=%s attempt=%s retry in %.1fs",
                    r.status_code,
                    page_id,
                    attempt + 1,
                    delay,
                )
                await asyncio.sleep(delay)
                continue
            return MetaGraphSendResult(
                ok=False,
                http_status=r.status_code,
                data=data if isinstance(data, dict) else None,
                error_message=err_msg,
            )

        # 4xx и прочее: без ретраев («игнор» в смысле не пытаемся повторить запрос)
        if r.status_code >= 400:
            msg = _graph_error_message(data, r.text[:500] if r.text else f"http_{r.status_code}")
            return MetaGraphSendResult(
                ok=False,
                http_status=r.status_code,
                data=data if isinstance(data, dict) else None,
                error_message=msg,
            )

        if not isinstance(data, dict):
            return MetaGraphSendResult(ok=True, http_status=r.status_code, data={"ok": True})

        if data.get("error"):
            msg = _graph_error_message(data, "graph_error")
            return MetaGraphSendResult(ok=False, http_status=r.status_code, data=data, error_message=msg)

        return MetaGraphSendResult(ok=True, http_status=r.status_code, data=data)
