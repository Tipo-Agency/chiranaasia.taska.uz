"""Идемпотентное восстановление колонок, если миграции когда-то не доехали на сервер."""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql

revision: str = "049_schema_repair"
down_revision: str | None = "048_entity_version_locking"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _cols(bind, table: str) -> set[str] | None:
    try:
        insp = inspect(bind)
        return {c["name"] for c in insp.get_columns(table)}
    except Exception:
        return None


def upgrade() -> None:
    bind = op.get_bind()
    if bind is None:
        return

    version_tables = ("tasks", "clients", "deals", "finance_requests")
    for t in version_tables:
        cols = _cols(bind, t)
        if cols is None:
            continue
        if "version" in cols:
            continue
        op.add_column(
            t,
            sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        )

    ccols = _cols(bind, "clients")
    if ccols is not None and "tags" not in ccols:
        op.add_column(
            "clients",
            sa.Column(
                "tags",
                postgresql.ARRAY(sa.Text()),
                nullable=False,
                server_default=sa.text("ARRAY[]::text[]"),
            ),
        )


def downgrade() -> None:
    # Не откатываем «ремонт» — данные уже могли опираться на колонки.
    pass
