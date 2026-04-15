"""Заявки: вложения, ИНН/счёт; группы сверки расходов с ФП."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "056_finance_fp_matching"
down_revision = "055_inventory_nomenclature"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "finance_requests",
        sa.Column("attachments", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
    )
    op.add_column("finance_requests", sa.Column("counterparty_inn", sa.String(length=32), nullable=True))
    op.add_column("finance_requests", sa.Column("invoice_number", sa.String(length=100), nullable=True))
    op.add_column("finance_requests", sa.Column("invoice_date", sa.Date(), nullable=True))
    op.create_table(
        "finance_reconciliation_groups",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("line_ids", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("request_id", sa.String(length=36), nullable=True),
        sa.Column("manual_resolved", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("updated_at", sa.String(length=50), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("finance_reconciliation_groups")
    op.drop_column("finance_requests", "invoice_date")
    op.drop_column("finance_requests", "invoice_number")
    op.drop_column("finance_requests", "counterparty_inn")
    op.drop_column("finance_requests", "attachments")
