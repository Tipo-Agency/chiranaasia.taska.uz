"""Сотрудники: full_name, status, user_id опционально; должность/найм nullable.

Revision ID: 037_employee_full_name_status_optional_user
Revises: 036_bdr_year_unique
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "037_employee_fullname_status"
down_revision: Union[str, None] = "036_bdr_year_unique"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "employee_infos",
        sa.Column("full_name", sa.String(255), nullable=False, server_default=""),
    )
    op.add_column(
        "employee_infos",
        sa.Column("status", sa.String(50), nullable=False, server_default="active"),
    )
    conn = op.get_bind()
    conn.execute(
        sa.text("""
            UPDATE employee_infos
            SET full_name = COALESCE(NULLIF(TRIM(COALESCE(position, '')), ''), 'Сотрудник')
        """)
    )
    op.alter_column("employee_infos", "user_id", existing_type=sa.String(length=36), nullable=True)
    op.alter_column(
        "employee_infos",
        "position",
        existing_type=sa.String(length=255),
        nullable=True,
    )
    op.alter_column(
        "employee_infos",
        "hire_date",
        existing_type=sa.String(length=20),
        nullable=True,
    )
    conn.execute(
        sa.text(
            """
            UPDATE employee_infos e
            SET user_id = NULL
            WHERE user_id IS NOT NULL
              AND (
                btrim(user_id) = ''
                OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = e.user_id)
              )
            """
        )
    )
    op.create_foreign_key(
        "fk_employee_infos_user_id_users",
        "employee_infos",
        "users",
        ["user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.alter_column("employee_infos", "full_name", server_default=None)


def downgrade() -> None:
    op.drop_constraint("fk_employee_infos_user_id_users", "employee_infos", type_="foreignkey")
    op.alter_column(
        "employee_infos",
        "hire_date",
        existing_type=sa.String(length=20),
        nullable=False,
    )
    op.alter_column(
        "employee_infos",
        "position",
        existing_type=sa.String(length=255),
        nullable=False,
    )
    op.alter_column("employee_infos", "user_id", existing_type=sa.String(length=36), nullable=False)
    op.drop_column("employee_infos", "status")
    op.drop_column("employee_infos", "full_name")
