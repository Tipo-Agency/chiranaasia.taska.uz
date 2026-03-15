"""Add is_archived to departments (мягкое удаление / архив)

Revision ID: 006
Revises: 005
Create Date: 2026-03-16

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("departments", sa.Column("is_archived", sa.Boolean(), server_default=sa.text("false"), nullable=True))


def downgrade() -> None:
    op.drop_column("departments", "is_archived")
