"""Добавить department_id в finance_requests и перенести из comment-тегов.

Раньше department_id хранился как встроенный тег [departmentId:uuid] в поле comment.
Теперь — отдельная колонка; comment остаётся чистым пользовательским текстом.
"""

from __future__ import annotations

import re

import sqlalchemy as sa
from alembic import op

# ≤32 chars: alembic_version.version_num is VARCHAR(32)
revision = "064_finreq_department_id"
down_revision = "063_org_branding_logo_dark"
branch_labels = None
depends_on = None

_TAG_RE = re.compile(r"\[departmentId:([0-9a-fA-F-]{36})\]\s*")


def _extract_dept(comment: str | None) -> str | None:
    m = _TAG_RE.search(comment or "")
    return m.group(1) if m else None


def _strip_dept_tag(comment: str | None) -> str:
    return _TAG_RE.sub("", comment or "").strip()


def upgrade() -> None:
    op.add_column(
        "finance_requests",
        sa.Column("department_id", sa.String(36), nullable=True),
    )

    conn = op.get_bind()

    # Переносим department_id из comment в колонку и очищаем comment.
    rows = conn.execute(
        sa.text("SELECT id, comment FROM finance_requests WHERE comment LIKE '%[departmentId:%'")
    ).fetchall()

    for row_id, comment in rows:
        dept_id = _extract_dept(comment)
        clean_comment = _strip_dept_tag(comment) or None
        conn.execute(
            sa.text(
                "UPDATE finance_requests SET department_id = :dept, comment = :cmt WHERE id = :rid"
            ),
            {"dept": dept_id, "cmt": clean_comment, "rid": row_id},
        )


def downgrade() -> None:
    # При откате встраиваем department_id обратно в comment.
    conn = op.get_bind()
    rows = conn.execute(
        sa.text("SELECT id, comment, department_id FROM finance_requests WHERE department_id IS NOT NULL")
    ).fetchall()

    for row_id, comment, dept_id in rows:
        base = (comment or "").strip()
        tag = f"[departmentId:{dept_id}]"
        merged = f"{base}\n{tag}".strip() if base else tag
        conn.execute(
            sa.text("UPDATE finance_requests SET comment = :cmt WHERE id = :rid"),
            {"cmt": merged, "rid": row_id},
        )

    op.drop_column("finance_requests", "department_id")
