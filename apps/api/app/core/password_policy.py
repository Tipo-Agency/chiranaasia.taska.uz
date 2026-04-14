"""Политика сложности пароля при установке (не при проверке логина — старые пароли остаются)."""
import re

from fastapi import HTTPException


def assert_new_password_policy(password: str) -> None:
    if not isinstance(password, str):
        raise HTTPException(status_code=400, detail="Некорректный пароль")
    if len(password) < 8 or len(password) > 128:
        raise HTTPException(
            status_code=400,
            detail="Пароль: от 8 до 128 символов",
        )
    if not re.search(r"\d", password):
        raise HTTPException(status_code=400, detail="Пароль должен содержать хотя бы одну цифру")
    if not re.search(r"[A-Za-zА-Яа-яЁё]", password):
        raise HTTPException(status_code=400, detail="Пароль должен содержать хотя бы одну букву")
