"""Таблица org_system_prefs: цвет и SVG логотипа для брендинга."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "062_org_system_prefs"
down_revision = "061_fin_req_budget_approved_amt"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "org_system_prefs",
        sa.Column("id", sa.String(length=32), nullable=False),
        sa.Column("primary_color", sa.String(length=16), server_default=sa.text("'#F97316'"), nullable=False),
        sa.Column("logo_svg", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.execute(sa.text("INSERT INTO org_system_prefs (id, primary_color, logo_svg) VALUES ('default', '#F97316', NULL)"))


def downgrade() -> None:
    op.drop_table("org_system_prefs")
