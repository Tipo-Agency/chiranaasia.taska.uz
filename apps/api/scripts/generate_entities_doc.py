#!/usr/bin/env python3
"""Generate docs/ENTITIES.md from SQLAlchemy models (tables and columns).

Run from repo: cd apps/api && PYTHONPATH=. python scripts/generate_entities_doc.py
"""
from __future__ import annotations

import sys
from pathlib import Path

_API_ROOT = Path(__file__).resolve().parents[1]
if str(_API_ROOT) not in sys.path:
    sys.path.insert(0, str(_API_ROOT))

import app.models  # noqa: F401 — register all mappers
from app.db import Base

REPO_ROOT = Path(__file__).resolve().parents[3]
OUT_PATH = REPO_ROOT / "docs" / "ENTITIES.md"


def _class_name_for_table(table) -> str | None:
    for mapper in Base.registry.mappers:
        t = mapper.persist_selectable
        if getattr(t, "name", None) == table.name and getattr(t, "schema", None) == getattr(
            table, "schema", None
        ):
            return mapper.class_.__name__
    return None


def _fmt_default(col) -> str:
    if col.server_default is not None:
        d = col.server_default
        arg = getattr(d, "arg", None)
        if arg is not None:
            return str(arg)
        return str(d)
    if col.default is not None:
        d = col.default
        arg = getattr(d, "arg", None)
        if callable(arg):
            fn = getattr(arg, "__name__", None)
            return f"`{fn}()`" if fn else "`callable`"
        if arg is not None:
            return f"`{arg!r}`"
        return repr(d)
    return "—"


def _fmt_fks(col) -> str:
    parts = []
    for fk in col.foreign_keys:
        parts.append(f"{fk.column.table.name}.{fk.column.name}")
    return ", ".join(parts) if parts else "—"


def _markdown() -> str:
    lines: list[str] = [
        "# Сущности БД (таблицы и поля)",
        "",
        "Документ **генерируется** скриптом `apps/api/scripts/generate_entities_doc.py` из SQLAlchemy-моделей.",
        "Источник правды — код в `apps/api/app/models/`. Поля в JSON API могут отличаться (см. Pydantic-схемы в роутерах и `GET /openapi.json`).",
        "",
    ]

    tables = sorted(Base.metadata.tables.values(), key=lambda t: t.name)
    for table in tables:
        cls = _class_name_for_table(table)
        title = f"`{table.name}`"
        if cls:
            title = f"{title} — **{cls}**"
        lines.append(f"## {title}")
        lines.append("")
        lines.append("| Поле | Тип | PK | NULL | FK → | По умолчанию |")
        lines.append("| --- | --- | --- | --- | --- | --- |")
        for col in table.columns:
            pk = "да" if col.primary_key else "—"
            null = "да" if col.nullable else "нет"
            lines.append(
                "| "
                + " | ".join(
                    [
                        f"`{col.name}`",
                        f"`{col.type}`",
                        pk,
                        null,
                        _fmt_fks(col),
                        _fmt_default(col).replace("|", "\\|"),
                    ]
                )
                + " |"
            )
        lines.append("")

    return "\n".join(lines).rstrip() + "\n"


def main() -> None:
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(_markdown(), encoding="utf-8")
    print(f"Wrote {OUT_PATH}")


if __name__ == "__main__":
    main()
