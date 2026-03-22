# Архитектура (обзор)

## Продакшен (типичная схема)

```
Пользователь → HTTPS → nginx (статика + reverse proxy)
              → SPA из /var/www/frontend (React/Vite build)
              → /api/* и /health → 127.0.0.1:8003 (FastAPI в Docker)
              → PostgreSQL в Docker, порт хоста 5433 → 5432 в контейнере
```

Отдельно на сервере может работать **Telegram-бот** (Python, systemd), который ходит в API по `BACKEND_URL`.

## Компоненты

| Компонент | Роль |
|-----------|------|
| **apps/web** | SPA: задачи, CRM, финансы, контент-планы, настройки, админка (роль ADMIN) |
| **apps/api** | REST API, JWT, bcrypt, Alembic на старте |
| **apps/bot** | Опрос Telegram, расписание (APScheduler), запросы к backend |
| **ops** | `deploy.sh`, шаблон nginx |
| **PostgreSQL** | Единственное хранилище данных приложения (volume `pgdata`) |

## Аутентификация

- Логин/пароль → JWT в ответе; фронт хранит токен и передаёт `Authorization: Bearer …` в `apiClient.ts`.
- Роль **ADMIN** нужна для маршрутов `/api/admin/*` и экрана «Админ-панель».

## Публичные маршруты без JWT

- `GET /health` — проверка живости и БД.
- Публичный контент-план: эндпоинт таблиц (см. `routers/tables.py`) и фронт `/content-plan/:id`.

## Логи и мониторинг

- Ошибки уровня ERROR+ попадают в таблицу `system_logs` и при необходимости в Telegram (если заданы `TELEGRAM_EMPLOYEE_BOT_TOKEN` / `TELEGRAM_ALERT_CHAT_ID` в env backend).

## Не используется в проде

- Firestore / Firebase как основная БД — не актуально; исторические скрипты миграции лежат в `scripts/`.
