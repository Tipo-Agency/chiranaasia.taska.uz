"""Конвертация production_pipelines.is_archived из String('true'/'false') в Boolean.

Revision ID: 068_production_pipeline_is_archived_boolean
Revises: 067_funnel_is_archived_boolean
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "068_production_pipeline_is_archived_boolean"
down_revision = "067_funnel_is_archived_boolean"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    op.add_column(
        "production_pipelines",
        sa.Column("is_archived_bool", sa.Boolean(), nullable=True),
    )

    conn.execute(
        sa.text(
            "UPDATE production_pipelines SET is_archived_bool = (is_archived = 'true')"
        )
    )

    op.drop_column("production_pipelines", "is_archived")

    op.alter_column(
        "production_pipelines",
        "is_archived_bool",
        new_column_name="is_archived",
        nullable=False,
        server_default=sa.text("false"),
        existing_type=sa.Boolean(),
    )


def downgrade() -> None:
    conn = op.get_bind()

    op.add_column(
        "production_pipelines",
        sa.Column("is_archived_str", sa.String(10), nullable=True),
    )

    conn.execute(
        sa.text(
            "UPDATE production_pipelines SET is_archived_str = CASE WHEN is_archived THEN 'true' ELSE 'false' END"
        )
    )

    op.drop_column("production_pipelines", "is_archived")

    op.alter_column(
        "production_pipelines",
        "is_archived_str",
        new_column_name="is_archived",
        nullable=True,
        existing_type=sa.String(10),
    )
