# Документация tipa.taska.uz

## Система и API (с чего начать)

| Документ | Содержание |
|----------|------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Архитектура: Postgres, Redis Stream, уведомления, чат, Telegram, ограничения «мгновенности» |
| [API-OVERVIEW.md](./API-OVERVIEW.md) | Обзор HTTP API, префиксы, WebSocket, вебхуки, интеграция заявок (`POST /deals`) |

## Эксплуатация и локальный запуск

| Документ | Содержание |
|----------|------------|
| [00-ONBOARDING.md](./00-ONBOARDING.md) | Локальный запуск: Docker, фронт, порты |
| [operations/DEPLOY.md](./operations/DEPLOY.md) | Автодеплой, nginx, шаги `ops/scripts/deploy.sh` |
| [operations/ENV_AND_SECRETS.md](./operations/ENV_AND_SECRETS.md) | Переменные окружения и секреты GitHub Actions |
| [operations/TROUBLESHOOTING.md](./operations/TROUBLESHOOTING.md) | Частые неполадки |
| [CLIENT.md](./CLIENT.md) | Кратко для заказчика: развёртывание и эксплуатация (без внутренностей репо) |

Источник правды по коду — репозиторий: `apps/api/app/models/`, миграции Alembic, роутеры `apps/api/app/routers/`, UI в `apps/web/`.
