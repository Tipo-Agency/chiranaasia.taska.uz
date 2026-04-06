"""Add telegram_integration_state table for server-side polling offsets."""

from alembic import op
import sqlalchemy as sa


revision = "021_telegram_integration_state"
down_revision = "020_sales_funnels_owner_user_id"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "telegram_integration_state",
        sa.Column("funnel_id", sa.String(length=36), primary_key=True),
        sa.Column("last_update_id", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )


def downgrade() -> None:
    op.drop_table("telegram_integration_state")

