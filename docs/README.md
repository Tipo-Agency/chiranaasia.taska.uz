# Документация tipa.taska.uz

Монорепозиторий: **React (Vite)**, **FastAPI + PostgreSQL**, **Telegram-бот**, деплой через **GitHub Actions** + **nginx**.

## С чего начать

| Документ | Содержание |
|----------|------------|
| [00-ONBOARDING.md](./00-ONBOARDING.md) | Клонирование, переменные, первый запуск локально |
| [architecture/OVERVIEW.md](./architecture/OVERVIEW.md) | Как связаны компоненты в проде |
| [architecture/REPO_LAYOUT.md](./architecture/REPO_LAYOUT.md) | Структура каталогов |
| [architecture/DATABASE.md](./architecture/DATABASE.md) | Таблицы PostgreSQL и связь с кодом |
| [operations/DEPLOY.md](./operations/DEPLOY.md) | Автодеплой, nginx, Docker |
| [operations/ENV_AND_SECRETS.md](./operations/ENV_AND_SECRETS.md) | Env и секреты GitHub |
| [operations/TROUBLESHOOTING.md](./operations/TROUBLESHOOTING.md) | Типичные проблемы |
| [product/MODULES.md](./product/MODULES.md) | Разделы приложения (UI) |
| [development/FRONTEND.md](./development/FRONTEND.md) | Фронтенд: сборка, API-клиент |
| [development/BACKEND.md](./development/BACKEND.md) | Backend: роутеры, миграции |
| [development/BOT.md](./development/BOT.md) | Telegram-бот |
| [development/ADD_ENTITY.md](./development/ADD_ENTITY.md) | Чеклист добавления сущности |
| [entities/](./entities/README.md) | Описания сущностей и шаблон |

## Источники правды

1. **Схема БД** — модели в `apps/api/app/models/` и миграции `apps/api/alembic/versions/`.
2. **HTTP API** — роутеры в `apps/api/app/routers/`, префикс `/api` (см. `app/config.py`: `API_PREFIX`).
3. **Поведение UI** — `apps/web/components/`, состояние в хуках `apps/web/frontend/hooks/`.

Документы в `docs/` дополняют код; при расхождении приоритет у репозитория.

## История изменений документации

- **2026-03** — полная пересборка структуры `docs/` под текущее состояние проекта.
