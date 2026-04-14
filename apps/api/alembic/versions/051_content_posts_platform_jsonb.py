"""content_posts.platform: привести text[] к jsonb (ORM ждёт JSONB)."""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "051_cp_platform_jsonb"
down_revision: str | None = "050_clients_tags_array"
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
              AND table_name = 'content_posts'
              AND column_name = 'platform'
        """)
    ).fetchone()
    if not row:
        return

    data_type, udt_name = row[0], row[1]
    if str(udt_name) == "jsonb":
        return

    if str(data_type).upper() == "ARRAY" and str(udt_name) == "_text":
        op.execute(sa.text("ALTER TABLE content_posts ALTER COLUMN platform DROP DEFAULT"))
        op.execute(
            sa.text("""
                ALTER TABLE content_posts
                  ALTER COLUMN platform TYPE jsonb
                  USING COALESCE(to_jsonb(platform), '[]'::jsonb)
            """)
        )
        op.execute(sa.text("ALTER TABLE content_posts ALTER COLUMN platform SET DEFAULT '[]'::jsonb"))
        return

    if str(udt_name) == "json":
        op.execute(sa.text("ALTER TABLE content_posts ALTER COLUMN platform DROP DEFAULT"))
        op.execute(
            sa.text("""
                ALTER TABLE content_posts
                  ALTER COLUMN platform TYPE jsonb
                  USING COALESCE(platform::jsonb, '[]'::jsonb)
            """)
        )
        op.execute(sa.text("ALTER TABLE content_posts ALTER COLUMN platform SET DEFAULT '[]'::jsonb"))


def downgrade() -> None:
    pass
