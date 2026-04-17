"""Частичное одобрение заявки: сумма против лимита фонда (budget_approved_amount)."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "061_fin_req_budget_approved_amt"
down_revision = "060_funds_merge_categories"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "finance_requests",
        sa.Column("budget_approved_amount", sa.Numeric(15, 2), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("finance_requests", "budget_approved_amount")
