"""БДР: нормализация строк JSONB и пересчёт итогов (только в ответе API, не в БД)."""

from __future__ import annotations

import uuid
from typing import Any


def _to_float(v: Any) -> float:
    if v is None:
        return 0.0
    if isinstance(v, bool):
        return float(v)
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip().replace(" ", "").replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return 0.0


def _month_keys_for_year(year: str) -> list[str]:
    y = (year or "").strip()[:4]
    if not y.isdigit() or len(y) != 4:
        return []
    return [f"{y}-{m:02d}" for m in range(1, 13)]


def sanitize_bdr_rows(raw_rows: Any, *, year: str) -> list[dict[str, Any]]:
    """Только поля строки БДР; лишние ключи (в т.ч. клиентские totals) отбрасываются."""
    allowed_months = set(_month_keys_for_year(year))
    out: list[dict[str, Any]] = []
    if not isinstance(raw_rows, list):
        return out
    for r in raw_rows:
        if not isinstance(r, dict):
            continue
        rid = str(r.get("id") or "").strip() or str(uuid.uuid4())
        rid = rid[:36]
        name = str(r.get("name") or "")[:500]
        t = r.get("type")
        if t not in ("income", "expense"):
            t = "expense"
        amounts: dict[str, float] = {}
        am = r.get("amounts")
        if isinstance(am, dict):
            for k, v in am.items():
                ks = str(k).strip()[:7]
                if ks in allowed_months:
                    amounts[ks] = _to_float(v)
        out.append({"id": rid, "name": name, "type": t, "amounts": amounts})
    return out


def compute_bdr_totals_by_month(year: str, rows: list[dict[str, Any]]) -> dict[str, dict[str, float]]:
    """Суммы по календарным месяцам года (ключ YYYY-MM)."""
    months = _month_keys_for_year(year)
    out: dict[str, dict[str, float]] = {
        m: {"income": 0.0, "expense": 0.0, "profit": 0.0} for m in months
    }
    for item in rows:
        t = item.get("type")
        am = item.get("amounts")
        if not isinstance(am, dict):
            continue
        for mk, raw in am.items():
            key = str(mk).strip()[:7]
            if key not in out:
                continue
            val = _to_float(raw)
            if t == "income":
                out[key]["income"] += val
            elif t == "expense":
                out[key]["expense"] += val
    for m in months:
        out[m]["profit"] = out[m]["income"] - out[m]["expense"]
    return out


def build_bdr_totals_payload(year: str, rows: list[dict[str, Any]]) -> dict[str, Any]:
    """Итоги для JSON-ответа: помесячно + за год (сумма месяцев)."""
    by_month = compute_bdr_totals_by_month(year, rows)
    yi = sum(v["income"] for v in by_month.values())
    ye = sum(v["expense"] for v in by_month.values())
    return {
        "byMonth": by_month,
        "year": {"income": yi, "expense": ye, "profit": yi - ye},
    }


def bdr_get_response(year: str, rows_raw: Any) -> dict[str, Any]:
    rows = sanitize_bdr_rows(rows_raw, year=year)
    return {
        "year": year,
        "rows": rows,
        "totals": build_bdr_totals_payload(year, rows),
    }
