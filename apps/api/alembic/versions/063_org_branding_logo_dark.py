"""Добавить отдельный SVG логотипа для тёмной темы."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "063_org_branding_logo_dark"
down_revision = "062_org_system_prefs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("org_system_prefs", sa.Column("logo_svg_dark", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("org_system_prefs", "logo_svg_dark")
