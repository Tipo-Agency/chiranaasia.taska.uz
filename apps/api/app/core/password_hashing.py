"""
bcrypt для паролей пользователей: соль в каждой строке хеша (``bcrypt.gensalt``).

Модуль без импорта БД — удобно для юнит-тестов и явного контракта.
"""
from __future__ import annotations

import bcrypt


def looks_like_bcrypt_hash(value: str) -> bool:
    """True, если строка похожа на уже вычисленный bcrypt-хеш (bulk-импорт), не plaintext."""
    if not isinstance(value, str) or len(value) < 59:
        return False
    return value.startswith(("$2a$", "$2b$", "$2y$", "$2x$"))


def verify_password(plain: str, hashed: str) -> bool:
    """Сравнение plaintext с сохранённым bcrypt-хешем."""
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def hash_password_bcrypt(plain: str, *, rounds: int) -> str:
    """Новый bcrypt-хеш с новой солью; ``rounds`` — cost (4–31)."""
    cost = max(4, min(31, int(rounds)))
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt(rounds=cost)).decode()
