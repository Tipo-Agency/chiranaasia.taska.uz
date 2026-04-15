"""RBAC: у ролей с crm.sales_funnel добавить crm.deals.edit (если нет) — UI и bulk PUT согласованы с воронкой."""

from __future__ import annotations

import json

from alembic import op
from sqlalchemy import text

revision = "052_rbac_deals_edit_funnel"
down_revision = "051_cp_platform_jsonb"
branch_labels = None
depends_on = None

SF = "crm.sales_funnel"
EDIT = "crm.deals.edit"
FULL = "system.full_access"


def _parse_perms(raw: object) -> list[str]:
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            return []
        return [str(x) for x in parsed] if isinstance(parsed, list) else []
    if raw is None:
        return []
    if isinstance(raw, list):
        return [str(x) for x in raw]
    return []


def upgrade() -> None:
    conn = op.get_bind()
    rows = conn.execute(text("SELECT id, slug, permissions FROM roles")).mappings().fetchall()
    for row in rows or []:
        slug = (row.get("slug") or "").strip().lower()
        if slug == "admin":
            continue
        perms = _parse_perms(row.get("permissions"))
        if FULL in perms or EDIT in perms or SF not in perms:
            continue
        perms.append(EDIT)
        conn.execute(
            text("UPDATE roles SET permissions = CAST(:j AS JSON) WHERE id = :id"),
            {"j": json.dumps(perms), "id": row["id"]},
        )


def downgrade() -> None:
    """Не откатываем права в JSON (риск затронуть ручные правки)."""
    pass
