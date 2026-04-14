"""Экземпляры BPM в таблице bp_instances (current_step_id, context JSONB, status).

Revision ID: 040_bp_instances_table
Revises: 039_business_process_steps_tables
"""
from __future__ import annotations

import json
from typing import Any, Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import text
from sqlalchemy.dialects import postgresql

revision: str = "040_bp_instances_table"
down_revision: Union[str, None] = "039_bp_steps_tables"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _normalize_instances(raw: Any) -> list[dict[str, Any]]:
    if raw is None:
        return []
    if isinstance(raw, list):
        return [x for x in raw if isinstance(x, dict)]
    if isinstance(raw, str):
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            return []
        return [x for x in data if isinstance(x, dict)] if isinstance(data, list) else []
    return []


def upgrade() -> None:
    op.create_table(
        "bp_instances",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("bp_id", sa.String(length=36), sa.ForeignKey("business_processes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("current_step_id", sa.String(length=36), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("context", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
    )
    op.create_index("ix_bp_instances_bp_id", "bp_instances", ["bp_id"])
    op.create_index("ix_bp_instances_status", "bp_instances", ["status"])

    conn = op.get_bind()
    rows = conn.execute(text("SELECT id, instances FROM business_processes")).fetchall()
    for bp_id, inst_raw in rows:
        for inst in _normalize_instances(inst_raw):
            iid = str(inst.get("id") or "").strip()[:36]
            if not iid:
                continue
            cur = inst.get("currentStepId")
            if cur is not None and str(cur).strip() == "":
                cur = None
            else:
                cur = str(cur).strip()[:36] if cur is not None else None
            status = str(inst.get("status") or "active").strip()[:30] or "active"
            ctx = {k: v for k, v in inst.items() if k not in ("id", "processId", "currentStepId", "status")}
            conn.execute(
                text(
                    """
                    INSERT INTO bp_instances (id, bp_id, current_step_id, status, context)
                    VALUES (:id, :bp_id, :current_step_id, :status, CAST(:context AS jsonb))
                    """
                ),
                {
                    "id": iid,
                    "bp_id": bp_id,
                    "current_step_id": cur,
                    "status": status,
                    "context": json.dumps(ctx, default=str),
                },
            )

    op.drop_column("business_processes", "instances")


def downgrade() -> None:
    op.add_column(
        "business_processes",
        sa.Column("instances", postgresql.JSONB(astext_type=sa.Text()), server_default="[]", nullable=True),
    )
    op.execute(sa.text("UPDATE business_processes SET instances = '[]'::jsonb"))
    op.drop_index("ix_bp_instances_status", table_name="bp_instances")
    op.drop_index("ix_bp_instances_bp_id", table_name="bp_instances")
    op.drop_table("bp_instances")
