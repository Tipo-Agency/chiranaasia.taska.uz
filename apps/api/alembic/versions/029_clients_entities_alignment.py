"""Client: tags, индексы phone/email; перенос contact_person/company_info/funnel_id в notes; удаление лишних колонок."""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import text
from sqlalchemy.dialects import postgresql

revision: str = "029_clients_entities"
down_revision: Union[str, None] = "028_deal_entities"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "clients",
        sa.Column(
            "tags",
            postgresql.ARRAY(sa.Text()),
            server_default=sa.text("ARRAY[]::text[]"),
            nullable=False,
        ),
    )
    op.execute(
        text("""
        UPDATE clients SET notes = NULLIF(trim(both E'\n' from concat_ws(E'\n',
            NULLIF(trim(both from COALESCE(notes, '')), ''),
            CASE WHEN contact_person IS NOT NULL AND trim(contact_person::text) <> ''
                 THEN 'Контактное лицо (архив): ' || trim(contact_person::text) END,
            CASE WHEN company_info IS NOT NULL AND trim(company_info::text) <> ''
                 THEN 'О компании (архив): ' || trim(company_info::text) END,
            CASE WHEN funnel_id IS NOT NULL AND trim(funnel_id::text) <> ''
                 THEN 'Воронка клиента (архив): ' || trim(funnel_id::text) END
        )), '')
        """)
    )
    op.execute(text("UPDATE clients SET phone = NULLIF(trim(phone), '') WHERE phone IS NOT NULL"))
    op.execute(text("UPDATE clients SET email = lower(trim(email)) WHERE email IS NOT NULL"))
    op.create_index("ix_clients_phone", "clients", ["phone"], unique=False)
    op.create_index("ix_clients_email", "clients", ["email"], unique=False)
    op.drop_column("clients", "contact_person")
    op.drop_column("clients", "company_info")
    op.drop_column("clients", "funnel_id")


def downgrade() -> None:
    op.add_column("clients", sa.Column("funnel_id", sa.String(36), nullable=True))
    op.add_column("clients", sa.Column("company_info", sa.Text(), nullable=True))
    op.add_column("clients", sa.Column("contact_person", sa.String(255), nullable=True))
    op.drop_index("ix_clients_email", table_name="clients")
    op.drop_index("ix_clients_phone", table_name="clients")
    op.drop_column("clients", "tags")
