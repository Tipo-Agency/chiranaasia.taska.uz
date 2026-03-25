"""Новые заявки и поздравления в группу — асинхронно."""
from __future__ import annotations

import logging
from typing import List, Tuple

from telegram.ext import ContextTypes

from taska_bot.api.client import ApiClient

logger = logging.getLogger(__name__)
from taska_bot.domain.formatting import format_successful_deal


def _parse_group_state(prefs: dict) -> Tuple[str | None, str, List[str]]:
    chat_id = prefs.get("telegramGroupChatId")
    last_at = prefs.get("lastDealSentAt") or "1970-01-01T00:00:00"
    congratulated = list(prefs.get("congratulatedDealIds") or [])
    return chat_id, last_at, congratulated


async def run_deal_notifications(context: ContextTypes.DEFAULT_TYPE) -> None:
    api: ApiClient = context.application.bot_data["api"]
    prefs = await api.get_notification_prefs("default") or {}
    chat_id, last_deal_sent_at, congratulated_ids = _parse_group_state(prefs)
    if not chat_id:
        return

    deals = [d for d in await api.get_deals() if not d.get("isArchived")]
    funnels = {f["id"]: f.get("name", f.get("id", "Воронка")) for f in await api.get_funnels()}
    clients_map = {c["id"]: c for c in await api.get_clients()}
    users_list = await api.get_users()

    new_deals = [d for d in deals if (d.get("createdAt") or "") > last_deal_sent_at]
    new_deals.sort(key=lambda d: d.get("createdAt") or "")
    for deal in new_deals:
        funnel_name = funnels.get(deal.get("funnelId"), deal.get("funnelId") or "—")
        title = deal.get("title") or deal.get("contactName") or "Без названия"
        client_name = ""
        if deal.get("clientId") and deal["clientId"] in clients_map:
            c = clients_map[deal["clientId"]]
            client_name = c.get("name") or c.get("companyName") or ""
        elif deal.get("contactName"):
            client_name = deal.get("contactName") or ""
        msg = f"🆕 <b>Новая заявка</b> [<b>{funnel_name}</b>]\n\n{title}"
        if client_name:
            msg += f"\nКлиент: {client_name}"
        try:
            await context.bot.send_message(chat_id=chat_id, text=msg, parse_mode="HTML")
        except Exception as e:
            logger.warning("deal_new: %s", e)
        last_deal_sent_at = max(last_deal_sent_at, (deal.get("createdAt") or ""))

    won_statuses = ("completed", "paid", "active")
    for deal in deals:
        if deal.get("id") in congratulated_ids:
            continue
        status = (deal.get("status") or "").lower()
        stage = (deal.get("stage") or "").lower()
        if status not in won_statuses and stage != "won":
            continue
        congratulated_ids.append(deal.get("id"))
        client = None
        if deal.get("clientId"):
            client = clients_map.get(deal["clientId"])
        user = None
        if deal.get("assigneeId"):
            user = next((u for u in users_list if u.get("id") == deal.get("assigneeId")), None)
        text = format_successful_deal(deal, client, user)
        try:
            await context.bot.send_message(chat_id=chat_id, text=text, parse_mode="HTML")
        except Exception as e:
            logger.warning("deal_congrats: %s", e)

    prefs = await api.get_notification_prefs("default") or {}
    prefs["lastDealSentAt"] = last_deal_sent_at
    prefs["congratulatedDealIds"] = congratulated_ids[-50:]
    await api.put_notification_prefs(prefs, "default")
