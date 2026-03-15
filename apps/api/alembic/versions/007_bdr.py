"""БДР — бюджет доходов и расходов (таблица планирования по месяцам/кварталам/году)

Revision ID: 007
Revises: 006
Create Date: 2026-03-16

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "007"
down_revision: Union[str, None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "bdr",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("year", sa.String(4), nullable=False),
        sa.Column("rows", JSONB(), nullable=True, server_default=sa.text("'[]'::jsonb")),
        sa.Column("updated_at", sa.String(50), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("bdr")
