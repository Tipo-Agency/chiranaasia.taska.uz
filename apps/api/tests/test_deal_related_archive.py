"""Логика каскадной архивации при удалении сделки."""

from __future__ import annotations

from unittest.mock import MagicMock

from app.services.deal_related_archive import deal_just_archived


def test_deal_just_archived_true_when_became_archived() -> None:
    existing = MagicMock()
    existing.is_archived = False
    row = MagicMock()
    row.is_archived = True
    assert deal_just_archived(existing=existing, row=row) is True


def test_deal_just_archived_false_when_already_archived() -> None:
    existing = MagicMock()
    existing.is_archived = True
    row = MagicMock()
    row.is_archived = True
    assert deal_just_archived(existing=existing, row=row) is False


def test_deal_just_archived_false_when_new_row_archived() -> None:
    row = MagicMock()
    row.is_archived = True
    assert deal_just_archived(existing=None, row=row) is False


def test_deal_just_archived_false_when_not_archived() -> None:
    existing = MagicMock()
    existing.is_archived = False
    row = MagicMock()
    row.is_archived = False
    assert deal_just_archived(existing=existing, row=row) is False
