"""Добавить production_orders.deal_id — привязка к заявке (сделке).

Revision ID: 070_production_order_deal_id
Revises: 069_inv_archived_bool
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "070_production_order_deal_id"
down_revision = "069_inv_archived_bool"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "production_orders",
        sa.Column("deal_id", sa.String(36), nullable=True),
    )
    op.create_index(
        "ix_production_orders_deal_id",
        "production_orders",
        ["deal_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_production_orders_deal_id", table_name="production_orders")
    op.drop_column("production_orders", "deal_id")
