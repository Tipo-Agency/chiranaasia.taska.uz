"""notification events foundation table

Revision ID: 008
Revises: 007
Create Date: 2026-03-16
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "008"
down_revision: Union[str, None] = "007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "notification_events",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("event_type", sa.String(length=120), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("actor_id", sa.String(length=36), nullable=True),
        sa.Column("org_id", sa.String(length=36), nullable=False),
        sa.Column("entity_type", sa.String(length=60), nullable=False),
        sa.Column("entity_id", sa.String(length=120), nullable=False),
        sa.Column("source", sa.String(length=120), nullable=False),
        sa.Column("correlation_id", sa.String(length=120), nullable=True),
        sa.Column("payload", JSONB(), nullable=False),
        sa.Column("published_to_stream", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("stream_id", sa.String(length=120), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_notification_events_event_type", "notification_events", ["event_type"], unique=False)
    op.create_index("ix_notification_events_occurred_at", "notification_events", ["occurred_at"], unique=False)
    op.create_index("ix_notification_events_actor_id", "notification_events", ["actor_id"], unique=False)
    op.create_index("ix_notification_events_org_id", "notification_events", ["org_id"], unique=False)
    op.create_index("ix_notification_events_entity_type", "notification_events", ["entity_type"], unique=False)
    op.create_index("ix_notification_events_entity_id", "notification_events", ["entity_id"], unique=False)
    op.create_index("ix_notification_events_correlation_id", "notification_events", ["correlation_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_notification_events_correlation_id", table_name="notification_events")
    op.drop_index("ix_notification_events_entity_id", table_name="notification_events")
    op.drop_index("ix_notification_events_entity_type", table_name="notification_events")
    op.drop_index("ix_notification_events_org_id", table_name="notification_events")
    op.drop_index("ix_notification_events_actor_id", table_name="notification_events")
    op.drop_index("ix_notification_events_occurred_at", table_name="notification_events")
    op.drop_index("ix_notification_events_event_type", table_name="notification_events")
    op.drop_table("notification_events")
