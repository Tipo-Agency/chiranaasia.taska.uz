"""RBAC: tasks.edit, crm.deals.edit, org.employees.edit в ролях admin и employee."""

from __future__ import annotations

import json

from alembic import op
from sqlalchemy import text

revision = "042_rbac_edit_permissions"
down_revision = "041_meetings_participants_jsonb"
branch_labels = None
depends_on = None

ADMIN_ID = "00000000-0000-4000-8000-000000000001"
EMPLOYEE_ID = "00000000-0000-4000-8000-000000000002"

_NEW = ("tasks.edit", "crm.deals.edit", "org.employees.edit")


def _merge_permissions(conn, role_id: str) -> None:
    row = conn.execute(text("SELECT permissions FROM roles WHERE id = :id"), {"id": role_id}).mappings().fetchone()
    if not row:
        return
    raw = row["permissions"]
    if isinstance(raw, str):
        perms = json.loads(raw)
    elif raw is None:
        perms = []
    else:
        perms = list(raw)
    for p in _NEW:
        if p not in perms:
            perms.append(p)
    conn.execute(
        text("UPDATE roles SET permissions = CAST(:j AS JSON) WHERE id = :id"),
        {"j": json.dumps(perms), "id": role_id},
    )


def upgrade() -> None:
    conn = op.get_bind()
    _merge_permissions(conn, ADMIN_ID)
    _merge_permissions(conn, EMPLOYEE_ID)


def downgrade() -> None:
    conn = op.get_bind()
    for role_id in (ADMIN_ID, EMPLOYEE_ID):
        row = conn.execute(text("SELECT permissions FROM roles WHERE id = :id"), {"id": role_id}).mappings().fetchone()
        if not row:
            continue
        raw = row["permissions"]
        if isinstance(raw, str):
            perms = json.loads(raw)
        elif raw is None:
            perms = []
        else:
            perms = list(raw)
        perms = [p for p in perms if p not in _NEW]
        conn.execute(
            text("UPDATE roles SET permissions = CAST(:j AS JSON) WHERE id = :id"),
            {"j": json.dumps(perms), "id": role_id},
        )
