# tipa.taska.uz

Платформа управления задачами, CRM, финансами, контентом и операционными процессами. Монорепозиторий: **SPA на React** + **REST API на FastAPI** + **PostgreSQL**; отдельно — **Telegram-бот** и инфраструктура деплоя.

## Документация

| Раздел | Содержание |
|--------|------------|
| **[docs/README.md](docs/README.md)** | Оглавление, быстрый старт, карта репозитория |
| **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** | Архитектура: слои, очереди, WebSocket, NFR |
| **[docs/DATABASE.md](docs/DATABASE.md)** | Схема БД, индексы, миграции |
| **[docs/API.md](docs/API.md)** | HTTP API, пагинация, идемпотентность, вебхуки |
| **[docs/FRONTEND.md](docs/FRONTEND.md)** | SPA: роутинг, стейт, API-клиент |
| **[docs/ENTITIES.md](docs/ENTITIES.md)** | Доменные сущности и инварианты |
| **[docs/MODULES.md](docs/MODULES.md)** | Продуктовые модули и критерии приёмки |
| **[docs/SECURITY.md](docs/SECURITY.md)** | CSP/HSTS (API+nginx), JWT+refresh+`token_version`, CSRF+Origin, rate limit, лимиты body, политика паролей |
| **[docs/INTEGRATIONS.md](docs/INTEGRATIONS.md)** | Meta, Telegram, MTProto, сайт, хранилище |
| **[docs/TESTING.md](docs/TESTING.md)** | Стратегия тестов |
| **[docs/OPERATIONS.md](docs/OPERATIONS.md)** | Docker, деплой, nginx, troubleshooting |
| **[docs/DECISIONS.md](docs/DECISIONS.md)** | ADR и инженерные правила |

Источник правды по коду: `apps/web/`, `apps/api/app/`, `apps/bot/`, `ops/`.

## Структура репозитория

```
apps/web/       — Vite + React + TypeScript (клиент)
apps/api/       — FastAPI, SQLAlchemy, Alembic
apps/bot/       — Telegram-бот (python-telegram-bot)
ops/            — nginx, скрипты деплоя
docs/           — документация
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

Пуш в `main` → GitHub Actions (lint, typecheck, build фронта, проверки API) → при успехе деплой на сервер (`ops/scripts/deploy.sh`). Подробности — в **docs/OPERATIONS.md**.

## Дополнительно

- Каталог **`.auto-claude`** в `.gitignore` — служебные данные IDE; на сборку не влияет.
- Скрипты в `scripts/` — см. **[scripts/README.md](scripts/README.md)**.
