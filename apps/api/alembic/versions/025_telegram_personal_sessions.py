"""Telegram personal account (MTProto) session per user — CRM replies from own TG."""

from alembic import op
import sqlalchemy as sa

revision = "025_telegram_personal"
down_revision = "024_shoot_plans"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "telegram_personal_sessions",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="inactive"),
        sa.Column("encrypted_session", sa.Text(), nullable=True),
        sa.Column("pending_phone", sa.String(length=32), nullable=True),
        sa.Column("pending_phone_code_hash", sa.String(length=255), nullable=True),
        sa.Column("phone_masked", sa.String(length=16), nullable=True),
        sa.Column("created_at", sa.String(length=50), nullable=True),
        sa.Column("updated_at", sa.String(length=50), nullable=True),
    )
    op.create_index("ix_telegram_personal_sessions_user_id", "telegram_personal_sessions", ["user_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_telegram_personal_sessions_user_id", table_name="telegram_personal_sessions")
    op.drop_table("telegram_personal_sessions")
