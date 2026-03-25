#!/usr/bin/env python3
"""
Точка входа для старых unit/systemd-скриптов (`python bot.py`).

Актуальный код: пакет `taska_bot/`, запуск `python main.py`.
"""
CODE_VERSION_AT_START = "3.0.0-taska-bot"

from taska_bot.app import run

if __name__ == "__main__":
    run()
