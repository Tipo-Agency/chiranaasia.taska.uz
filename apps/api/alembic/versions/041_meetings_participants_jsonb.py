"""Meetings: participants JSONB (объекты), синхронно с participant_ids."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "041_meetings_participants_jsonb"
down_revision = "040_bp_instances_table"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "meetings",
        sa.Column("participants", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'[]'::jsonb")),
    )
    op.execute(
        """
        UPDATE meetings
        SET participants = COALESCE(
            (
                SELECT jsonb_agg(jsonb_build_object('userId', elem))
                FROM jsonb_array_elements_text(COALESCE(participant_ids, '[]'::jsonb)) AS elem
            ),
            '[]'::jsonb
        )
        WHERE participants IS NULL OR participants = '[]'::jsonb;
        """
    )


def downgrade() -> None:
    op.drop_column("meetings", "participants")
