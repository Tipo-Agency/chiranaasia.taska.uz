"""Шаги BPM в отдельных таблицах (не JSONB на business_processes).

Revision ID: 039_business_process_steps_tables
Revises: 038_departments_parent_id
"""
from __future__ import annotations

import json
import uuid
from typing import Any, Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import text
from sqlalchemy.dialects import postgresql

revision: str = "039_business_process_steps_tables"
down_revision: Union[str, None] = "038_departments_parent_id"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _normalize_steps(raw: Any) -> list[dict[str, Any]]:
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
    if isinstance(raw, dict):
        return []
    return []


def upgrade() -> None:
    op.create_table(
        "business_process_steps",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("bp_id", sa.String(length=36), sa.ForeignKey("business_processes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("role", sa.String(length=50), nullable=False, server_default="user"),
        sa.Column("assignee_id", sa.String(length=36), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("description", sa.String(length=500), nullable=True),
        sa.Column("step_type", sa.String(length=20), nullable=False, server_default="normal"),
        sa.Column("next_step_id", sa.String(length=36), nullable=True),
    )
    op.create_index("ix_business_process_steps_bp_position", "business_process_steps", ["bp_id", "position"])

    op.create_table(
        "business_process_step_branches",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "step_id",
            sa.String(length=36),
            sa.ForeignKey("business_process_steps.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("label", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("next_step_id", sa.String(length=36), nullable=False),
    )
    op.create_index("ix_bp_step_branches_step_id", "business_process_step_branches", ["step_id"])

    conn = op.get_bind()
    res = conn.execute(text("SELECT id, steps FROM business_processes"))
    rows = res.fetchall()
    for bp_id, steps_raw in rows:
        for st in _normalize_steps(steps_raw):
            sid = (str(st.get("id") or "").strip() or str(uuid.uuid4()))[:36]
            try:
                position = int(st.get("order") or 0)
            except (TypeError, ValueError):
                position = 0
            role = (str(st.get("assigneeType") or "user"))[:50]
            aid = st.get("assigneeId")
            assignee_id = (str(aid).strip()[:36] if aid is not None and str(aid).strip() else None)
            title = (str(st.get("title") or ""))[:255]
            desc = st.get("description")
            description = (str(desc).strip()[:500] if desc is not None and str(desc).strip() else None)
            step_type = (str(st.get("stepType") or "normal"))[:20]
            ns = st.get("nextStepId")
            next_step_id = (str(ns).strip()[:36] if ns is not None and str(ns).strip() else None)
            conn.execute(
                text(
                    """
                    INSERT INTO business_process_steps
                    (id, bp_id, "position", role, assignee_id, title, description, step_type, next_step_id)
                    VALUES (:id, :bp_id, :position, :role, :assignee_id, :title, :description, :step_type, :next_step_id)
                    """
                ),
                {
                    "id": sid,
                    "bp_id": bp_id,
                    "position": position,
                    "role": role,
                    "assignee_id": assignee_id,
                    "title": title,
                    "description": description,
                    "step_type": step_type,
                    "next_step_id": next_step_id,
                },
            )
            for br in st.get("branches") or []:
                if not isinstance(br, dict):
                    continue
                brid = (str(br.get("id") or "").strip() or str(uuid.uuid4()))[:36]
                label = (str(br.get("label") or ""))[:255]
                nxt = str(br.get("nextStepId") or "").strip()
                if not nxt:
                    continue
                conn.execute(
                    text(
                        """
                        INSERT INTO business_process_step_branches (id, step_id, label, next_step_id)
                        VALUES (:id, :step_id, :label, :next_step_id)
                        """
                    ),
                    {"id": brid, "step_id": sid, "label": label, "next_step_id": nxt[:36]},
                )

    op.drop_column("business_processes", "steps")


def downgrade() -> None:
    op.add_column(
        "business_processes",
        sa.Column("steps", postgresql.JSONB(astext_type=sa.Text()), server_default="[]", nullable=True),
    )
    op.execute(sa.text("UPDATE business_processes SET steps = '[]'::jsonb"))
    op.drop_index("ix_bp_step_branches_step_id", table_name="business_process_step_branches")
    op.drop_table("business_process_step_branches")
    op.drop_index("ix_business_process_steps_bp_position", table_name="business_process_steps")
    op.drop_table("business_process_steps")
