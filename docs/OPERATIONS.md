# Эксплуатация: запуск, деплой, секреты, troubleshooting

## 1. Локальный запуск (быстро)

### 1.1 Backend + Postgres (Docker)

```bash
docker-compose up -d
```

Типичные порты на хосте (см. `docker-compose.yml` в корне):

- API: `http://localhost:8003` (проброс с контейнера; внутри контейнера часто `8000`)
- Postgres: `localhost:5433` → `5432` внутри контейнера

### 1.2 Frontend

```bash
npm install
npm run dev:web
```

Vite по умолчанию: `http://localhost:3000`, прокси `**/api**` на backend (в `vite.config` обычно целевой порт **8000**). Если API поднят на **8003**, выровняйте прокси или обращайтесь к API напрямую через `VITE_API_URL`.

### 1.3 Инструменты БД (опционально)

```bash
docker-compose --profile tools up -d
```

Adminer / pgAdmin — порты и пароли из `docker-compose.yml` и переменных `PGADMIN_*`.

## 2. Проверка здоровья

- `**GET /health**` — `{"status":"ok",...,"db":"ok"}`.
- **Логи приложения:** таблица `system_logs`; в UI — **Настройки → Система / Логи** или `GET /api/admin/logs?limit=50` (JWT + право системной админки; legacy: `/api/system/logs`).
- **Telegram-алерты по CRITICAL:** при настроенных `TELEGRAM_EMPLOYEE_BOT_TOKEN` и `TELEGRAM_ALERT_CHAT_ID` в окружении backend.

## 3. CI и деплой

### 3.1 Поток

Пуш в `**main`** → GitHub Actions: lint/typecheck/build фронта, проверки API (например ruff) → при успехе SSH на сервер и `**ops/scripts/deploy.sh**`.

На **pull request** в `main` обычно выполняется только CI без деплоя.

### 3.2 Сервер

- **Docker** — Postgres и backend.
- **Node.js** — сборка фронта.
- **nginx** — статика из `/var/www/frontend`, проксирование `/api/` и `/health` на backend (часто `127.0.0.1:8003`).

Конфиг-пример: `ops/nginx/nginx.conf`. Имя сайта по умолчанию `tipa.taska.uz`; HTTPS — Certbot.

### 3.3 Секреты GitHub (Settings → Secrets and variables → Actions)


| Secret               | Назначение                                                        |
| -------------------- | ----------------------------------------------------------------- |
| `SERVER_HOST`        | Хост сервера                                                      |
| `SERVER_USER`        | SSH-пользователь                                                  |
| `SERVER_SSH_KEY`     | Приватный ключ                                                    |
| `SERVER_PATH`        | Путь к репозиторию на сервере (например `/var/www/tipa.taska.uz`) |
| `TELEGRAM_BOT_TOKEN` | Токен бота (подстановка в `apps/bot/.env` при деплое)             |
| `BACKEND_URL`        | URL API для бота                                                  |
| `NGINX_SITE_NAME`    | Опционально; имя файла сайта в nginx                              |


После деплоя: `docker compose ps`, проверка сайта и логов.

### 3.4 Тесты API (smoke)

```bash
cd apps/api && pip install -r requirements-dev.txt && pytest tests/ -v
```

`TEST_API_URL` по умолчанию `http://localhost:8000`; для Docker на хосте часто `http://localhost:8003`.

## 4. Переменные окружения (ориентиры)

Точный список — в `apps/api/app/config.py` / `.env.example` (если есть).

Частые:

- `**DATABASE_URL**` — async PostgreSQL (asyncpg).
- `**SECRET_KEY**` — JWT.
- `**CORS_ORIGINS**` — origins через запятую.
- `**TELEGRAM_BOT_TOKEN**` — для исходящих тестов из админки и бота.
- `**META_***` — интеграция Meta.
- Для алертов: `**TELEGRAM_EMPLOYEE_BOT_TOKEN**`, `**TELEGRAM_ALERT_CHAT_ID**`.

Секреты в репозиторий не коммитить; прод — только сервер и GitHub Secrets.

## 5. Troubleshooting


| Симптом                               | Что проверить                                                                       |
| ------------------------------------- | ----------------------------------------------------------------------------------- |
| Уведомления только после перезагрузки | WebSocket: nginx должен проксировать `Upgrade`; при ошибке фронт может отключить WS |
| «Чат не обновляется мгновенно»        | Ожидаемо: MiniMessenger использует **polling ~5 с**                                 |
| Telegram исходящие с задержкой        | Очередь `notification_deliveries`, интервал воркера в `main.py`                     |
| CORS при отправке формы с сайта       | Добавить origin сайта в `CORS_ORIGINS`                                              |
| Деплой не подхватил бота              | Проверить `TELEGRAM_BOT_TOKEN` в Secrets и что workflow копирует `.env` для бота    |


## 6. SSH и доступ к серверу

- Ключ: секрет `**SERVER_SSH_KEY`** (полная строка private key, включая `BEGIN/END`).
- После добавления ключа на сервер в `authorized_keys` деплой выполняется из Actions.

Детали конкретного хостинга не фиксируются в репозитории — согласуйте с администратором.

## 7. Лимиты и ожидания

- Жёсткого лимита одновременных пользователей в коде нет; упирается в uvicorn и пул БД.
- Статусов «доставлено/не доставлено» для каждого сообщения в продукте может не быть — при ошибке API пользователь видит сообщение об ошибке сохранения.

