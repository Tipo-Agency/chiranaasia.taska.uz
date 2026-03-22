# Деплой

## Триггер

Пуш в ветку **`main`** запускает GitHub Actions (`.github/workflows/deploy.yml`): SSH на сервер и выполнение **`ops/scripts/deploy.sh`**.

Локально можно инициировать пуш: `npm run push` (обёртка над `git push origin main`).

## Принципы

- Код обновляется через **`git fetch` + `git merge origin/main --ff-only`** — без `git reset --hard` и без `git clean`.
- Данные PostgreSQL живут в **Docker volume** (`pgdata`), при деплое не удаляются.
- Фронт пересобирается и **полностью заменяется** в `/var/www/frontend` (`rsync --delete`).

## Шаги скрипта `ops/scripts/deploy.sh` (логика)

1. Права на каталог репозитория (`SERVER_PATH`).
2. Обновление кода (merge ff-only).
3. **`.env` в корне репо** — запись `TELEGRAM_BOT_TOKEN` из окружения деплоя (для backend в Docker).
4. **`docker compose up -d --build db backend`** затем **`--force-recreate backend`**, чтобы подтянуть env.
5. Ожидание `GET http://127.0.0.1:8003/health`.
6. **`npm ci`** → **`npm run build:web`** → копирование `apps/web/dist/` в **`/var/www/frontend`**.
7. Деплой бота: `apps/bot/.env`, при наличии **`telegram-bot.service`** — копия в systemd, `deploy.sh` бота, `systemctl restart telegram-bot`.
8. Копирование **`ops/nginx/nginx.conf`** в `/etc/nginx/sites-available/$NGINX_SITE_NAME`, symlink в `sites-enabled`, **`nginx -t`** и **`reload`**.

## Порты (как принято в проекте)

| Сервис | Хост (сервер/локально в compose) | Назначение |
|--------|----------------------------------|------------|
| PostgreSQL | **5433** → 5432 в контейнере | БД |
| Backend API | **8003** → 8000 в контейнере | FastAPI |
| nginx | 80 / 443 | Статика + прокси |

## Nginx

Шаблон: `ops/nginx/nginx.conf`.

- Корень сайта: **`root /var/www/frontend`**, SPA: `try_files … /index.html`.
- **`location /api/`** и **`/health`** → `proxy_pass http://127.0.0.1:8003`.

SSL: Certbot на сервере (пути к сертификатам в конфиге). При первом выпуске — стандартная процедура `certbot --nginx`.

## Что не делает деплой

- Не создаёт пользователей/админов автоматически.
- Не выполняет одноразовую миграцию Firestore (уже не актуально).

## Проверка после деплоя

```bash
curl -s https://tipa.taska.uz/health
docker compose -f <path>/docker-compose.yml ps
```

В приложении: **Настройки → Логи** или `GET /api/system/logs` (с авторизацией).
