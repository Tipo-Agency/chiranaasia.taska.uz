# Taska Backend (Python FastAPI)

## Локальный запуск

### 1. PostgreSQL

Установите PostgreSQL или используйте Docker:

```bash
docker run -d --name taska-db -e POSTGRES_USER=taska -e POSTGRES_PASSWORD=taska -e POSTGRES_DB=taska -p 5432:5432 postgres:16-alpine
```

### 2. Backend

```bash
cd apps/api
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Создайте `.env`:
```
DATABASE_URL=postgresql+asyncpg://taska:taska@localhost:5432/taska
SECRET_KEY=your-secret-key
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

Запустите миграции и сервер:

```bash
alembic upgrade head
python seed.py          # опционально: демо-данные
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 3. Frontend

```bash
cd ../..
npm install
npm run dev:web
```

Frontend на http://localhost:3000, API на http://localhost:8000. Vite проксирует `/api` на backend.

## Docker Compose (полный стек)

```bash
docker-compose up -d
```

- Backend: http://localhost:8000
- PostgreSQL: localhost:5432
- Демо-данные: `docker-compose exec backend python seed.py`

## Панелька для PostgreSQL (Adminer / pgAdmin)

Поднимается как dev-инструмент отдельным профилем:

```bash
docker-compose --profile tools up -d
```

- Adminer: http://localhost:8080
  - System: `PostgreSQL`
  - Server: `db`
  - Username: `taska`
  - Password: `${DB_PASSWORD:-taska}`
  - Database: `taska`
- pgAdmin: http://localhost:5050
  - Email/Password: `${PGADMIN_DEFAULT_EMAIL:-admin@local}` / `${PGADMIN_DEFAULT_PASSWORD:-admin}`
  - Host: `db`, Port: `5432`, User: `taska`, Password: `${DB_PASSWORD:-taska}`, DB: `taska`

## Telegram Bot

Бот использует Backend API. Добавьте в `.env`:

```
BACKEND_URL=http://localhost:8000
TELEGRAM_BOT_TOKEN=your-token
```

Firebase полностью удалён — единственный источник данных: Python backend.

## Деплой

При деплое миграции выполняются автоматически при старте контейнера (`alembic upgrade head` в CMD).
