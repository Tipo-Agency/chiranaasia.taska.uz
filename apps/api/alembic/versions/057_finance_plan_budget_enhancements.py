"""План/бюджет: периоды (недели), серии планов, связь со справкой о доходах, движения по фондам."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# Имя ревизии ≤32 символов: колонка alembic_version.version_num — VARCHAR(32).
revision = "057_fin_fp_plan_budget"
down_revision = "056_finance_fp_matching"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("financial_plan_documents", sa.Column("period_start", sa.String(length=20), nullable=True))
    op.add_column("financial_plan_documents", sa.Column("period_end", sa.String(length=20), nullable=True))
    op.add_column("financial_plan_documents", sa.Column("plan_series_id", sa.String(length=36), nullable=True))
    op.add_column("financial_plan_documents", sa.Column("period_label", sa.String(length=120), nullable=True))

    op.add_column("financial_plannings", sa.Column("period_start", sa.String(length=20), nullable=True))
    op.add_column("financial_plannings", sa.Column("period_end", sa.String(length=20), nullable=True))
    op.add_column(
        "financial_plannings",
        sa.Column("plan_document_ids", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
    )
    op.add_column("financial_plannings", sa.Column("income_report_id", sa.String(length=36), nullable=True))
    op.add_column(
        "financial_plannings",
        sa.Column("fund_movements", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
    )
    op.add_column(
        "financial_plannings",
        sa.Column(
            "expense_distribution",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )

    op.add_column("income_reports", sa.Column("locked_by_planning_id", sa.String(length=36), nullable=True))
    op.create_index("ix_income_reports_locked_by_planning_id", "income_reports", ["locked_by_planning_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_income_reports_locked_by_planning_id", table_name="income_reports")
    op.drop_column("income_reports", "locked_by_planning_id")

    op.drop_column("financial_plannings", "expense_distribution")
    op.drop_column("financial_plannings", "fund_movements")
    op.drop_column("financial_plannings", "income_report_id")
    op.drop_column("financial_plannings", "plan_document_ids")
    op.drop_column("financial_plannings", "period_end")
    op.drop_column("financial_plannings", "period_start")

    op.drop_column("financial_plan_documents", "period_label")
    op.drop_column("financial_plan_documents", "plan_series_id")
    op.drop_column("financial_plan_documents", "period_end")
    op.drop_column("financial_plan_documents", "period_start")
