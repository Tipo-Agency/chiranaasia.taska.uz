"""Bank statements and income reports (выписки и отчёты по приходам)

Revision ID: 004
Revises: 003
Create Date: 2026-03-16

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "bank_statements",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column("period", sa.String(20), nullable=True),
        sa.Column("created_at", sa.String(50), nullable=False),
    )
    op.create_table(
        "bank_statement_lines",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("statement_id", sa.String(36), nullable=False),
        sa.Column("line_date", sa.String(20), nullable=False),
        sa.Column("description", sa.String(500), nullable=True),
        sa.Column("amount", sa.String(50), nullable=False),
        sa.Column("line_type", sa.String(10), nullable=False),
    )
    op.create_table(
        "income_reports",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("period", sa.String(20), nullable=False),
        sa.Column("data", JSONB(), nullable=True, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.String(50), nullable=False),
        sa.Column("updated_at", sa.String(50), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("income_reports")
    op.drop_table("bank_statement_lines")
    op.drop_table("bank_statements")
