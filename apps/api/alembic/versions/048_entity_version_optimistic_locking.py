"""Optimistic locking: колонка version для tasks, clients, deals, finance_requests."""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "048_entity_version_optimistic_locking"
down_revision: Union[str, None] = "047_tasks_employees_list_indexes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("tasks", sa.Column("version", sa.Integer(), nullable=False, server_default="1"))
    op.add_column("clients", sa.Column("version", sa.Integer(), nullable=False, server_default="1"))
    op.add_column("deals", sa.Column("version", sa.Integer(), nullable=False, server_default="1"))
    op.add_column("finance_requests", sa.Column("version", sa.Integer(), nullable=False, server_default="1"))


def downgrade() -> None:
    op.drop_column("finance_requests", "version")
    op.drop_column("deals", "version")
    op.drop_column("clients", "version")
    op.drop_column("tasks", "version")
