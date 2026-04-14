# Backend — FastAPI (`apps/api`)

REST API, вебхуки, интеграции (Meta, Telegram, сайт). Очереди Redis Streams — см. **[../../docs/QUEUES.md](../../docs/QUEUES.md)**. Доставка telegram/e-mail — `notifications_worker`; доменный hub — `domain_events_worker` при `DOMAIN_EVENTS_HUB_ASYNC=true`; retention — `retention_worker`.

## Стек

- Python 3.11+ (ориентир — см. `Dockerfile` / CI)
- FastAPI, Uvicorn
- SQLAlchemy 2 async, asyncpg
- Alembic — миграции схемы

## Структура слоёв

```
app/
  main.py              — FastAPI app, middleware, lifespan
  core/                — config, auth (JWT), permissions, rate_limit, логирование, mappers (row_to_*), seed_data
  db/                  — engine, Base, AsyncSessionLocal, get_db
  models/              — SQLAlchemy ORM
  schemas/             — Pydantic-схемы запросов/ответов (точечно)
  services/            — use-cases: доменные события, уведомления, интеграции
  api/routers/         — HTTP: тонкий слой → services / models
  middleware/          — CSRF, security headers, request id, лимит body
```

Импорты: **router → service → model**; `core` и `db` не зависят от роутеров.

Полный обзор префиксов — **[../../docs/API.md](../../docs/API.md)**.

## Локальный запуск (без Docker)

1. PostgreSQL локально или контейнер.
2. Виртуальное окружение и зависимости:

```bash
cd apps/api
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

3. Файл `.env` (пример):

```
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/dbname
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=<минимум 32 символа, см. openssl rand -hex 32>
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

Без `DATABASE_URL`, `REDIS_URL` и `SECRET_KEY` процесс завершится ошибкой валидации при импорте `app` (см. `app.core.config`).

4. Миграции и сервер:

```bash
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Фронтенд из корня репозитория: `npm run dev:web` — Vite проксирует `/api` на порт из конфига Vite.

## Docker Compose (как в корне репозитория)

```bash
docker-compose up -d
```

Порты см. корневой **[../../docs/OPERATIONS.md](../../docs/OPERATIONS.md)**. Миграции при старте контейнера backend обычно выполняются автоматически (`alembic upgrade head`).

## Тесты

```bash
pip install -r requirements-dev.txt
pytest tests/ -v
```

`TEST_API_URL` — адрес поднятого API.

## Telegram-бот

Отдельный пакет **`apps/bot`**. Backend задаёт контракт данных; бот ходит по HTTP. Переменные: `BACKEND_URL`, `TELEGRAM_BOT_TOKEN` и др. — см. `apps/bot` и **[../../docs/OPERATIONS.md](../../docs/OPERATIONS.md)**.

## Воркеры (`workers/`)

Из каталога `apps/api` (то же venv, что и у API):

```bash
python -m workers.integrations_worker    # queue.integrations.v1 + polling Telegram-лидов
python -m workers.notifications_worker   # queue.notifications.v1 — отправка по notification_id
python -m workers.domain_events_worker   # при DOMAIN_EVENTS_HUB_ASYNC=true
python -m workers.retention_worker       # retention уведомлений
```

Без соответствующего воркера задачи в stream накапливаются; API для доставок только **XADD**.

## Документация

- Системная архитектура: **[../../docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md)**
- Обзор API: **[../../docs/API.md](../../docs/API.md)**
- Деплой и секреты: **[../../docs/OPERATIONS.md](../../docs/OPERATIONS.md)**
