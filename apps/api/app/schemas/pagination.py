"""Общая обёртка пагинации по курсору (как GET /tasks, /clients, /deals)."""
from __future__ import annotations

from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    """Стандартный ответ списка: элементы + total + limit + next_cursor."""

    model_config = ConfigDict(from_attributes=False)

    items: list[T]
    total: int
    limit: int
    next_cursor: str | None = None
