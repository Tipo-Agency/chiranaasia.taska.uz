"""Политика длины пароля при установке (не при проверке логина — старые пароли остаются)."""
from fastapi import HTTPException

_MIN = 6
_MAX = 128


def assert_new_password_policy(password: str) -> None:
    if not isinstance(password, str):
        raise HTTPException(status_code=400, detail="Некорректный пароль")
    n = len(password)
    if n < _MIN or n > _MAX:
        raise HTTPException(
            status_code=400,
            detail=f"Пароль: от {_MIN} до {_MAX} символов",
        )
