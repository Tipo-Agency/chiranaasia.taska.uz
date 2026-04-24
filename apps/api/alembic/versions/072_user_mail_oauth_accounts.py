"""Таблица user_mail_oauth — OAuth2 к почте (Gmail) на пользователя.

Revision ID: 072_user_mail_oauth_accounts
Revises: 071_po_purchase_req_id
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "072_user_mail_oauth_accounts"
down_revision = "071_po_purchase_req_id"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_mail_oauth_accounts",
        sa.Column("id", sa.String(36), primary_key=True, nullable=False),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("provider", sa.String(32), nullable=False),
        sa.Column("account_email", sa.String(320), nullable=False),
        sa.Column("refresh_token_encrypted", sa.Text(), nullable=False),
        sa.Column("access_token_encrypted", sa.Text(), nullable=True),
        sa.Column("token_expires_at", sa.String(50), nullable=True),
        sa.Column("scopes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.String(50), nullable=False),
        sa.Column("updated_at", sa.String(50), nullable=True),
    )
    op.create_index("ix_user_mail_oauth_accounts_user_id", "user_mail_oauth_accounts", ["user_id"])
    op.create_index(
        "ix_user_mail_oauth_user_provider",
        "user_mail_oauth_accounts",
        ["user_id", "provider"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_user_mail_oauth_user_provider", table_name="user_mail_oauth_accounts")
    op.drop_index("ix_user_mail_oauth_accounts_user_id", table_name="user_mail_oauth_accounts")
    op.drop_table("user_mail_oauth_accounts")
