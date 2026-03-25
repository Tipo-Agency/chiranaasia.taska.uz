"""Add extended fields to protocols

Revision ID: 013
Revises: 012
Create Date: 2026-03-16
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "013"
down_revision: Union[str, None] = "012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("protocols", sa.Column("week_end", sa.String(length=10), nullable=True))
    op.add_column("protocols", sa.Column("department_id", sa.String(length=36), nullable=True))
    op.add_column("protocols", sa.Column("planned_income", sa.Numeric(14, 2), nullable=True))
    op.add_column("protocols", sa.Column("actual_income", sa.Numeric(14, 2), nullable=True))


def downgrade() -> None:
    op.drop_column("protocols", "actual_income")
    op.drop_column("protocols", "planned_income")
    op.drop_column("protocols", "department_id")
    op.drop_column("protocols", "week_end")
