"""Shoot plans + meeting.shoot_plan_id for calendar sync."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "024_shoot_plans"
down_revision = "023_funnel_notifications_meeting_project_cal_feed"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "shoot_plans",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("table_id", sa.String(length=36), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("date", sa.String(length=50), nullable=False),
        sa.Column("time", sa.String(length=10), nullable=False, server_default="10:00"),
        sa.Column("participant_ids", postgresql.JSONB(astext_type=sa.Text()), server_default="[]"),
        sa.Column("items", postgresql.JSONB(astext_type=sa.Text()), server_default="[]"),
        sa.Column("meeting_id", sa.String(length=36), nullable=True),
        sa.Column("is_archived", sa.Boolean(), server_default="false"),
    )
    op.create_index("ix_shoot_plans_table_id", "shoot_plans", ["table_id"])
    op.add_column("meetings", sa.Column("shoot_plan_id", sa.String(length=36), nullable=True))


def downgrade() -> None:
    op.drop_column("meetings", "shoot_plan_id")
    op.drop_index("ix_shoot_plans_table_id", table_name="shoot_plans")
    op.drop_table("shoot_plans")
