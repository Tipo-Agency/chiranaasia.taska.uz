"""Расширить alembic_version.version_num до VARCHAR(128), чтобы длинные ID ревизий не ломали upgrade.

По умолчанию в PostgreSQL колонка 32 символа — короткие идентификаторы в миграциях 066–072 обязательны до этой ревизии.
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "073_alembic_ver_128"
down_revision = "072_user_mail_oauth_accounts"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "alembic_version",
        "version_num",
        existing_type=sa.String(32),
        type_=sa.String(128),
        existing_nullable=False,
    )


def downgrade() -> None:
    # Откат возможен, только если все значения version_num ≤ 32 символов
    op.alter_column(
        "alembic_version",
        "version_num",
        existing_type=sa.String(128),
        type_=sa.String(32),
        existing_nullable=False,
    )
