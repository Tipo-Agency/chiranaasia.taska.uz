"""System logs table for errors and audit

Revision ID: 003
Revises: 002
Create Date: 2026-03-11

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "system_logs",
        sa.Column("id", sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("level", sa.String(20), nullable=False, index=True),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("logger_name", sa.String(255), nullable=True),
        sa.Column("path", sa.String(500), nullable=True),
        sa.Column("request_id", sa.String(64), nullable=True, index=True),
        sa.Column("payload", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("system_logs")
