"""employee org_position_id; org position task assignee mode + round-robin cursor."""

from alembic import op
import sqlalchemy as sa


revision = "016_employee_org_position"
down_revision = "015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("employee_infos", sa.Column("org_position_id", sa.String(36), nullable=True))
    op.add_column(
        "org_positions",
        sa.Column("task_assignee_mode", sa.String(20), nullable=False, server_default="round_robin"),
    )
    op.add_column("org_positions", sa.Column("last_task_assignee_user_id", sa.String(36), nullable=True))

    # Backfill: должность с holder → сотрудник с таким user_id получает org_position_id
    op.execute(
        """
        UPDATE employee_infos e
        SET org_position_id = p.id
        FROM org_positions p
        WHERE p.holder_user_id IS NOT NULL
          AND e.user_id = p.holder_user_id
          AND e.is_archived IS NOT TRUE
        """
    )


def downgrade() -> None:
    op.drop_column("org_positions", "last_task_assignee_user_id")
    op.drop_column("org_positions", "task_assignee_mode")
    op.drop_column("employee_infos", "org_position_id")
