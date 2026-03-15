# Деплой и миграция Firestore → Postgres

Краткий чеклист: заливка нового кода с Python-бэкендом, миграция данных, проверка и исправление багов.

## 1. Подготовка

- В GitHub → Settings → Secrets and variables → Actions заданы:
  - `SERVER_HOST`, `SERVER_USER`, `SERVER_SSH_KEY`, `SERVER_PATH`
  - `TELEGRAM_BOT_TOKEN`
  - `BACKEND_URL` — URL вашего API (например `https://tipa.taska.uz/api` или `http://127.0.0.1:8000` для бота на том же сервере)
- На сервере установлены: Docker (и Docker Compose), Node.js, nginx.
- Один раз положите на сервер ключ Firebase (для миграции): например скопируйте `firebase-service-account.json` в `$SERVER_PATH/firebase-key.json` и в Secrets добавьте `FIREBASE_CREDENTIALS=/var/www/tipa.taska.uz/firebase-key.json` (и при первом деплое — `RUN_MIGRATE_FIRESTORE=1`).

## 2. Деплой

Пуш в `main` запускает автодеплой:

1. Обновление кода (git pull).
2. Запуск Docker: Postgres + backend (`docker compose up -d db backend`).
3. Сборка фронта (`npm ci`, `npm run build:web`), копирование в `/var/www/frontend`.
4. Деплой Telegram-бота (systemd, .env с `TELEGRAM_BOT_TOKEN` и `BACKEND_URL`).
5. Если заданы `RUN_MIGRATE_FIRESTORE` и `FIREBASE_CREDENTIALS` — запуск скрипта миграции Firestore → Postgres.
6. Перезагрузка nginx.

## 3. Миграция данных (если не автоматически)

Если миграция не запускалась при деплое, зайдите на сервер и выполните один раз:

```bash
cd $SERVER_PATH   # например /var/www/tipa.taska.uz
pip install -r scripts/requirements-migrate.txt
export BACKEND_URL=http://127.0.0.1:8000
export FIREBASE_CREDENTIALS=/var/www/tipa.taska.uz/firebase-key.json
python3 scripts/migrate_firestore_to_postgres.py
```

Проверка без записи в API: добавьте `--dry-run`.

## 4. Проверка после деплоя

- **Backend:** `curl http://127.0.0.1:8000/health` → `{"status":"ok","db":"ok"}`.
- **Сайт:** открыть в браузере, авторизация, список задач, CRM, контент — всё открывается и сохраняется.
- **Бот:** написать боту в Telegram, убедиться, что он отвечает и видит данные (после миграции — из Postgres).
- **Логи:** в приложении «Настройки → Система / Логи» или `GET /api/system/logs?limit=50` — смотреть ошибки.

## 5. Если что-то сломалось

- **502 / API не отвечает:** backend не запущен. На сервере: `docker compose ps`, при необходимости `docker compose up -d db backend` и смотреть `docker compose logs backend`.
- **Фронт пустой или 404:** проверьте, что `/var/www/frontend` заполнен (деплой копирует туда `apps/web/dist`). Или поменяйте в nginx `root` на `$SERVER_PATH/apps/web/dist`.
- **Бот не видит данные:** в `apps/bot/.env` должен быть `BACKEND_URL` (URL API). После миграции бот ходит в Python API, а не в Firestore.
- **Ошибки при миграции:** смотреть вывод скрипта; при несовпадении полей — правки в скрипте или в API (маппинг camelCase ↔ snake_case). Логи API: `docker compose logs backend`.
- **Баги в интерфейсе:** логи фронта (F12 → Console), логи бэкенда и таблица `system_logs` — по ним править код и при необходимости делать хотфикс и повторный пуш в `main`.

После исправлений — коммит, пуш в `main`, автодеплой отработает снова.
