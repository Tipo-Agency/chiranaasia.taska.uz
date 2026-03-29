"""Widen deals.telegram_chat_id for Instagram thread keys (ig:page:sender)."""

from alembic import op
import sqlalchemy as sa

revision = "018_deals_telegram_chat_id_len"
down_revision = "017_sales_funnels_color"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "deals",
        "telegram_chat_id",
        existing_type=sa.String(length=50),
        type_=sa.String(length=255),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "deals",
        "telegram_chat_id",
        existing_type=sa.String(length=255),
        type_=sa.String(length=50),
        existing_nullable=True,
    )
