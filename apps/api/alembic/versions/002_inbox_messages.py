"""Inbox messages table

Revision ID: 002
Revises: 001
Create Date: 2025-02-23

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "inbox_messages",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("sender_id", sa.String(36), nullable=False),
        sa.Column("recipient_id", sa.String(36), nullable=True),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("attachments", postgresql.JSONB(), server_default="[]"),
        sa.Column("created_at", sa.String(30), nullable=False),
        sa.Column("read", sa.Boolean(), server_default="false"),
    )


def downgrade() -> None:
    op.drop_table("inbox_messages")
