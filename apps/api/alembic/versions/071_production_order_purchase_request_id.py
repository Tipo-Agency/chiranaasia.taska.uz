"""Добавить production_orders.purchase_request_id — привязка к заявке на приобретение (finance).

Revision ID: 071_po_purchase_req_id (имя ≤32: alembic_version.version_num VARCHAR(32))
Revises: 070_production_order_deal_id
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "071_po_purchase_req_id"
down_revision = "070_production_order_deal_id"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "production_orders",
        sa.Column("purchase_request_id", sa.String(36), nullable=True),
    )
    op.create_index(
        "ix_production_orders_purchase_request_id",
        "production_orders",
        ["purchase_request_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_production_orders_purchase_request_id", table_name="production_orders")
    op.drop_column("production_orders", "purchase_request_id")
