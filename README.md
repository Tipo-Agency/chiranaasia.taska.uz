# tipa.taska.uz — monorepo

## Структура

- `apps/web` — frontend (Vite + React, статический SPA; в проде nginx раздаёт билд из `/var/www/frontend`, не Next.js)
- `apps/api` — backend (FastAPI + PostgreSQL + Alembic)
- `apps/bot` — Telegram bot
- `ops` — деплой/инфра (nginx, скрипты)
- `docs` — документация ([`docs/README.md`](docs/README.md))
- `scripts` — одноразовые скрипты (миграция Firestore → Postgres и т.п.)

## С чего читать документацию

1. **README.md** (этот файл) — структура репо, запуск, тесты, лимиты, деплой.
2. **[`docs/README.md`](docs/README.md)** — деплой, секреты, troubleshooting, быстрый старт.
3. **[`docs/CLIENT.md`](docs/CLIENT.md)** — кратко для передачи заказчику (развёртывание, без внутренних деталей).

## Папка .auto-claude

Каталог **.auto-claude** — служебные данные авто-инструментов (например Cursor/Claude). В репозиторий не коммитится (указан в `.gitignore`). Можно не трогать или удалить, на сборку и работу приложения не влияет.

## Деплой (автоматический по push в main)

При пуше в `main` срабатывает GitHub Actions: SSH на сервер и выполняется `ops/scripts/deploy.sh`.

**Что нужно на сервере:** Docker (Postgres — порт 5433, backend — 8003), Node.js (для сборки фронта), nginx. Конфиг — `ops/nginx/nginx.conf`: статика из `/var/www/frontend`, проксирование `/api/` и `/health` на `127.0.0.1:8003`. HTTP (80) и HTTPS (443) с сертификатами Certbot, `server_name tipa.taska.uz`.

**Secrets в GitHub (Settings → Secrets and variables → Actions):**

| Secret | Обязательно | Описание |
|--------|--------------|----------|
| `SERVER_HOST` | да | Хост сервера |
| `SERVER_USER` | да | SSH-пользователь |
| `SERVER_SSH_KEY` | да | Приватный SSH-ключ |
| `SERVER_PATH` | да | Путь к репо на сервере (например `/var/www/tipa.taska.uz`) |
| `TELEGRAM_BOT_TOKEN` | да | Токен Telegram-бота (при деплое подставляется в `apps/bot/.env`; если бот не получает токен — проверьте, что секрет задан в Settings → Secrets and variables → Actions и называется именно `TELEGRAM_BOT_TOKEN`) |
| `BACKEND_URL` | рекомендуется | URL API для бота (например `http://127.0.0.1:8003` или полный URL) |
| `NGINX_SITE_NAME` | нет | Имя сайта nginx (по умолчанию `tipa.taska.uz`). Конфиг копируется в `/etc/nginx/sites-available/$NGINX_SITE_NAME`, затем `nginx -t` и `reload`. |

**После деплоя:** убедиться, что backend и БД подняты (`docker compose ps`), проверить сайт и логи (Настройки → Логи или `GET /api/system/logs`). Админа и пользователей создают вручную на сервере или через приложение (если есть регистрация).

**Тестовая отправка из админки (вкладка «Telegram бот»):** чтобы кнопки «Тест: ежедневная сводка / новая заявка / поздравление» работали, в окружении **backend** (Docker или .env на сервере) задайте переменную `TELEGRAM_BOT_TOKEN` (тот же токен, что у бота).

Миграция Firestore → Postgres уже выполнена. Скрипты остаются в `scripts/` (см. `scripts/README.md`). Подробно о деплое и окружении: **[`docs/operations/DEPLOY.md`](docs/operations/DEPLOY.md)**, **[`docs/operations/ENV_AND_SECRETS.md`](docs/operations/ENV_AND_SECRETS.md)**.

## Запуск локально (быстро)

### Backend + Postgres

```bash
docker-compose up -d
```

- API (Docker Compose): `http://localhost:8003` (на хосте; в контейнере 8000)
- DB: `localhost:5433` → Postgres в контейнере (порт 5432 внутри)

Подробности и несовпадение с прокси Vite (по умолчанию `8000`): см. [`docs/00-ONBOARDING.md`](docs/00-ONBOARDING.md).

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

## Тесты (smoke)

Из корня проекта при запущенном backend:

```bash
cd apps/api && pip install -r requirements-dev.txt && pytest tests/ -v
```

Переменная `TEST_API_URL` (по умолчанию `http://localhost:8000`) задаёт адрес API; при тестах против Docker укажите `http://localhost:8003`. Проверяются: `/health`, `/api/auth/login`, `/api/tasks`, `/api/system/logs`.

## Лимиты и надёжность

- **Одновременные пользователи:** жёсткого лимита в коде нет; всё упирается в воркеры uvicorn и пул соединений БД.
- **Проверки доставки (сообщения/задачи):** статусов «дошло/не дошло» в системе нет; при ошибке сохранения на API пользователь видит уведомление об ошибке.
- **Ошибки API:** при сбое сохранения (задача, пост, сделка, настройки и т.д.) во фронте показывается сообщение вида «Ошибка сохранения...» или «Не удалось сохранить задачу».

