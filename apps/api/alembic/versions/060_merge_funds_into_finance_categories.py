"""Слияние funds → finance_categories; перенос ключей в JSON бюджета/планов."""

from __future__ import annotations

import json
from typing import Any

import sqlalchemy as sa
from alembic import op

revision = "060_funds_merge_categories"
down_revision = "059_fin_plan_week_breakdown"
branch_labels = None
depends_on = None


def _norm_name(s: str | None) -> str:
    return (s or "").strip().lower()


def _parse_int(v: Any, default: int = 0) -> int:
    try:
        return int(str(v).strip())
    except (TypeError, ValueError):
        return default


def _as_money_map(obj: Any) -> dict[str, Any]:
    if isinstance(obj, dict):
        return {str(k): v for k, v in obj.items()}
    return {}


def _remap_money_keys(d: Any, m: dict[str, str]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for k, v in _as_money_map(d).items():
        nk = m.get(k, k)
        try:
            prev = float(out.get(nk, 0) or 0)
        except (TypeError, ValueError):
            prev = 0
        try:
            add = float(v)
        except (TypeError, ValueError):
            add = 0
        out[nk] = prev + add
    return out


def _remap_request_funds(rmap: Any, m: dict[str, str]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for rid, fid in _as_money_map(rmap).items():
        out[str(rid)] = m.get(str(fid), str(fid))
    return out


def _remap_movements(raw: Any, m: dict[str, str]) -> list[dict[str, Any]]:
    if not isinstance(raw, list):
        return []
    out: list[dict[str, Any]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        d = dict(item)
        for key in ("fromFundId", "toFundId"):
            if key in d and d[key] is not None:
                old = str(d[key])
                d[key] = m.get(old, old)
        out.append(d)
    return out


def _remap_week_breakdown(raw: Any, m: dict[str, str]) -> Any:
    if not isinstance(raw, list):
        return raw
    out: list[Any] = []
    for slice_ in raw:
        if not isinstance(slice_, dict):
            out.append(slice_)
            continue
        d = dict(slice_)
        if "expenses" in d:
            d["expenses"] = _remap_money_keys(d.get("expenses"), m)
        out.append(d)
    return out


def upgrade() -> None:
    op.add_column(
        "finance_categories",
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "finance_categories",
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )

    conn = op.get_bind()

    funds_rows = conn.execute(sa.text("SELECT id, name, order_val, COALESCE(is_archived, false) AS ia FROM funds")).mappings().all()
    cats_rows = conn.execute(sa.text("SELECT id, name FROM finance_categories")).mappings().all()
    cats_by_norm: dict[str, str] = {_norm_name(r["name"]): str(r["id"]) for r in cats_rows}

    fund_to_cat: dict[str, str] = {}
    for f in funds_rows:
        fid = str(f["id"])
        nm = str(f["name"])
        order_v = _parse_int(f.get("order_val"), 0)
        ia = bool(f.get("ia"))

        nn = _norm_name(nm)
        target = cats_by_norm.get(nn)
        if target:
            fund_to_cat[fid] = target
            conn.execute(
                sa.text(
                    "UPDATE finance_categories SET sort_order = GREATEST(COALESCE(sort_order, 0), :so) WHERE id = :cid"
                ),
                {"so": max(0, order_v), "cid": target},
            )
        else:
            conn.execute(
                sa.text(
                    "INSERT INTO finance_categories (id, name, type, value, color, sort_order, is_archived) "
                    "VALUES (:id, :name, 'fixed', NULL, NULL, :so, :ia)"
                ),
                {"id": fid, "name": nm, "so": max(0, order_v), "ia": ia},
            )
            fund_to_cat[fid] = fid

    if fund_to_cat:
        for row in conn.execute(
            sa.text(
                "SELECT id, fund_allocations, request_fund_ids, fund_movements, expense_distribution "
                "FROM financial_plannings"
            )
        ).mappings().all():
            pid = str(row["id"])
            fa = _remap_money_keys(row["fund_allocations"], fund_to_cat)
            rf = _remap_request_funds(row["request_fund_ids"], fund_to_cat)
            fm = _remap_movements(row["fund_movements"], fund_to_cat)
            ed = _remap_money_keys(row["expense_distribution"], fund_to_cat)
            conn.execute(
                sa.text(
                    "UPDATE financial_plannings SET fund_allocations = CAST(:fa AS jsonb), "
                    "request_fund_ids = CAST(:rf AS jsonb), fund_movements = CAST(:fm AS jsonb), "
                    "expense_distribution = CAST(:ed AS jsonb) WHERE id = :pid"
                ),
                {
                    "fa": json.dumps(fa),
                    "rf": json.dumps(rf),
                    "fm": json.dumps(fm),
                    "ed": json.dumps(ed),
                    "pid": pid,
                },
            )

        for row in conn.execute(
            sa.text("SELECT id, expenses, week_breakdown FROM financial_plan_documents")
        ).mappings().all():
            pid = str(row["id"])
            ex = _remap_money_keys(row["expenses"], fund_to_cat)
            wb = _remap_week_breakdown(row["week_breakdown"], fund_to_cat)
            conn.execute(
                sa.text(
                    "UPDATE financial_plan_documents SET expenses = CAST(:ex AS jsonb), "
                    "week_breakdown = CAST(:wb AS jsonb) WHERE id = :pid"
                ),
                {"ex": json.dumps(ex), "wb": json.dumps(wb), "pid": pid},
            )

        for old_id, new_id in fund_to_cat.items():
            if old_id == new_id:
                continue
            conn.execute(
                sa.text("UPDATE finance_requests SET category = :new WHERE category = :old"),
                {"new": new_id, "old": old_id},
            )

    op.drop_table("funds")

    op.alter_column("finance_categories", "sort_order", server_default=None)


def downgrade() -> None:
    op.create_table(
        "funds",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("order_val", sa.String(length=10), server_default="0"),
        sa.Column("is_archived", sa.Boolean(), server_default=sa.text("false")),
    )
    op.drop_column("finance_categories", "is_archived")
    op.drop_column("finance_categories", "sort_order")
