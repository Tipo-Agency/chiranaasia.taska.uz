"""clients.tags: привести json/jsonb к text[] (ORM ожидает ARRAY(Text))."""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "050_clients_tags_array"
down_revision: str | None = "049_schema_repair"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind is None:
        return

    row = bind.execute(
        sa.text("""
            SELECT data_type, udt_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'clients'
              AND column_name = 'tags'
        """)
    ).fetchone()
    if not row:
        return

    data_type, udt_name = row[0], row[1]
    # Уже text[]
    if str(data_type).upper() == "ARRAY" and str(udt_name) == "_text":
        return

    # jsonb → text[]
    if str(udt_name) == "jsonb":
        op.execute(sa.text("ALTER TABLE clients ALTER COLUMN tags DROP DEFAULT"))
        op.execute(
            sa.text("""
                ALTER TABLE clients
                  ALTER COLUMN tags TYPE text[]
                  USING (
                    CASE
                      WHEN tags IS NULL THEN ARRAY[]::text[]
                      WHEN jsonb_typeof(tags) = 'array' THEN COALESCE(
                        ARRAY(SELECT jsonb_array_elements_text(tags)),
                        ARRAY[]::text[]
                      )
                      ELSE ARRAY[]::text[]
                    END
                  )
            """)
        )
        op.execute(sa.text("ALTER TABLE clients ALTER COLUMN tags SET DEFAULT ARRAY[]::text[]"))
        op.execute(sa.text("ALTER TABLE clients ALTER COLUMN tags SET NOT NULL"))
        return

    # json (не jsonb) → text[]
    if str(data_type).lower() == "json":
        op.execute(sa.text("ALTER TABLE clients ALTER COLUMN tags DROP DEFAULT"))
        op.execute(
            sa.text("""
                ALTER TABLE clients
                  ALTER COLUMN tags TYPE text[]
                  USING (
                    CASE
                      WHEN tags IS NULL THEN ARRAY[]::text[]
                      WHEN json_typeof(tags) = 'array' THEN COALESCE(
                        ARRAY(SELECT json_array_elements_text(tags)),
                        ARRAY[]::text[]
                      )
                      ELSE ARRAY[]::text[]
                    END
                  )
            """)
        )
        op.execute(sa.text("ALTER TABLE clients ALTER COLUMN tags SET DEFAULT ARRAY[]::text[]"))
        op.execute(sa.text("ALTER TABLE clients ALTER COLUMN tags SET NOT NULL"))


def downgrade() -> None:
    pass
