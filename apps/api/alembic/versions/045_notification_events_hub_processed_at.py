"""notification_events.hub_processed_at — идемпотентность async notification hub."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "045_notification_events_hub_processed_at"
down_revision = "044_calendar_export_token_strong"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "notification_events",
        sa.Column("hub_processed_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("notification_events", "hub_processed_at")
