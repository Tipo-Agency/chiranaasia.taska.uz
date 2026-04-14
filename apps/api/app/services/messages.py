"""
Единая отправка исходящих ответов клиенту по сделке (Telegram Bot API, Instagram Graph).

Роутеры только проверяют права и мапят SendMessageResult → HTTP.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.models.client import Deal
from app.models.funnel import SalesFunnel
from app.services.http_client import async_http_client
from app.services.meta_instagram import parse_thread_key, send_instagram_text
from app.services.meta_sender import MetaGraphSendResult
from app.services.telegram_leads import telegram_source_config


@dataclass
class SendMessageResult:
    success: bool
    deal: Deal | None = None
    status_code: int = 200
    detail: str = ""


def _now_iso() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def _meta_send_http_status(res: MetaGraphSendResult) -> int:
    """4xx Graph — клиентская ошибка (без ретраев в sender); 5xx/сеть — после исчерпания ретраев."""
    if res.error_message == "no_page_access_token":
        return 400
    if res.http_status is None:
        return 502
    if res.http_status >= 500:
        return 502
    return 400


def append_deal_outbound_comment(
    deal: Deal,
    *,
    text: str,
    author_user_id: str,
    comment_type: str,
    id_prefix: str,
) -> None:
    """Добавить запись в deal.comments и обновить updated_at (после успешной отправки в канал)."""
    now = _now_iso()
    comments = list(deal.comments or [])
    comments.append(
        {
            "id": f"{id_prefix}-{int(datetime.now(UTC).timestamp() * 1000)}",
            "text": text,
            "authorId": author_user_id,
            "createdAt": now,
            "type": comment_type,
        }
    )
    deal.comments = comments
    deal.updated_at = now


async def telegram_bot_send_message(token: str, chat_id: str, text: str) -> tuple[bool, str]:
    """POST sendMessage; возвращает (ok, error_description)."""
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    async with async_http_client(timeout=httpx.Timeout(35.0)) as client:
        r = await client.post(url, data={"chat_id": chat_id, "text": text[:4000]})
    try:
        data: Any = r.json()
    except Exception:
        data = {"ok": False, "description": r.text[:500]}
    if r.status_code >= 400 or not (isinstance(data, dict) and data.get("ok") is True):
        err = data.get("description") if isinstance(data, dict) else str(data)
        return False, str(err)
    return True, ""


async def _send_telegram_deal_reply(
    db: AsyncSession,
    deal: Deal,
    text: str,
    author_user_id: str,
) -> SendMessageResult:
    if str(deal.source or "") != "telegram":
        return SendMessageResult(False, deal, 400, "deal_not_telegram")

    chat_id = str(deal.source_chat_id or "").strip()
    if not chat_id:
        return SendMessageResult(False, deal, 400, "no_telegram_chat_id")

    funnel = await db.get(SalesFunnel, deal.funnel_id) if deal.funnel_id else None
    if not funnel:
        return SendMessageResult(False, deal, 400, "no_funnel")

    cfg = telegram_source_config(funnel)
    if not cfg or cfg.get("enabled") is not True:
        return SendMessageResult(False, deal, 400, "telegram_disabled_for_funnel")

    token = str(cfg.get("botToken") or "").strip()
    if not token:
        return SendMessageResult(False, deal, 400, "no_bot_token")

    ok, err = await telegram_bot_send_message(token, chat_id, text)
    if not ok:
        return SendMessageResult(False, deal, 502, f"telegram_send_failed:{err}")

    append_deal_outbound_comment(
        deal,
        text=text,
        author_user_id=author_user_id,
        comment_type="telegram_out",
        id_prefix="tg-out",
    )
    return SendMessageResult(True, deal)


async def _send_instagram_deal_reply(
    deal: Deal,
    text: str,
    author_user_id: str,
    settings: Settings,
) -> SendMessageResult:
    if str(deal.source or "") != "instagram":
        return SendMessageResult(False, deal, 400, "deal_not_instagram")

    parsed = parse_thread_key(deal.source_chat_id or "")
    if not parsed:
        return SendMessageResult(False, deal, 400, "no_instagram_thread")

    page_id, recipient_psid = parsed
    ig_res = await send_instagram_text(page_id, recipient_psid, text, settings)
    if not ig_res.ok:
        return SendMessageResult(
            False,
            deal,
            _meta_send_http_status(ig_res),
            ig_res.error_message or "instagram_send_failed",
        )

    append_deal_outbound_comment(
        deal,
        text=text,
        author_user_id=author_user_id,
        comment_type="instagram_out",
        id_prefix="ig-out",
    )
    return SendMessageResult(True, deal)


async def send_message(
    db: AsyncSession,
    *,
    deal_id: str,
    text: str,
    author_user_id: str,
    settings: Settings | None = None,
) -> SendMessageResult:
    """
    Отправить текст клиенту по каналу сделки (telegram | instagram).

    Мутирует deal; commit выполняет вызывающий код.
    """
    settings = settings or get_settings()
    raw_id = (deal_id or "").strip()
    body = (text or "").strip()
    if not raw_id or not body:
        return SendMessageResult(False, None, 400, "dealId_and_text_required")

    deal = await db.get(Deal, raw_id)
    if not deal or deal.is_archived:
        return SendMessageResult(False, None, 404, "deal_not_found")

    source = str(deal.source or "")
    if source == "telegram":
        return await _send_telegram_deal_reply(db, deal, body, author_user_id)
    if source == "instagram":
        return await _send_instagram_deal_reply(deal, body, author_user_id, settings)

    return SendMessageResult(False, deal, 400, "unsupported_deal_source")
