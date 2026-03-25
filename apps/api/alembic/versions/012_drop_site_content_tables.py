"""drop site content tables (partner_logos, news, cases, tags)

Revision ID: 012
Revises: 011
Create Date: 2026-03-16
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "012"
down_revision: Union[str, None] = "011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    for table in ("tags", "cases", "news", "partner_logos"):
        op.drop_table(table)


def downgrade() -> None:
    """Восстанавливает таблицы как в 001_initial (если нужен откат миграции)."""
    op.create_table(
        "partner_logos",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("logo_url", sa.String(500), nullable=False),
        sa.Column("website_url", sa.String(500)),
        sa.Column("order_val", sa.String(10), server_default="0"),
        sa.Column("created_at", sa.String(30)),
        sa.Column("updated_at", sa.String(30)),
        sa.Column("is_archived", sa.String(10), server_default="false"),
    )
    op.create_table(
        "news",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("content", sa.Text()),
        sa.Column("image_url", sa.String(500)),
        sa.Column("excerpt", sa.String(500)),
        sa.Column("tags", postgresql.JSONB(), server_default="[]"),
        sa.Column("published", sa.String(10), server_default="false"),
        sa.Column("published_at", sa.String(30)),
        sa.Column("created_at", sa.String(30)),
        sa.Column("updated_at", sa.String(30)),
        sa.Column("is_archived", sa.String(10), server_default="false"),
    )
    op.create_table(
        "cases",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("image_url", sa.String(500)),
        sa.Column("excerpt", sa.String(500)),
        sa.Column("client_name", sa.String(255)),
        sa.Column("website_url", sa.String(500)),
        sa.Column("instagram_url", sa.String(500)),
        sa.Column("tags", postgresql.JSONB(), server_default="[]"),
        sa.Column("order_val", sa.String(10), server_default="0"),
        sa.Column("published", sa.String(10), server_default="false"),
        sa.Column("created_at", sa.String(30)),
        sa.Column("updated_at", sa.String(30)),
        sa.Column("is_archived", sa.String(10), server_default="false"),
    )
    op.create_table(
        "tags",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("color", sa.String(50)),
        sa.Column("created_at", sa.String(30)),
        sa.Column("updated_at", sa.String(30)),
        sa.Column("is_archived", sa.String(10), server_default="false"),
    )
