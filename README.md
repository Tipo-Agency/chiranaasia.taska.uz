# tipa.taska.uz — monorepo

## Структура

- `apps/web` — frontend (Vite + React)
- `apps/api` — backend (FastAPI + PostgreSQL + Alembic)
- `apps/bot` — Telegram bot
- `ops` — деплой/инфра (nginx, скрипты)
- `docs` — документация (в т.ч. миграция с Firestore)
- `scripts` — одноразовые скрипты (миграция Firestore → Postgres и т.п.)

## С чего читать документацию

1. **README.md** (этот файл) — структура репо, запуск, тесты, лимиты.
2. **REFACTORING.md** — что уже отрефакторено во фронте (утилиты, хуки, константы).
3. **docs/MIGRATION_FROM_FIRESTORE_TO_POSTGRES.md** — пошаговая миграция данных с Firestore на Postgres.
4. **docs/ARCHITECTURE.md** — актуальная архитектура (Postgres, API, бот).
5. Остальное в `docs/` и `docs/tz/` — legacy и частные ТЗ по мере надобности.

## Папка .auto-claude

Каталог **.auto-claude** — служебные данные авто-инструментов (например Cursor/Claude). В репозиторий не коммитится (указан в `.gitignore`). Можно не трогать или удалить, на сборку и работу приложения не влияет.

## Деплой (автоматический по push в main)

При пуше в `main` срабатывает GitHub Actions: SSH на сервер и выполняется `ops/scripts/deploy.sh`.

**Что нужно на сервере:** Docker (для Postgres + backend), Node.js (для сборки фронта), nginx. Конфиг nginx — `ops/nginx/nginx.conf` (проксирование `/api` и `/health` на `127.0.0.1:8000`).

**Secrets в GitHub (Settings → Secrets and variables → Actions):**

| Secret | Обязательно | Описание |
|--------|--------------|----------|
| `SERVER_HOST` | да | Хост сервера |
| `SERVER_USER` | да | SSH-пользователь |
| `SERVER_SSH_KEY` | да | Приватный SSH-ключ |
| `SERVER_PATH` | да | Путь к репо на сервере (например `/var/www/tipa.taska.uz`) |
| `TELEGRAM_BOT_TOKEN` | да | Токен Telegram-бота |
| `BACKEND_URL` | рекомендуется | URL API для бота (например `https://ваш-домен.uz/api` или `http://127.0.0.1:8000`) |
| `RUN_MIGRATE_FIRESTORE` | нет | Значение `1` — при деплое запускать миграцию Firestore → Postgres |
| `FIREBASE_CREDENTIALS` | если миграция | Путь на сервере к JSON ключа Firebase (например `/var/www/tipa.taska.uz/firebase-key.json`). Файл нужно один раз положить на сервер вручную. |

**После первого деплоя:**  
1. Убедиться, что backend и БД подняты: `docker compose ps` (или `docker-compose ps`).  
2. Если миграция не запускалась автоматически — один раз выполнить миграцию (см. ниже).  
3. Проверить сайт, логин, задачи, CRM; при появлении багов — чинить по логам (Настройки → Логи, или `GET /api/system/logs`).

Подробный чеклист и устранение неполадок: [docs/DEPLOY_AND_MIGRATION.md](docs/DEPLOY_AND_MIGRATION.md).

## Миграция Firestore → Postgres (однократно после деплоя)

Чтобы перенести данные из Firebase Firestore в новую БД Postgres, после первой установки бэкенда на сервере запустите скрипт миграции. Подробности и переменные окружения — в [scripts/README.md](scripts/README.md) и [docs/MIGRATION_FROM_FIRESTORE_TO_POSTGRES.md](docs/MIGRATION_FROM_FIRESTORE_TO_POSTGRES.md).

Кратко:

```bash
pip install -r scripts/requirements-migrate.txt
export BACKEND_URL=http://localhost:8000
export FIREBASE_CREDENTIALS=/path/to/firebase-service-account.json
python scripts/migrate_firestore_to_postgres.py
```

Опция `--from-json ./export` — если данные уже экспортированы в JSON. Опция `--dry-run` — только подсчёт записей без записи в API.

## Запуск локально (быстро)

### Backend + Postgres

```bash
docker-compose up -d
```

- API: `http://localhost:8000`
- DB: `localhost:5432`

### Frontend

```bash
npm install
npm run dev:web
```

Frontend: `http://localhost:3000` (проксирует `/api` на `:8000`)

### Панелька для Postgres (опционально)

```bash
docker-compose --profile tools up -d
```

Adminer: `http://localhost:8080`, pgAdmin: `http://localhost:5050`

## Админка Postgres

Для работы с базой данных в dev/админских задачах используется **pgAdmin** (и по желанию Adminer).

- Запуск:
  ```bash
  docker-compose --profile tools up -d
  ```
- Доступ:
  - pgAdmin: `http://localhost:5050`
  - Adminer: `http://localhost:8080`
- Учётные данные для pgAdmin задаются через переменные окружения в `docker-compose.yml`:
  - `PGADMIN_DEFAULT_EMAIL`
  - `PGADMIN_DEFAULT_PASSWORD`

Через pgAdmin удобно:

- смотреть структуру таблиц, индексы, ключи;
- проверять Alembic‑миграции;
- запускать ad‑hoc SQL‑запросы и простые отчёты.

**Важно:** прикладное администрирование (статусы, воронки, сотрудники, финансы, роботы и т.п.) делается через раздел «Настройки» в самом приложении. pgAdmin остаётся только внутренним инструментом для разработчика/админа.

## Проверка работы: health, логи, алерты

- **Health:** `GET /health` возвращает `{"status":"ok","version":"1.0.0","db":"ok"}`. Используется мониторингом и после деплоя.
- **Логи ошибок:** все `ERROR`/`CRITICAL`/`WARNING` пишутся в таблицу `system_logs`. Просмотр — в приложении: **Настройки → Система / Логи** (или `GET /api/system/logs?limit=50`).
- **Telegram-алерты:** при уровне `CRITICAL` сообщение уходит в Telegram, если в `.env` backend'а заданы `TELEGRAM_EMPLOYEE_BOT_TOKEN` и `TELEGRAM_ALERT_CHAT_ID`. Токен хранится только на сервере.
- Подробнее: [docs/HEALTH_LOGS_ALERTS.md](docs/HEALTH_LOGS_ALERTS.md).

## Тесты (smoke)

Из корня проекта при запущенном backend:

```bash
cd apps/api && pip install -r requirements-dev.txt && pytest tests/ -v
```

Переменная `TEST_API_URL` (по умолчанию `http://localhost:8000`) задаёт адрес API. Проверяются: `/health`, `/api/auth/login`, `/api/tasks`, `/api/system/logs`.

## Лимиты и надёжность

- **Одновременные пользователи:** жёсткого лимита в коде нет; всё упирается в воркеры uvicorn и пул соединений БД. См. [docs/LIMITS_AND_RELIABILITY.md](docs/LIMITS_AND_RELIABILITY.md).
- **Проверки доставки (сообщения/задачи):** статусов «дошло/не дошло» в системе нет; при ошибке сохранения на API пользователь видит уведомление об ошибке.
- **Ошибки API:** при сбое сохранения (задача, пост, сделка, настройки и т.д.) во фронте показывается сообщение вида «Ошибка сохранения...» или «Не удалось сохранить задачу».

