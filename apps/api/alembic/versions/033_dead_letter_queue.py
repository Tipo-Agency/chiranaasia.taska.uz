"""dead_letter_queue: DLQ для очередей (queue.notifications и др.)."""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "033_dead_letter_queue"
down_revision: Union[str, None] = "032_notification_deliveries_alignment"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "dead_letter_queue",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("queue_name", sa.String(length=120), nullable=False),
        sa.Column("payload", JSONB(), nullable=False),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("resolved", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_dead_letter_queue_queue_name", "dead_letter_queue", ["queue_name"], unique=False)
    op.create_index("ix_dead_letter_queue_created_at", "dead_letter_queue", ["created_at"], unique=False)
    op.create_index("ix_dead_letter_queue_resolved", "dead_letter_queue", ["resolved"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_dead_letter_queue_resolved", table_name="dead_letter_queue")
    op.drop_index("ix_dead_letter_queue_created_at", table_name="dead_letter_queue")
    op.drop_index("ix_dead_letter_queue_queue_name", table_name="dead_letter_queue")
    op.drop_table("dead_letter_queue")
