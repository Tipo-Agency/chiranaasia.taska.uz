"""BDR: уникальный год (один документ на год).

Revision ID: 036_bdr_year_unique
Revises: 035_finance_requests
"""
from typing import Sequence, Union

from alembic import op

revision: str = "036_bdr_year_unique"
down_revision: Union[str, None] = "035_finance_requests"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_unique_constraint("uq_bdr_year", "bdr", ["year"])


def downgrade() -> None:
    op.drop_constraint("uq_bdr_year", "bdr", type_="unique")
