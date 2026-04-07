# Backend — FastAPI (`apps/api`)

REST API, вебхуки, фоновые циклы в процессе приложения, интеграции (Meta, Telegram, сайт).

## Стек

- Python 3.11+ (ориентир — см. `Dockerfile` / CI)
- FastAPI, Uvicorn
- SQLAlchemy 2 async, asyncpg
- Alembic — миграции схемы

## Структура (важное)

```
app/
  main.py          — точка входа, подключение роутеров
  config.py        — настройки из окружения
  routers/         — HTTP-эндпоинты по доменам
  models/          — ORM-модели
  services/        — бизнес-логика, события, уведомления
```

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
SECRET_KEY=your-secret-key
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

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

## Документация

- Системная архитектура: **[../../docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md)**
- Обзор API: **[../../docs/API.md](../../docs/API.md)**
- Деплой и секреты: **[../../docs/OPERATIONS.md](../../docs/OPERATIONS.md)**
