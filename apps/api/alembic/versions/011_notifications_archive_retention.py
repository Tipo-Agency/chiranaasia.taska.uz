"""notifications archive and retention support

Revision ID: 011
Revises: 010
Create Date: 2026-03-16
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "011"
down_revision: Union[str, None] = "010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "notifications_archive",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("event_id", sa.String(length=36), nullable=True),
        sa.Column("recipient_id", sa.String(length=36), nullable=False),
        sa.Column("type", sa.String(length=120), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("body", sa.String(length=2000), nullable=False),
        sa.Column("priority", sa.String(length=20), nullable=False, server_default="normal"),
        sa.Column("entity_type", sa.String(length=60), nullable=True),
        sa.Column("entity_id", sa.String(length=120), nullable=True),
        sa.Column("payload", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_notifications_archive_event_id", "notifications_archive", ["event_id"], unique=False)
    op.create_index("ix_notifications_archive_recipient_id", "notifications_archive", ["recipient_id"], unique=False)
    op.create_index("ix_notifications_archive_type", "notifications_archive", ["type"], unique=False)
    op.create_index("ix_notifications_archive_priority", "notifications_archive", ["priority"], unique=False)
    op.create_index("ix_notifications_archive_entity_type", "notifications_archive", ["entity_type"], unique=False)
    op.create_index("ix_notifications_archive_entity_id", "notifications_archive", ["entity_id"], unique=False)
    op.create_index("ix_notifications_archive_is_read", "notifications_archive", ["is_read"], unique=False)
    op.create_index("ix_notifications_archive_created_at", "notifications_archive", ["created_at"], unique=False)
    op.create_index("ix_notifications_archive_archived_at", "notifications_archive", ["archived_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_notifications_archive_archived_at", table_name="notifications_archive")
    op.drop_index("ix_notifications_archive_created_at", table_name="notifications_archive")
    op.drop_index("ix_notifications_archive_is_read", table_name="notifications_archive")
    op.drop_index("ix_notifications_archive_entity_id", table_name="notifications_archive")
    op.drop_index("ix_notifications_archive_entity_type", table_name="notifications_archive")
    op.drop_index("ix_notifications_archive_priority", table_name="notifications_archive")
    op.drop_index("ix_notifications_archive_type", table_name="notifications_archive")
    op.drop_index("ix_notifications_archive_recipient_id", table_name="notifications_archive")
    op.drop_index("ix_notifications_archive_event_id", table_name="notifications_archive")
    op.drop_table("notifications_archive")
