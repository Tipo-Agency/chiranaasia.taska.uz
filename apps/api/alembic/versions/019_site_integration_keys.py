"""Add site_integration_keys table for website lead intake."""

from alembic import op
import sqlalchemy as sa


revision = "019_site_integration_keys"
down_revision = "018_deals_telegram_chat_id_len"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "site_integration_keys",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("funnel_id", sa.String(length=36), nullable=False),
        sa.Column("api_key_hash", sa.String(length=64), nullable=False),
        sa.Column("key_last4", sa.String(length=8), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("rotated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_site_integration_keys_funnel_id", "site_integration_keys", ["funnel_id"], unique=True)
    op.create_index("ix_site_integration_keys_api_key_hash", "site_integration_keys", ["api_key_hash"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_site_integration_keys_api_key_hash", table_name="site_integration_keys")
    op.drop_index("ix_site_integration_keys_funnel_id", table_name="site_integration_keys")
    op.drop_table("site_integration_keys")

