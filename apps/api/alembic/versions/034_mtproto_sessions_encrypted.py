"""mtproto_sessions: переименование таблицы/колонки, session_data только ciphertext; миграция plaintext → Fernet."""

from __future__ import annotations

import base64
import hashlib
import os
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from cryptography.fernet import Fernet, InvalidToken

revision: str = "034_mtproto_sessions_encrypted"
down_revision: Union[str, None] = "033_dead_letter_queue"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _fernet_from_env() -> Fernet | None:
    sk = (os.environ.get("SECRET_KEY") or "").strip()
    if not sk:
        return None
    key = base64.urlsafe_b64encode(hashlib.sha256(sk.encode()).digest())
    return Fernet(key)


def upgrade() -> None:
    op.rename_table("telegram_personal_sessions", "mtproto_sessions")
    op.execute(
        sa.text("ALTER INDEX IF EXISTS ix_telegram_personal_sessions_user_id RENAME TO ix_mtproto_sessions_user_id")
    )
    op.alter_column(
        "mtproto_sessions",
        "encrypted_session",
        new_column_name="session_data",
        existing_type=sa.Text(),
        existing_nullable=True,
    )

    f = _fernet_from_env()
    if f is None:
        return

    conn = op.get_bind()
    rows = conn.execute(
        sa.text(
            "SELECT id, session_data FROM mtproto_sessions "
            "WHERE session_data IS NOT NULL AND btrim(session_data::text) <> ''"
        )
    ).fetchall()
    for rid, blob in rows:
        if blob is None:
            continue
        s = str(blob).strip()
        if not s:
            continue
        try:
            f.decrypt(s.encode())
        except (InvalidToken, ValueError, TypeError):
            enc = f.encrypt(s.encode()).decode()
            conn.execute(
                sa.text("UPDATE mtproto_sessions SET session_data = :enc WHERE id = :id"),
                {"enc": enc, "id": rid},
            )


def downgrade() -> None:
    op.alter_column(
        "mtproto_sessions",
        "session_data",
        new_column_name="encrypted_session",
        existing_type=sa.Text(),
        existing_nullable=True,
    )
    op.execute(
        sa.text("ALTER INDEX IF EXISTS ix_mtproto_sessions_user_id RENAME TO ix_telegram_personal_sessions_user_id")
    )
    op.rename_table("mtproto_sessions", "telegram_personal_sessions")
