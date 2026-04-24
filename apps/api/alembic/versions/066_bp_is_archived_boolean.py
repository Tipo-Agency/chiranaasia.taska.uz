"""Конвертация business_processes.is_archived из String('true'/'false') в Boolean.

Revision ID: 066_bp_is_archived_boolean
Revises: 065_statement_banks
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "066_bp_is_archived_boolean"
down_revision = "065_statement_banks"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # Добавляем временную колонку Boolean
    op.add_column(
        "business_processes",
        sa.Column("is_archived_bool", sa.Boolean(), nullable=True),
    )

    # Переносим данные: 'true' → True, всё остальное → False
    conn.execute(
        sa.text(
            "UPDATE business_processes SET is_archived_bool = (is_archived = 'true')"
        )
    )

    # Удаляем старую колонку
    op.drop_column("business_processes", "is_archived")

    # Переименовываем новую
    op.alter_column(
        "business_processes",
        "is_archived_bool",
        new_column_name="is_archived",
        nullable=False,
        server_default=sa.text("false"),
        existing_type=sa.Boolean(),
    )


def downgrade() -> None:
    conn = op.get_bind()

    op.add_column(
        "business_processes",
        sa.Column("is_archived_str", sa.String(10), nullable=True),
    )

    conn.execute(
        sa.text(
            "UPDATE business_processes SET is_archived_str = CASE WHEN is_archived THEN 'true' ELSE 'false' END"
        )
    )

    op.drop_column("business_processes", "is_archived")

    op.alter_column(
        "business_processes",
        "is_archived_str",
        new_column_name="is_archived",
        nullable=True,
        existing_type=sa.String(10),
    )
