"""Проверка запрета встреч в прошлом."""

from __future__ import annotations

from datetime import datetime, timedelta

import pytest
from fastapi import HTTPException

from app.services.meeting_validation import (
    assert_meeting_start_not_in_past,
    meeting_wall_start_unchanged,
)


def test_meeting_wall_start_unchanged_true():
    assert meeting_wall_start_unchanged("2026-06-01", "10:00", "2026-06-01", "10:00") is True


def test_meeting_wall_start_unchanged_false():
    assert meeting_wall_start_unchanged("2026-06-01", "10:00", "2026-06-01", "11:00") is False


def test_far_past_raises():
    with pytest.raises(HTTPException) as ei:
        assert_meeting_start_not_in_past("2000-01-01", "12:00")
    assert ei.value.status_code == 422


def test_tomorrow_ok():
    future = (datetime.now() + timedelta(days=1)).date().isoformat()
    assert_meeting_start_not_in_past(future, "12:00")
