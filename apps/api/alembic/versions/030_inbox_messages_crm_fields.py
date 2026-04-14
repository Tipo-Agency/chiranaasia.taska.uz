"""inbox_messages: CRM-поля, UNIQUE (channel, external_msg_id), удаление дублей."""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import text

revision: str = "030_inbox_messages_crm"
down_revision: Union[str, None] = "029_clients_entities"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("inbox_messages", sa.Column("deal_id", sa.String(36), nullable=True))
    op.add_column("inbox_messages", sa.Column("funnel_id", sa.String(36), nullable=True))
    op.add_column("inbox_messages", sa.Column("direction", sa.String(16), nullable=True))
    op.add_column("inbox_messages", sa.Column("channel", sa.String(32), nullable=True))
    op.add_column("inbox_messages", sa.Column("body", sa.Text(), nullable=True))
    op.add_column("inbox_messages", sa.Column("media_url", sa.Text(), nullable=True))
    op.add_column("inbox_messages", sa.Column("external_msg_id", sa.String(512), nullable=True))
    op.add_column("inbox_messages", sa.Column("is_read", sa.Boolean(), nullable=True))

    op.execute(
        text("""
        UPDATE inbox_messages SET
            body = COALESCE(text, ''),
            is_read = COALESCE(read, false),
            direction = 'internal',
            channel = 'internal'
        """)
    )

    op.alter_column(
        "inbox_messages",
        "body",
        existing_type=sa.Text(),
        nullable=False,
    )
    op.alter_column(
        "inbox_messages",
        "is_read",
        existing_type=sa.Boolean(),
        nullable=False,
        server_default=sa.text("false"),
    )
    op.alter_column(
        "inbox_messages",
        "direction",
        existing_type=sa.String(16),
        nullable=False,
        server_default=sa.text("'internal'"),
    )
    op.alter_column(
        "inbox_messages",
        "channel",
        existing_type=sa.String(32),
        nullable=False,
        server_default=sa.text("'internal'"),
    )

    op.drop_column("inbox_messages", "read")
    op.drop_column("inbox_messages", "text")

    op.alter_column(
        "inbox_messages",
        "sender_id",
        existing_type=sa.String(36),
        type_=sa.String(255),
        existing_nullable=False,
    )

    op.execute(
        text("""
        UPDATE inbox_messages
        SET external_msg_id = NULL
        WHERE external_msg_id IS NOT NULL AND trim(external_msg_id) = ''
        """)
    )

    op.execute(
        text("""
        DELETE FROM inbox_messages im
        USING (
            SELECT id FROM (
                SELECT id,
                    ROW_NUMBER() OVER (
                        PARTITION BY channel, external_msg_id
                        ORDER BY created_at ASC NULLS LAST, id ASC
                    ) AS rn
                FROM inbox_messages
                WHERE external_msg_id IS NOT NULL
            ) sub
            WHERE sub.rn > 1
        ) dup
        WHERE im.id = dup.id
        """)
    )

    op.create_unique_constraint(
        "uq_inbox_messages_channel_external_msg_id",
        "inbox_messages",
        ["channel", "external_msg_id"],
    )

    op.create_index(
        "ix_inbox_messages_deal_created",
        "inbox_messages",
        ["deal_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_inbox_messages_funnel_created",
        "inbox_messages",
        ["funnel_id", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_inbox_messages_funnel_created", table_name="inbox_messages")
    op.drop_index("ix_inbox_messages_deal_created", table_name="inbox_messages")
    op.drop_constraint("uq_inbox_messages_channel_external_msg_id", "inbox_messages", type_="unique")

    op.add_column("inbox_messages", sa.Column("text", sa.Text(), nullable=True))
    op.add_column(
        "inbox_messages",
        sa.Column("read", sa.Boolean(), server_default=sa.text("false"), nullable=True),
    )
    op.execute(
        text("""
        UPDATE inbox_messages SET text = COALESCE(body, ''), read = COALESCE(is_read, false)
        """)
    )
    op.alter_column("inbox_messages", "text", existing_type=sa.Text(), nullable=False)
    op.alter_column(
        "inbox_messages",
        "read",
        existing_type=sa.Boolean(),
        nullable=False,
        server_default=sa.text("false"),
    )

    op.drop_column("inbox_messages", "is_read")
    op.drop_column("inbox_messages", "body")
    op.drop_column("inbox_messages", "external_msg_id")
    op.drop_column("inbox_messages", "media_url")
    op.drop_column("inbox_messages", "channel")
    op.drop_column("inbox_messages", "direction")
    op.drop_column("inbox_messages", "funnel_id")
    op.drop_column("inbox_messages", "deal_id")

    op.alter_column(
        "inbox_messages",
        "sender_id",
        existing_type=sa.String(255),
        type_=sa.String(36),
        existing_nullable=False,
    )
