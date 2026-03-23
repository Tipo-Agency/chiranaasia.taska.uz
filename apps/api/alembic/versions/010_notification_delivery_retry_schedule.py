"""add retry schedule to notification deliveries

Revision ID: 010
Revises: 009
Create Date: 2026-03-16
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "010"
down_revision: Union[str, None] = "009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "notification_deliveries",
        sa.Column("next_attempt_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_notification_deliveries_next_attempt_at",
        "notification_deliveries",
        ["next_attempt_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_notification_deliveries_next_attempt_at", table_name="notification_deliveries")
    op.drop_column("notification_deliveries", "next_attempt_at")
