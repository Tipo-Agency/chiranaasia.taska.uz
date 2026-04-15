"""Несколько справок о доходах на один бюджет: снятие unique с locked_by_planning_id, income_report_ids."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "058_finance_multi_income_reports"
down_revision = "057_finance_plan_budget_enhancements"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_index("ix_income_reports_locked_by_planning_id", table_name="income_reports")
    op.create_index(
        "ix_income_reports_locked_by_planning_id",
        "income_reports",
        ["locked_by_planning_id"],
        unique=False,
    )
    op.add_column(
        "financial_plannings",
        sa.Column(
            "income_report_ids",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )


def downgrade() -> None:
    op.drop_column("financial_plannings", "income_report_ids")
    op.drop_index("ix_income_reports_locked_by_planning_id", table_name="income_reports")
    op.create_index(
        "ix_income_reports_locked_by_planning_id",
        "income_reports",
        ["locked_by_planning_id"],
        unique=True,
    )
