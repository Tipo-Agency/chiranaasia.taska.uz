"""Weekly plans and protocols (недельные планы сотрудников, протоколы)

Revision ID: 005
Revises: 004
Create Date: 2026-03-16

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "weekly_plans",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), nullable=False),
        sa.Column("week_start", sa.String(10), nullable=False),
        sa.Column("task_ids", JSONB(), nullable=True, server_default=sa.text("'[]'::jsonb")),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.String(50), nullable=False),
        sa.Column("updated_at", sa.String(50), nullable=True),
    )
    op.create_table(
        "protocols",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("week_start", sa.String(10), nullable=False),
        sa.Column("participant_ids", JSONB(), nullable=True, server_default=sa.text("'[]'::jsonb")),
        sa.Column("created_at", sa.String(50), nullable=False),
        sa.Column("updated_at", sa.String(50), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("protocols")
    op.drop_table("weekly_plans")
