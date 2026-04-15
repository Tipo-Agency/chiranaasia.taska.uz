"""Номенклатура: атрибуты, вложения, штрихкод, производитель, норма расхода."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "055_inventory_nomenclature"
down_revision = "054_production_routes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "inventory_items",
        sa.Column("attributes", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
    )
    op.add_column(
        "inventory_items",
        sa.Column("attachments", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
    )
    op.add_column("inventory_items", sa.Column("barcode", sa.String(length=100), nullable=True))
    op.add_column("inventory_items", sa.Column("manufacturer", sa.String(length=255), nullable=True))
    op.add_column("inventory_items", sa.Column("consumption_hint", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("inventory_items", "consumption_hint")
    op.drop_column("inventory_items", "manufacturer")
    op.drop_column("inventory_items", "barcode")
    op.drop_column("inventory_items", "attachments")
    op.drop_column("inventory_items", "attributes")
