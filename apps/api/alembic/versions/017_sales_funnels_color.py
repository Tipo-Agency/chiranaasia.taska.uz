"""sales funnels color field."""

from alembic import op
import sqlalchemy as sa


revision = "017_sales_funnels_color"
down_revision = "016_employee_org_position"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("sales_funnels", sa.Column("color", sa.String(100), nullable=True))


def downgrade() -> None:
    op.drop_column("sales_funnels", "color")

