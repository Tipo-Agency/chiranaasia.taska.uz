"""Пароли: bcrypt + соль в строке хеша; в БД не plaintext."""
from __future__ import annotations

import pytest

from app.core.password_hashing import (
    hash_password_bcrypt,
    looks_like_bcrypt_hash,
    verify_password,
)


def test_bcrypt_unique_salt_per_hash():
    plain = "Aa1bcdefgh"
    h1 = hash_password_bcrypt(plain, rounds=4)
    h2 = hash_password_bcrypt(plain, rounds=4)
    assert looks_like_bcrypt_hash(h1)
    assert looks_like_bcrypt_hash(h2)
    assert h1 != h2
    assert plain not in h1 and plain not in h2
    assert verify_password(plain, h1)
    assert verify_password(plain, h2)
    assert not verify_password("other", h1)


@pytest.mark.parametrize(
    "value,expected",
    [
        ("$2b$04$ab", False),
        (
            "$2b$04$5Dg3VQarsQFLX4vLbOcYc.9YOto.lGQtYM/Hosjq0QD6icwOKUMyK",
            True,
        ),
    ],
)
def test_looks_like_bcrypt_hash_shape(value: str, expected: bool):
    assert looks_like_bcrypt_hash(value) is expected


def test_looks_like_bcrypt_rejects_plaintext():
    assert not looks_like_bcrypt_hash("not-a-hash")
    assert not looks_like_bcrypt_hash("$2short")
