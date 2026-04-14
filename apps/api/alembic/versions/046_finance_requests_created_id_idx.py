"""Индекс под keyset GET /finance/requests: ORDER BY created_at DESC, id DESC.

Без составного индекса по (created_at, id) при отсутствии узких фильтров
Postgres часто уходит в сортировку по большому срезу.
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "046_finance_requests_created_id_idx"
down_revision: Union[str, None] = "045_notification_events_hub_processed_at"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "idx_finance_requests_created_at_id",
        "finance_requests",
        ["created_at", "id"],
    )


def downgrade() -> None:
    op.drop_index("idx_finance_requests_created_at_id", table_name="finance_requests")
