"""notification_deliveries: recipient, next_retry_at, sent_at, attempts int; state machine; убрать in_app/chat и служебные timestamps."""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "032_notification_deliveries_alignment"
down_revision: Union[str, None] = "031_notifications_entity_alignment"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("DELETE FROM notification_deliveries WHERE channel IN ('in_app', 'chat')"))

    op.add_column(
        "notification_deliveries",
        sa.Column("recipient", sa.String(length=512), nullable=False, server_default=""),
    )
    op.alter_column("notification_deliveries", "recipient", server_default=None)

    op.drop_index("ix_notification_deliveries_next_attempt_at", table_name="notification_deliveries")
    op.execute(sa.text("ALTER TABLE notification_deliveries RENAME COLUMN next_attempt_at TO next_retry_at"))
    op.create_index(
        "ix_notification_deliveries_next_retry_at",
        "notification_deliveries",
        ["next_retry_at"],
        unique=False,
    )

    op.execute(sa.text("ALTER TABLE notification_deliveries RENAME COLUMN delivered_at TO sent_at"))

    op.drop_column("notification_deliveries", "created_at")
    op.drop_column("notification_deliveries", "updated_at")

    op.execute(
        sa.text(
            "ALTER TABLE notification_deliveries ALTER COLUMN attempts TYPE INTEGER "
            "USING CASE WHEN trim(coalesce(attempts::text, '')) ~ '^[0-9]+$' "
            "THEN trim(attempts::text)::integer ELSE 0 END"
        )
    )

    # Старые статусы → новая модель: failed без повторов считаем dead
    conn.execute(sa.text("UPDATE notification_deliveries SET status = 'dead' WHERE status = 'failed'"))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("UPDATE notification_deliveries SET status = 'failed' WHERE status = 'dead'"))

    op.execute(
        sa.text(
            "ALTER TABLE notification_deliveries ALTER COLUMN attempts TYPE VARCHAR(10) USING attempts::text"
        )
    )

    op.drop_index("ix_notification_deliveries_next_retry_at", table_name="notification_deliveries")
    op.execute(sa.text("ALTER TABLE notification_deliveries RENAME COLUMN next_retry_at TO next_attempt_at"))
    op.create_index(
        "ix_notification_deliveries_next_attempt_at",
        "notification_deliveries",
        ["next_attempt_at"],
        unique=False,
    )

    op.execute(sa.text("ALTER TABLE notification_deliveries RENAME COLUMN sent_at TO delivered_at"))

    op.add_column(
        "notification_deliveries",
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.add_column(
        "notification_deliveries",
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    op.drop_column("notification_deliveries", "recipient")
