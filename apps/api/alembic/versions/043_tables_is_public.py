"""tables: флаг is_public для публичного контент-плана."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "043_tables_is_public"
down_revision = "042_rbac_edit_permissions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tables",
        sa.Column("is_public", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.alter_column("tables", "is_public", server_default=None)


def downgrade() -> None:
    op.drop_column("tables", "is_public")
