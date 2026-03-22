# Быстрый старт (onboarding)

## Требования

- **Node.js** (LTS) — для фронта и `npm ci` при деплое
- **Docker** + **Docker Compose** — Postgres и backend локально
- **Python 3.10+** — для локального запуска API без Docker (опционально)

## Клонирование

```bash
git clone <repo-url>
cd tipa.taska.uz-1
```

## Backend + БД (Docker)

Из корня репозитория:

```bash
docker compose up -d
```

- **PostgreSQL** на хосте: порт **5433** → контейнер `5432` (см. `docker-compose.yml`).
- **API** на хосте: порт **8003** → контейнер `8000`.

Проверка:

```bash
curl -s http://localhost:8003/health
```

Ожидается JSON с `"status":"ok"` и `"db":"ok"`.

При первом старте backend применяет миграции Alembic (`app/main.py`, lifespan).

### Инструменты для БД (опционально)

```bash
docker compose --profile tools up -d
```

- Adminer: http://localhost:8080  
- pgAdmin: http://localhost:5050  

Учётные данные — в `docker-compose.yml` (`PGADMIN_*`).

## Frontend (dev)

```bash
npm install
npm run dev:web
```

Приложение: http://localhost:3000  

Прокси Vite (`apps/web/vite.config.ts`): `/api` и `/health` → **http://localhost:8000**.  

Если API у вас только в Docker на **8003**, для dev либо:

- поднимите uvicorn локально на порту **8000**, либо  
- временно измените `vite.config.ts`: `target: 'http://localhost:8003'`.

## Сборка фронта (как в проде)

```bash
npm run build:web
```

Артефакт: `apps/web/dist/`. В проде nginx отдаёт содержимое из `/var/www/frontend` (см. `operations/DEPLOY.md`).

## Telegram-бот локально

В `docker-compose.yml` сервис бота закомментирован. Обычно бот ставится на сервере через **systemd** (`apps/bot/deploy.sh`, см. `development/BOT.md`).

## Тесты API (smoke)

При работающем API:

```bash
cd apps/api && pip install -r requirements-dev.txt && pytest tests/ -v
```

`TEST_API_URL` по умолчанию `http://localhost:8000` — при тестах против Docker укажите `TEST_API_URL=http://localhost:8003`.

## Полезные пути

| Что | Где |
|-----|-----|
| Модели БД | `apps/api/app/models/` |
| Роуты API | `apps/api/app/routers/` |
| Клиент HTTP с JWT | `apps/web/services/apiClient.ts` |
| Главный роутер UI | `apps/web/components/AppRouter.tsx` |
| Публичный контент-план | маршрут `/content-plan/:tableId` (без авторизации) |
