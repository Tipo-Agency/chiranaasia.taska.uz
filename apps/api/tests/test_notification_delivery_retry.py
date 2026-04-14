"""Контракт ретраев доставки уведомлений (backoff, MAX_ATTEMPTS)."""

import pytest

from app.services.notification_delivery import MAX_ATTEMPTS, _backoff_seconds_for_retry


def test_max_attempts_is_five() -> None:
    assert MAX_ATTEMPTS == 5


@pytest.mark.parametrize(
    ("attempts_after_error", "expected_seconds"),
    [
        (1, 60),
        (2, 300),
        (3, 900),
        (4, 3600),
    ],
)
def test_backoff_after_error(attempts_after_error: int, expected_seconds: int) -> None:
    assert _backoff_seconds_for_retry(attempts_after_error) == expected_seconds


def test_backoff_clamps_to_last_tier_for_high_attempts() -> None:
    """Защита от некорректного вызова: не ниже последнего интервала."""
    assert _backoff_seconds_for_retry(10) == 3600
