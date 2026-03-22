# Разработка: backend (`apps/api`)

## Стек

- **FastAPI** (async)
- **SQLAlchemy 2** + **asyncpg**
- **Alembic** — миграции; при старте приложения вызывается `upgrade head` (`app/main.py`, lifespan)
- **JWT** (python-jose), пароли — **bcrypt** (`app/auth.py`)

## Запуск локально

- Через Docker: см. **`docs/00-ONBOARDING.md`** (порт **8003** на хосте).
- Или из каталога `apps/api`: uvicorn на порту **8000** (как в `vite` proxy по умолчанию).

## Конфигурация

`app/config.py` — класс **Settings** (pydantic-settings), переменные из env.

Префикс API: **`API_PREFIX=/api`** — роутеры подключаются с этим префиксом.

## Роутеры

Файлы в **`app/routers/`**, подключение в **`app/main.py`**.

Основные группы: `auth`, `tasks`, `projects`, `tables`, `clients`, `deals`, `content_posts`, `finance`, `weekly_plans`, `admin`, `system`, …

### Админка API

`app/routers/admin.py` — префикс **`/api/admin`**, зависимость **`get_current_user_admin`** (роль ADMIN).

Функции: просмотр таблиц БД, логи, метрики, запуск pytest, отправка тестовых сообщений в Telegram (нужен `TELEGRAM_BOT_TOKEN`).

## Аутентификация

- `POST /api/auth/login` — выдача JWT.
- CRUD пользователей и смена паролей — в роутере **`auth`** (методы смотрите в файле).

## Миграции

```bash
cd apps/api
alembic revision --autogenerate -m "описание"
alembic upgrade head
```

В проде миграции накатываются при рестарте контейнера backend.

## Health

- **`GET /health`** без префикса `/api` — проверка процесса и `SELECT 1` к БД.

## Логирование

Обработчик **`SystemLogHandler`** шлёт ERROR+ в таблицу `system_logs` (и опционально в Telegram).
