"""Единое логирование отказов публичных вебхуков (без секретов в логах)."""

from __future__ import annotations

import logging

log = logging.getLogger("webhook.security")


def client_ip_for_log(client) -> str:
    if client is None:
        return "-"
    return client.host or "-"


def log_webhook_rejection(
    *,
    endpoint: str,
    reason: str,
    client_ip: str | None = None,
    detail: str = "",
) -> None:
    extra = f" detail={detail}" if detail else ""
    log.warning(
        "webhook rejected endpoint=%s reason=%s client_ip=%s%s",
        endpoint,
        reason,
        client_ip or "-",
        extra,
    )
