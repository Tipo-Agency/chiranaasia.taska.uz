"""Funnel notification templates, meeting project_id, user calendar export token."""

from alembic import op
import sqlalchemy as sa

revision = "023_funnel_notifications_meeting_project_cal_feed"
down_revision = "022_roles_rbac"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("sales_funnels", sa.Column("notification_templates", sa.JSON(), nullable=True))
    op.add_column("meetings", sa.Column("project_id", sa.String(length=36), nullable=True))
    op.add_column("users", sa.Column("calendar_export_token", sa.String(length=36), nullable=True))
    op.create_index("ix_users_calendar_export_token", "users", ["calendar_export_token"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_users_calendar_export_token", table_name="users")
    op.drop_column("users", "calendar_export_token")
    op.drop_column("meetings", "project_id")
    op.drop_column("sales_funnels", "notification_templates")
