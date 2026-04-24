"""Конвертация warehouses.is_default, warehouses.is_archived, inventory_items.is_archived
из String('true'/'false') в Boolean.

Revision ID: 069_inv_archived_bool (≤31: alembic_version.version_num VARCHAR(32))
Revises: 068_pp_is_archived_bool
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "069_inv_archived_bool"
down_revision = "068_pp_is_archived_bool"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # ── warehouses.is_default ─────────────────────────────────────────────────
    op.add_column("warehouses", sa.Column("is_default_bool", sa.Boolean(), nullable=True))
    conn.execute(sa.text("UPDATE warehouses SET is_default_bool = (is_default = 'true')"))
    op.drop_column("warehouses", "is_default")
    op.alter_column(
        "warehouses",
        "is_default_bool",
        new_column_name="is_default",
        nullable=False,
        server_default=sa.text("false"),
        existing_type=sa.Boolean(),
    )

    # ── warehouses.is_archived ────────────────────────────────────────────────
    op.add_column("warehouses", sa.Column("is_archived_bool", sa.Boolean(), nullable=True))
    conn.execute(sa.text("UPDATE warehouses SET is_archived_bool = (is_archived = 'true')"))
    op.drop_column("warehouses", "is_archived")
    op.alter_column(
        "warehouses",
        "is_archived_bool",
        new_column_name="is_archived",
        nullable=False,
        server_default=sa.text("false"),
        existing_type=sa.Boolean(),
    )

    # ── inventory_items.is_archived ───────────────────────────────────────────
    op.add_column("inventory_items", sa.Column("is_archived_bool", sa.Boolean(), nullable=True))
    conn.execute(sa.text("UPDATE inventory_items SET is_archived_bool = (is_archived = 'true')"))
    op.drop_column("inventory_items", "is_archived")
    op.alter_column(
        "inventory_items",
        "is_archived_bool",
        new_column_name="is_archived",
        nullable=False,
        server_default=sa.text("false"),
        existing_type=sa.Boolean(),
    )


def downgrade() -> None:
    conn = op.get_bind()

    # ── inventory_items.is_archived ───────────────────────────────────────────
    op.add_column("inventory_items", sa.Column("is_archived_str", sa.String(10), nullable=True))
    conn.execute(
        sa.text("UPDATE inventory_items SET is_archived_str = CASE WHEN is_archived THEN 'true' ELSE 'false' END")
    )
    op.drop_column("inventory_items", "is_archived")
    op.alter_column(
        "inventory_items",
        "is_archived_str",
        new_column_name="is_archived",
        nullable=True,
        existing_type=sa.String(10),
    )

    # ── warehouses.is_archived ────────────────────────────────────────────────
    op.add_column("warehouses", sa.Column("is_archived_str", sa.String(10), nullable=True))
    conn.execute(
        sa.text("UPDATE warehouses SET is_archived_str = CASE WHEN is_archived THEN 'true' ELSE 'false' END")
    )
    op.drop_column("warehouses", "is_archived")
    op.alter_column(
        "warehouses",
        "is_archived_str",
        new_column_name="is_archived",
        nullable=True,
        existing_type=sa.String(10),
    )

    # ── warehouses.is_default ─────────────────────────────────────────────────
    op.add_column("warehouses", sa.Column("is_default_str", sa.String(10), nullable=True))
    conn.execute(
        sa.text("UPDATE warehouses SET is_default_str = CASE WHEN is_default THEN 'true' ELSE 'false' END")
    )
    op.drop_column("warehouses", "is_default")
    op.alter_column(
        "warehouses",
        "is_default_str",
        new_column_name="is_default",
        nullable=True,
        existing_type=sa.String(10),
    )
