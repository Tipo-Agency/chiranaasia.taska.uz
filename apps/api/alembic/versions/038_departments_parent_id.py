"""Отделы: parent_id (дерево подразделений).

Revision ID: 038_departments_parent_id
Revises: 037_employee_full_name_status_optional_user
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "038_departments_parent_id"
down_revision: Union[str, None] = "037_employee_full_name_status_optional_user"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("departments", sa.Column("parent_id", sa.String(length=36), nullable=True))
    op.create_foreign_key(
        "fk_departments_parent_id_departments",
        "departments",
        "departments",
        ["parent_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_departments_parent_id_departments", "departments", type_="foreignkey")
    op.drop_column("departments", "parent_id")
