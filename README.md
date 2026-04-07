# tipa.taska.uz

Платформа управления задачами, CRM, финансами, контентом и операционными процессами. Монорепозиторий: **SPA на React** + **REST API на FastAPI** + **PostgreSQL**; отдельно — **Telegram-бот** и инфраструктура деплоя.

## Документация

| Раздел | Содержание |
|--------|------------|
| **[docs/README.md](docs/README.md)** | Оглавление и навигация по всей документации |
| **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** | Системная архитектура: БД, события, уведомления, realtime, ограничения |
| **[docs/FRONTEND.md](docs/FRONTEND.md)** | Фронтенд: маршруты, модули, состояние, UI-слой, зоны приложения |
| **[docs/COMPONENTS.md](docs/COMPONENTS.md)** | Карта компонентов и каталогов UI |
| **[docs/API.md](docs/API.md)** | Обзор HTTP API, WebSocket, вебхуки, интеграции |
| **[docs/OPERATIONS.md](docs/OPERATIONS.md)** | Локальный запуск, деплой, секреты, troubleshooting |
| **[docs/CLIENT.md](docs/CLIENT.md)** | Кратко для заказчика (эксплуатация без внутренностей репозитория) |

Источник правды по коду: `apps/web/`, `apps/api/app/`, `apps/bot/`, `ops/`.

## Структура репозитория

```
apps/web/       — Vite + React + TypeScript (клиент)
apps/api/       — FastAPI, SQLAlchemy, Alembic
apps/bot/       — Telegram-бот (python-telegram-bot)
ops/            — nginx, скрипты деплоя
docs/           — документация (этот каталог)
scripts/        — миграции данных и разовые утилиты
```

## Быстрый старт

```bash
# Backend + Postgres (Docker)
docker-compose up -d

# Frontend
npm install
npm run dev:web
```

Порты и нюансы прокси — в **[docs/OPERATIONS.md](docs/OPERATIONS.md)**.

## CI / деплой

Пуш в `main` → GitHub Actions (lint, typecheck, build фронта, проверки API) → при успехе деплой на сервер (`ops/scripts/deploy.sh`). Подробности — в **OPERATIONS**.

## Дополнительно

- Каталог **`.auto-claude`** в `.gitignore` — служебные данные IDE; на сборку не влияет.
- Скрипты в `scripts/` — см. **[scripts/README.md](scripts/README.md)**.
