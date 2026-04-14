"""notifications: user_id, text body, индексы; убрать event_id, priority, payload, read_at."""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "031_notifications_entity_alignment"
down_revision: Union[str, None] = "030_inbox_messages_crm"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- notifications ---
    op.drop_index("ix_notifications_event_id", table_name="notifications")
    op.drop_index("ix_notifications_priority", table_name="notifications")
    op.drop_index("ix_notifications_recipient_id", table_name="notifications")
    op.drop_column("notifications", "event_id")
    op.drop_column("notifications", "priority")
    op.drop_column("notifications", "payload")
    op.drop_column("notifications", "read_at")
    op.execute(sa.text("ALTER TABLE notifications RENAME COLUMN recipient_id TO user_id"))
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"], unique=False)
    op.alter_column(
        "notifications",
        "body",
        existing_type=sa.String(length=2000),
        type_=sa.Text(),
        existing_nullable=False,
    )

    # --- notifications_archive ---
    op.drop_index("ix_notifications_archive_event_id", table_name="notifications_archive")
    op.drop_index("ix_notifications_archive_priority", table_name="notifications_archive")
    op.drop_index("ix_notifications_archive_recipient_id", table_name="notifications_archive")
    op.drop_column("notifications_archive", "event_id")
    op.drop_column("notifications_archive", "priority")
    op.drop_column("notifications_archive", "payload")
    op.drop_column("notifications_archive", "read_at")
    op.execute(sa.text("ALTER TABLE notifications_archive RENAME COLUMN recipient_id TO user_id"))
    op.create_index("ix_notifications_archive_user_id", "notifications_archive", ["user_id"], unique=False)
    op.alter_column(
        "notifications_archive",
        "body",
        existing_type=sa.String(length=2000),
        type_=sa.Text(),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            "ALTER TABLE notifications_archive ALTER COLUMN body TYPE VARCHAR(2000) USING left(body, 2000)"
        )
    )
    op.drop_index("ix_notifications_archive_user_id", table_name="notifications_archive")
    op.execute(sa.text("ALTER TABLE notifications_archive RENAME COLUMN user_id TO recipient_id"))
    op.create_index(
        "ix_notifications_archive_recipient_id",
        "notifications_archive",
        ["recipient_id"],
        unique=False,
    )
    op.add_column("notifications_archive", sa.Column("read_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "notifications_archive",
        sa.Column("payload", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
    )
    op.add_column(
        "notifications_archive",
        sa.Column("priority", sa.String(length=20), nullable=False, server_default="normal"),
    )
    op.add_column("notifications_archive", sa.Column("event_id", sa.String(length=36), nullable=True))
    op.create_index("ix_notifications_archive_event_id", "notifications_archive", ["event_id"], unique=False)
    op.create_index("ix_notifications_archive_priority", "notifications_archive", ["priority"], unique=False)

    op.execute(sa.text("ALTER TABLE notifications ALTER COLUMN body TYPE VARCHAR(2000) USING left(body, 2000)"))
    op.drop_index("ix_notifications_user_id", table_name="notifications")
    op.execute(sa.text("ALTER TABLE notifications RENAME COLUMN user_id TO recipient_id"))
    op.create_index("ix_notifications_recipient_id", "notifications", ["recipient_id"], unique=False)
    op.add_column("notifications", sa.Column("read_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "notifications",
        sa.Column("payload", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
    )
    op.add_column(
        "notifications",
        sa.Column("priority", sa.String(length=20), nullable=False, server_default="normal"),
    )
    op.add_column("notifications", sa.Column("event_id", sa.String(length=36), nullable=True))
    op.create_index("ix_notifications_event_id", "notifications", ["event_id"], unique=False)
    op.create_index("ix_notifications_priority", "notifications", ["priority"], unique=False)
