"""Допустимые переходы статусов заявок на оплату (finance_requests)."""

from __future__ import annotations

from fastapi import HTTPException

from app.domain.finance_requests import (
    ALL_FINANCE_REQUEST_STATUSES,
    INITIAL_STATUSES,
    FinanceRequestStatusError,
    check_finance_request_status_transition,
    normalize_finance_request_status,
)

# Обратная совместимость имён
ALL_STATUSES = ALL_FINANCE_REQUEST_STATUSES


def normalize_status(raw: str | None) -> str:
    return normalize_finance_request_status(raw)


def assert_finance_request_status_transition(
    *,
    old_status: str | None,
    new_status: str,
    is_new_row: bool,
) -> None:
    try:
        check_finance_request_status_transition(
            old_status=old_status,
            new_status=new_status,
            is_new_row=is_new_row,
        )
    except FinanceRequestStatusError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail) from e
