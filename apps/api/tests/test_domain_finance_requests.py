"""Юнит-тесты статусов finance_requests (без БД)."""

from __future__ import annotations

import pytest

from app.domain.finance_requests import FinanceRequestStatusError, check_finance_request_status_transition


def test_new_row_invalid_initial() -> None:
    with pytest.raises(FinanceRequestStatusError) as ei:
        check_finance_request_status_transition(old_status=None, new_status="paid", is_new_row=True)
    assert ei.value.status_code == 400


def test_transition_draft_to_pending() -> None:
    check_finance_request_status_transition(old_status="draft", new_status="pending", is_new_row=False)


def test_invalid_jump() -> None:
    with pytest.raises(FinanceRequestStatusError) as ei:
        check_finance_request_status_transition(old_status="draft", new_status="paid", is_new_row=False)
    assert ei.value.status_code == 400
