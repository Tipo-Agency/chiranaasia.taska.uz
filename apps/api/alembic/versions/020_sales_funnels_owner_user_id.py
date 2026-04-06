"""Add owner_user_id to sales_funnels (default responsible)."""

from alembic import op
import sqlalchemy as sa


revision = "020_sales_funnels_owner_user_id"
down_revision = "019_site_integration_keys"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("sales_funnels", sa.Column("owner_user_id", sa.String(length=36), nullable=True))


def downgrade() -> None:
    op.drop_column("sales_funnels", "owner_user_id")

