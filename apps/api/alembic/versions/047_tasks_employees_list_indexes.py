"""Индексы под keyset-листы GET /tasks и GET /employees.

- tasks: типичные фильтры table_id + is_archived + сортировка по created_at, id
- employee_infos: department_id + is_archived + сортировка по full_name (и seek по id)
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "047_tasks_employees_list_indexes"
down_revision: Union[str, None] = "046_finance_requests_created_id_idx"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "idx_tasks_table_archived_created_id",
        "tasks",
        ["table_id", "is_archived", "created_at", "id"],
    )
    op.create_index(
        "idx_employee_infos_dept_archived_fullname_id",
        "employee_infos",
        ["department_id", "is_archived", "full_name", "id"],
    )


def downgrade() -> None:
    op.drop_index("idx_employee_infos_dept_archived_fullname_id", table_name="employee_infos")
    op.drop_index("idx_tasks_table_archived_created_id", table_name="tasks")
