"""Чистые правила без FastAPI/SQLAlchemy в сигнатурах (см. docs/ARCHITECTURE.md, слой domain)."""

from app.domain.deals import DealStageTransitionError, check_deal_stage_transition
from app.domain.finance_requests import (
    ALL_FINANCE_REQUEST_STATUSES,
    INITIAL_STATUSES,
    FinanceRequestStatusError,
    check_finance_request_status_transition,
    normalize_finance_request_status,
)

__all__ = [
    "ALL_FINANCE_REQUEST_STATUSES",
    "INITIAL_STATUSES",
    "DealStageTransitionError",
    "FinanceRequestStatusError",
    "check_deal_stage_transition",
    "check_finance_request_status_transition",
    "normalize_finance_request_status",
]
