"""Юнит-тесты доменных правил сделок (без БД)."""

from __future__ import annotations

import pytest

from app.domain.deals import DealStageTransitionError, check_deal_stage_transition


def test_same_stage_noop() -> None:
    check_deal_stage_transition(
        from_stage="lead",
        to_stage="lead",
        lost_reason_effective=None,
        is_admin=False,
    )


def test_lost_requires_reason() -> None:
    with pytest.raises(DealStageTransitionError) as ei:
        check_deal_stage_transition(
            from_stage="lead",
            to_stage="lost",
            lost_reason_effective="  ",
            is_admin=False,
        )
    assert ei.value.status_code == 422


def test_won_locked_for_non_admin() -> None:
    with pytest.raises(DealStageTransitionError) as ei:
        check_deal_stage_transition(
            from_stage="won",
            to_stage="lead",
            lost_reason_effective=None,
            is_admin=False,
        )
    assert ei.value.status_code == 403


def test_won_admin_may_move() -> None:
    check_deal_stage_transition(
        from_stage="won",
        to_stage="lead",
        lost_reason_effective=None,
        is_admin=True,
    )
