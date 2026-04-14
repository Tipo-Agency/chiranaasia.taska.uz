"""Допустимые переходы статусов заявок на оплату (без HTTP)."""
from __future__ import annotations

ALL_FINANCE_REQUEST_STATUSES = frozenset({"draft", "pending", "approved", "rejected", "paid"})

INITIAL_STATUSES = frozenset({"draft", "pending"})

_ALLOWED_FROM: dict[str, frozenset[str]] = {
    "draft": frozenset({"pending"}),
    "pending": frozenset({"approved", "rejected"}),
    "approved": frozenset({"paid"}),
    "rejected": frozenset(),
    "paid": frozenset(),
}


class FinanceRequestStatusError(Exception):
    def __init__(self, *, status_code: int, detail: str) -> None:
        self.status_code = status_code
        self.detail = detail
        super().__init__(detail)


def normalize_finance_request_status(raw: str | None) -> str:
    s = (raw or "").strip().lower()
    if s == "deferred":
        return "draft"
    return s if s in ALL_FINANCE_REQUEST_STATUSES else "draft"


def check_finance_request_status_transition(
    *,
    old_status: str | None,
    new_status: str,
    is_new_row: bool,
) -> None:
    new_s = normalize_finance_request_status(new_status)
    if new_s not in ALL_FINANCE_REQUEST_STATUSES:
        raise FinanceRequestStatusError(status_code=400, detail="finance_request_invalid_status")
    if is_new_row:
        if new_s not in INITIAL_STATUSES:
            raise FinanceRequestStatusError(
                status_code=400,
                detail="finance_request_invalid_initial_status",
            )
        return
    old_s = normalize_finance_request_status(old_status)
    if old_s == new_s:
        return
    allowed = _ALLOWED_FROM.get(old_s, frozenset())
    if new_s not in allowed:
        raise FinanceRequestStatusError(
            status_code=400,
            detail="finance_request_invalid_status_transition",
        )
