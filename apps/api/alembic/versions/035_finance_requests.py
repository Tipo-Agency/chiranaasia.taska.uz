"""Таблица finance_requests (NUMERIC 15,2), перенос данных из purchase_requests."""

from __future__ import annotations

import re
from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "035_finance_requests"
down_revision: Union[str, None] = "034_mtproto_sessions_encrypted"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_PAY_TAG = re.compile(r"\[paymentDate:([0-9]{4}-[0-9]{2}-[0-9]{2})\]")


def _parse_amount(raw: str | None) -> Decimal:
    if not raw or not str(raw).strip():
        return Decimal("0.00")
    s = str(raw).strip().replace(",", ".")
    try:
        return Decimal(s).quantize(Decimal("0.01"))
    except InvalidOperation:
        return Decimal("0.00")


def _map_status(raw: str | None) -> str:
    s = (raw or "").strip().lower()
    if s in ("pending", "approved", "rejected", "paid", "draft"):
        return s
    if s == "deferred":
        return "draft"
    return "draft"


def _parse_payment_from_desc(desc: str | None) -> date | None:
    if not desc:
        return None
    m = _PAY_TAG.search(desc)
    if not m:
        return None
    try:
        return date.fromisoformat(m.group(1))
    except ValueError:
        return None


def _parse_created_at(d: str | None) -> datetime:
    if d and str(d).strip():
        s = str(d).strip()[:32]
        try:
            if len(s) >= 10 and s[4] == "-" and s[7] == "-":
                if "T" in s or " " in s:
                    return datetime.fromisoformat(s.replace("Z", "+00:00"))
                return datetime.combine(date.fromisoformat(s[:10]), datetime.min.time()).replace(tzinfo=timezone.utc)
        except ValueError:
            pass
    return datetime.now(timezone.utc)


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if insp.has_table("finance_requests") and not insp.has_table("purchase_requests"):
        return

    op.create_table(
        "finance_requests",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("amount", sa.Numeric(15, 2), nullable=False),
        sa.Column("currency", sa.String(10), nullable=False, server_default="UZS"),
        sa.Column("category", sa.String(100), nullable=True),
        sa.Column("counterparty", sa.String(255), nullable=True),
        sa.Column("requested_by", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("approved_by", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="draft"),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("payment_date", sa.Date(), nullable=True),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.CheckConstraint(
            "status IN ('draft','pending','approved','rejected','paid')",
            name="chk_finance_requests_status",
        ),
    )
    op.create_index("idx_finance_requests_status", "finance_requests", ["status"])
    op.create_index("idx_finance_requests_requested_by", "finance_requests", ["requested_by", "created_at"])

    insp2 = sa.inspect(bind)
    if not insp2.has_table("purchase_requests"):
        return

    rows = bind.execute(
        sa.text(
            "SELECT id, requester_id, department_id, category_id, amount, description, status, date, "
            "decision_date, is_archived FROM purchase_requests"
        )
    ).mappings().all()
    existing_user_ids = {
        str(r[0])
        for r in bind.execute(sa.text("SELECT id FROM users")).fetchall()
        if r and r[0] is not None
    }

    for pr in rows:
        desc = (pr.get("description") or "").strip()
        first_line = (desc.split("\n")[0] or "").strip()[:500] if desc else ""
        title = first_line or "Заявка"
        pay_d = _parse_payment_from_desc(desc)
        amt = _parse_amount(pr.get("amount"))
        st = _map_status(pr.get("status"))
        rid = str(pr.get("id") or "")
        req_by_raw = str(pr.get("requester_id") or "").strip() or None
        req_by = req_by_raw if req_by_raw in existing_user_ids else None
        cat = (str(pr.get("category_id") or "").strip() or None)
        dept = (str(pr.get("department_id") or "").strip() or None)
        comment_parts = [desc] if desc else []
        if dept:
            comment_parts.append(f"[departmentId:{dept}]")
        comment = "\n".join(comment_parts).strip() or None
        created = _parse_created_at(pr.get("date"))
        is_arch = bool(pr.get("is_archived"))

        bind.execute(
            sa.text(
                """
                INSERT INTO finance_requests (
                    id, title, amount, currency, category, counterparty, requested_by, approved_by,
                    status, comment, payment_date, paid_at, created_at, updated_at, is_archived
                ) VALUES (
                    :id, :title, :amount, 'UZS', :category, NULL, :requested_by, NULL,
                    :status, :comment, :payment_date, NULL, :created_at, NULL, :is_archived
                )
                """
            ),
            {
                "id": rid,
                "title": title[:500],
                "amount": amt,
                "category": cat,
                "requested_by": req_by,
                "status": st,
                "comment": comment,
                "payment_date": pay_d,
                "created_at": created,
                "is_archived": is_arch,
            },
        )

    op.drop_table("purchase_requests")


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if not insp.has_table("finance_requests"):
        return

    op.create_table(
        "purchase_requests",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("requester_id", sa.String(36), nullable=False, server_default=""),
        sa.Column("department_id", sa.String(36), nullable=False, server_default=""),
        sa.Column("category_id", sa.String(36), nullable=False, server_default=""),
        sa.Column("amount", sa.String(50), nullable=False, server_default="0"),
        sa.Column("description", sa.String(500), nullable=False, server_default=""),
        sa.Column("status", sa.String(30), nullable=False, server_default="pending"),
        sa.Column("date", sa.String(50), nullable=False, server_default=""),
        sa.Column("decision_date", sa.String(50), nullable=True),
        sa.Column("is_archived", sa.Boolean(), server_default=sa.text("false")),
    )

    rows = bind.execute(
        sa.text(
            "SELECT id, title, amount, category, comment, status, created_at, is_archived, requested_by "
            "FROM finance_requests"
        )
    ).mappings().all()

    _dept_tag = re.compile(r"\[departmentId:([0-9a-fA-F-]{36})\]")

    for r in rows:
        cmt = r.get("comment") or ""
        dm = _dept_tag.search(cmt)
        dept = dm.group(1) if dm else ""
        desc = (cmt or "")[:500]
        amt = str(r.get("amount") or "0")
        d = r.get("created_at")
        date_s = d.isoformat()[:10] if hasattr(d, "isoformat") else str(d or "")

        bind.execute(
            sa.text(
                """
                INSERT INTO purchase_requests (
                    id, requester_id, department_id, category_id, amount, description, status, date,
                    decision_date, is_archived
                ) VALUES (
                    :id, :requester_id, :department_id, :category_id, :amount, :description, :status, :date,
                    NULL, :is_archived
                )
                """
            ),
            {
                "id": str(r.get("id")),
                "requester_id": str(r.get("requested_by") or ""),
                "department_id": dept,
                "category_id": str(r.get("category") or ""),
                "amount": amt,
                "description": desc,
                "status": str(r.get("status") or "pending"),
                "date": date_s,
                "is_archived": bool(r.get("is_archived")),
            },
        )

    op.drop_index("idx_finance_requests_requested_by", table_name="finance_requests")
    op.drop_index("idx_finance_requests_status", table_name="finance_requests")
    op.drop_table("finance_requests")
