"""RBAC: roles table, user.role_id, drop legacy user.role."""

from __future__ import annotations

import json

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision = "022_roles_rbac"
down_revision = "021_telegram_integration_state"
branch_labels = None
depends_on = None

ADMIN_ID = "00000000-0000-4000-8000-000000000001"
EMPLOYEE_ID = "00000000-0000-4000-8000-000000000002"

_EMPLOYEE_PERMS = [
    "core.home",
    "core.tasks",
    "core.inbox",
    "core.chat",
    "core.search",
    "core.meetings",
    "core.docs",
    "crm.spaces",
    "crm.sales_funnel",
    "crm.client_chats",
    "crm.clients",
    "org.inventory",
    "org.employees",
    "org.bpm",
    "finance.finance",
    "analytics.analytics",
    "settings.general",
]


def upgrade() -> None:
    op.create_table(
        "roles",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("slug", sa.String(length=60), nullable=False, unique=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_system", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("sort_order", sa.Integer(), server_default="0", nullable=False),
        sa.Column("permissions", sa.JSON(), nullable=False),
    )

    admin_json = json.dumps(["system.full_access"])
    emp_json = json.dumps(_EMPLOYEE_PERMS)

    op.execute(
        text(
            f"""
            INSERT INTO roles (id, name, slug, description, is_system, sort_order, permissions)
            VALUES (
                '{ADMIN_ID}',
                'Администратор',
                'admin',
                'Полный доступ ко всей системе',
                true,
                0,
                '{admin_json}'::json
            )
            """
        )
    )
    op.execute(
        text(
            f"""
            INSERT INTO roles (id, name, slug, description, is_system, sort_order, permissions)
            VALUES (
                '{EMPLOYEE_ID}',
                'Сотрудник',
                'employee',
                'Стандартный доступ без администрирования',
                true,
                10,
                '{emp_json}'::json
            )
            """
        )
    )

    op.add_column("users", sa.Column("role_id", sa.String(length=36), nullable=True))
    op.create_foreign_key("fk_users_role_id", "users", "roles", ["role_id"], ["id"])

    conn = op.get_bind()
    conn.execute(text("UPDATE users SET role_id = :aid WHERE UPPER(COALESCE(role, '')) = 'ADMIN'"), {"aid": ADMIN_ID})
    conn.execute(text("UPDATE users SET role_id = :eid WHERE role_id IS NULL"), {"eid": EMPLOYEE_ID})

    op.drop_column("users", "role")

    op.alter_column("users", "role_id", existing_type=sa.String(length=36), nullable=False)


def downgrade() -> None:
    op.add_column(
        "users",
        sa.Column("role", sa.String(length=20), server_default="EMPLOYEE", nullable=True),
    )
    conn = op.get_bind()
    conn.execute(
        text(
            """
            UPDATE users SET role = 'ADMIN'
            FROM roles r
            WHERE users.role_id = r.id AND r.slug = 'admin'
            """
        )
    )
    conn.execute(text("UPDATE users SET role = 'EMPLOYEE' WHERE role IS NULL"))
    op.alter_column("users", "role", existing_type=sa.String(length=20), nullable=False)

    op.drop_constraint("fk_users_role_id", "users", type_="foreignkey")
    op.drop_column("users", "role_id")
    op.drop_table("roles")
