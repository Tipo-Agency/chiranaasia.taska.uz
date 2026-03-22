# Переменные окружения и секреты

## GitHub Actions (Secrets)

Используются в `.github/workflows/deploy.yml` и передаются в `deploy.sh`:

| Secret | Назначение |
|--------|------------|
| `SERVER_HOST` | SSH хост |
| `SERVER_USER` | SSH пользователь |
| `SERVER_SSH_KEY` | Приватный ключ SSH |
| `SERVER_PATH` | Путь к клону репо на сервере |
| `TELEGRAM_BOT_TOKEN` | Токен бота → `apps/bot/.env` и корневой `.env` (для backend) |
| `BACKEND_URL` | URL API для бота, напр. `http://127.0.0.1:8003` |
| `NGINX_SITE_NAME` | Имя файла сайта nginx (по умолчанию `tipa.taska.uz`) |

Если `TELEGRAM_BOT_TOKEN` пустой, бот и тестовые отправки из админки API не получат токен.

## Backend (`apps/api`)

Читается из env / `.env` (см. `app/config.py`):

| Переменная | Описание |
|------------|----------|
| `DATABASE_URL` | Строка async SQLAlchemy, напр. `postgresql+asyncpg://user:pass@db:5432/taska` |
| `SECRET_KEY` | Секрет подписи JWT |
| `CORS_ORIGINS` | Список origin через запятую |
| `API_PREFIX` | По умолчанию `/api` |
| `TELEGRAM_BOT_TOKEN` | Для админских тестовых отправок в Telegram через API |
| `TELEGRAM_EMPLOYEE_BOT_TOKEN` | Опционально: алерты |
| `TELEGRAM_ALERT_CHAT_ID` | Опционально: чат для CRITICAL |

## Docker Compose (корень репо)

- `DB_PASSWORD` — пароль Postgres (дефолт в compose для dev).
- `SECRET_KEY` — для контейнера backend.
- `TELEGRAM_BOT_TOKEN` — прокидывается в сервис `backend`.

Корневой **`.env`** на сервере дополняется скриптом деплоя для `TELEGRAM_BOT_TOKEN`.

## Telegram-бот (`apps/bot`)

Минимум в `apps/bot/.env`:

- `TELEGRAM_BOT_TOKEN` — обязателен (см. `apps/bot/config.py`).
- `BACKEND_URL` — URL API.
- `DEFAULT_TIMEZONE` — по умолчанию `Asia/Tashkent`.

## Безопасность

- Не коммитить реальные `.env` с секретами.
- Пароли пользователей в БД хранятся как **bcrypt**; при создании пользователя API принимает пароль в открытом виде и хеширует один раз (не дублировать хеш на фронте).
