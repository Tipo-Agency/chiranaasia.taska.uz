# Telegram-бот (`apps/bot`)

## Назначение

- Работа в **группе** (ежедневная сводка, уведомления о сделках, поздравления).
- Работа в **личных сообщениях** — авторизация и сценарии взаимодействия с системой (см. код `bot.py`).

## Конфигурация

`apps/bot/config.py`:

- **`TELEGRAM_BOT_TOKEN`** — обязателен.
- **`BACKEND_URL`** — базовый URL API (на сервере часто `http://127.0.0.1:8003`).
- **`DEFAULT_TIMEZONE`** — по умолчанию `Asia/Tashkent`.
- **`DAILY_REMINDER_TIME`** / расписание — см. `scheduler.py` (ежедневная сводка в группу в **9:00** по умолчанию).

Клиент к API реализован в **`firebase_client.py`** (историческое имя; обращается к REST backend).

## Деплой на сервере

Скрипт **`ops/scripts/deploy.sh`**:

- Обновляет `apps/bot/.env` из секретов.
- Копирует **`telegram-bot.service`** в `/etc/systemd/system/` при наличии.
- Запускает **`apps/bot/deploy.sh`** и **`systemctl restart telegram-bot`**.

Локально бот в `docker-compose.yml` по умолчанию **отключён**.

## Конфликт 409

Один токен = один активный процесс опроса Telegram. Не запускайте второй инстанс с тем же токеном.

## Связь с админкой веб-приложения

Backend может отправлять тестовые сообщения через Telegram Bot API при наличии **`TELEGRAM_BOT_TOKEN`** в env контейнера API (`app/routers/admin.py`).
