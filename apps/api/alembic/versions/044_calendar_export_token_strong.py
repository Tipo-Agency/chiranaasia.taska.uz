"""users.calendar_export_token: длина под secrets.token_urlsafe (до 128 символов)."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "044_calendar_export_token_strong"
down_revision = "043_tables_is_public"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "users",
        "calendar_export_token",
        existing_type=sa.String(length=36),
        type_=sa.String(length=128),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "users",
        "calendar_export_token",
        existing_type=sa.String(length=128),
        type_=sa.String(length=36),
        existing_nullable=True,
    )
