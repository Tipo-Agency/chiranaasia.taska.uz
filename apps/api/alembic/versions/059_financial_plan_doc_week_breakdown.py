"""financial_plan_documents.week_breakdown — недели внутри одного документа плана."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "059_financial_plan_doc_week_breakdown"
down_revision = "058_fin_ir_multi"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "financial_plan_documents",
        sa.Column("week_breakdown", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("financial_plan_documents", "week_breakdown")
