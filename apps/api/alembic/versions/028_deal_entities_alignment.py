"""Deal: source_chat_id, tags[], custom_fields, lost_reason, NUMERIC amount, FKs, indexes.

Соответствие docs/ENTITIES.md §4. Данные telegram_* переносятся в source_chat_id и custom_fields._legacy.

Revision ID: 028
Revises: 027_audit_logs
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "028_deal_entities"
down_revision: Union[str, None] = "027_audit_logs"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("deals", sa.Column("source_chat_id", sa.String(255), nullable=True))
    op.add_column(
        "deals",
        sa.Column(
            "tags",
            postgresql.ARRAY(sa.Text()),
            server_default=sa.text("ARRAY[]::text[]"),
            nullable=False,
        ),
    )
    op.add_column(
        "deals",
        sa.Column(
            "custom_fields",
            postgresql.JSONB(),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
    )
    op.add_column("deals", sa.Column("lost_reason", sa.Text(), nullable=True))

    op.execute(
        sa.text(
            """
            UPDATE deals
            SET source_chat_id = NULLIF(btrim(telegram_chat_id), '')
            WHERE telegram_chat_id IS NOT NULL
            """
        )
    )

    op.execute(
        sa.text(
            """
            UPDATE deals
            SET custom_fields = jsonb_set(
                custom_fields,
                '{_legacy}',
                coalesce(custom_fields->'_legacy', '{}'::jsonb)
                || CASE
                    WHEN telegram_username IS NOT NULL AND btrim(telegram_username::text) <> ''
                    THEN jsonb_build_object('telegram_username', to_jsonb(btrim(telegram_username::text)))
                    ELSE '{}'::jsonb
                END,
                true
            )
            WHERE telegram_username IS NOT NULL AND btrim(telegram_username::text) <> ''
            """
        )
    )

    op.add_column(
        "deals",
        sa.Column("amount_new", sa.Numeric(18, 2), nullable=False, server_default="0"),
    )
    op.execute(
        sa.text(
            """
            UPDATE deals SET amount_new = CASE
                WHEN amount IS NULL OR btrim(amount::text) = '' THEN 0::numeric(18,2)
                WHEN btrim(amount::text) ~ '^-?[0-9]+(\\.[0-9]*)?$' THEN btrim(amount::text)::numeric(18,2)
                ELSE 0::numeric(18,2)
            END
            """
        )
    )
    op.drop_column("deals", "amount")
    op.execute(sa.text("ALTER TABLE deals RENAME COLUMN amount_new TO amount"))

    op.execute(sa.text("UPDATE deals SET assignee_id = NULL WHERE assignee_id = ''"))
    op.alter_column("deals", "assignee_id", existing_type=sa.String(36), nullable=True)

    op.execute(
        sa.text(
            """
            UPDATE deals d SET funnel_id = NULL
            WHERE funnel_id IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM sales_funnels sf WHERE sf.id = d.funnel_id)
            """
        )
    )
    op.execute(
        sa.text(
            """
            UPDATE deals d SET client_id = NULL
            WHERE client_id IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM clients c WHERE c.id = d.client_id)
            """
        )
    )
    op.execute(
        sa.text(
            """
            UPDATE deals d SET assignee_id = NULL
            WHERE assignee_id IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = d.assignee_id)
            """
        )
    )

    op.create_index("ix_deals_stage", "deals", ["stage"], unique=False)
    op.create_index("ix_deals_funnel_id", "deals", ["funnel_id"], unique=False)
    op.create_index("ix_deals_assignee_id", "deals", ["assignee_id"], unique=False)

    op.create_foreign_key(
        "deals_funnel_id_fkey",
        "deals",
        "sales_funnels",
        ["funnel_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "deals_client_id_fkey",
        "deals",
        "clients",
        ["client_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "deals_assignee_id_fkey",
        "deals",
        "users",
        ["assignee_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.drop_column("deals", "telegram_chat_id")
    op.drop_column("deals", "telegram_username")


def downgrade() -> None:
    op.add_column("deals", sa.Column("telegram_username", sa.String(100), nullable=True))
    op.add_column("deals", sa.Column("telegram_chat_id", sa.String(255), nullable=True))

    op.execute(
        sa.text(
            """
            UPDATE deals SET telegram_chat_id = source_chat_id
            WHERE source_chat_id IS NOT NULL
            """
        )
    )
    op.execute(
        sa.text(
            """
            UPDATE deals SET telegram_username = NULLIF(custom_fields#>>'{_legacy,telegram_username}', '')
            WHERE custom_fields ? '_legacy'
            """
        )
    )

    op.drop_constraint("deals_assignee_id_fkey", "deals", type_="foreignkey")
    op.drop_constraint("deals_client_id_fkey", "deals", type_="foreignkey")
    op.drop_constraint("deals_funnel_id_fkey", "deals", type_="foreignkey")

    op.drop_index("ix_deals_assignee_id", table_name="deals")
    op.drop_index("ix_deals_funnel_id", table_name="deals")
    op.drop_index("ix_deals_stage", table_name="deals")

    op.add_column("deals", sa.Column("amount_str", sa.String(50), nullable=False, server_default="0"))
    op.execute(sa.text("UPDATE deals SET amount_str = trim(to_char(amount, 'FM999999999999999999.99'))"))
    op.drop_column("deals", "amount")
    op.execute(sa.text("ALTER TABLE deals RENAME COLUMN amount_str TO amount"))

    op.drop_column("deals", "lost_reason")
    op.drop_column("deals", "custom_fields")
    op.drop_column("deals", "tags")
    op.drop_column("deals", "source_chat_id")

    op.execute(sa.text("UPDATE deals SET assignee_id = '' WHERE assignee_id IS NULL"))
    op.alter_column("deals", "assignee_id", existing_type=sa.String(36), nullable=False)
