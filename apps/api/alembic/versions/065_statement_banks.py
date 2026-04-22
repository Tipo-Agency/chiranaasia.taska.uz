"""Выписки: код банка; настройка доступных банков в org_system_prefs."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "065_statement_banks"
down_revision = "064_finreq_department_id"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("bank_statements", sa.Column("bank_code", sa.String(length=32), nullable=True))
    op.add_column("org_system_prefs", sa.Column("enabled_statement_banks", JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column("org_system_prefs", "enabled_statement_banks")
    op.drop_column("bank_statements", "bank_code")
