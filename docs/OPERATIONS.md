# Деплой и операции

При изменении деплоя сверяйте compose, CI и бэкапы с этим файлом и [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## 1. Окружения


| Окружение  | Где       | Ветка  | Деплой                       |
| ---------- | --------- | ------ | ---------------------------- |
| Локальное  | localhost | любая  | `docker-compose up`          |
| Production | сервер    | `main` | GitHub Actions → `deploy.sh` |


---

## 2. Локальный запуск

### 2.1 Требования

- Docker + Docker Compose
- Node.js 20+
- Python 3.11+ (если без Docker)

### 2.2 Быстрый старт

```bash
# Клонировать и запустить инфраструктуру
git clone ...
cd chiranaasia.taska.uz

# Backend (PostgreSQL + Redis + API)
docker-compose up -d

# Frontend (в соседнем терминале)
npm install
npm run dev:web

# Приложение: http://localhost:3000
# API: http://localhost:8003
# OpenAPI: http://localhost:8003/openapi.json
```

### 2.3 Файл `.env` (локальный)

Корневой **`docker-compose.yml`** поднимает сервис **`backend`** (образ из `apps/api/`). Переменные можно задать в корневом `.env` или экспортом перед `docker compose up`.

```bash
# Корень репозитория или apps/api/.env — по принятой у вас практике
DATABASE_URL=postgresql+asyncpg://taska:taska@localhost:5433/taska
REDIS_URL=redis://localhost:6379/0
# SECRET_KEY: минимум 32 символа; без шаблонов (change-me и т.п. — отклоняются в app.core.config)
SECRET_KEY=<openssl rand -hex 32>
# ENCRYPTION_KEY — если используете шифрование полей интеграций (Fernet)
# ENCRYPTION_KEY=<python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())">

CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# --- Безопасность (см. docs/SECURITY.md) ---
# ENVIRONMENT=development
# ACCESS_TOKEN_EXPIRE_MINUTES=60
# REFRESH_TOKEN_EXPIRE_DAYS=30
# BCRYPT_ROUNDS=12
# CSRF_PROTECTION_ENABLED=1
# SECURITY_ENABLE_HSTS=0
# SECURITY_CSP=
# MAX_REQUEST_BODY_BYTES=5000000
# WEBHOOK_MAX_BODY_BYTES=10000000
# COOKIE_SECURE=0
# COOKIE_SAMESITE=lax
# COOKIE_DOMAIN=
# LOGIN_MAX_ATTEMPTS=5
# LOGIN_LOCKOUT_SECONDS=900
```

**Продакшен:** `ENVIRONMENT=production`, `COOKIE_SECURE=1`, `CORS_ORIGINS` — только реальные HTTPS-origin'ы фронта; при TLS только на nginx можно включить `SECURITY_ENABLE_HSTS=1` на API, если к нему ходят напрямую по HTTPS.

### 2.4 Инструменты БД (опционально)

```bash
docker-compose --profile tools up -d
# Adminer: http://localhost:8080
```

### 2.5 Сброс БД

```bash
docker-compose down -v   # удаляет volumes
docker-compose up -d
```

---

## 3. Docker Compose

**Источник правды:** корневой [`docker-compose.yml`](../docker-compose.yml). Любые имена сервисов и порты — только оттуда; этот раздел — краткая сводка.

### 3.1 Сервисы (as-built в репозитории)


| Сервис | Назначение | Порты хоста (по умолчанию) |
| ------ | ---------- | -------------------------- |
| **`db`** | PostgreSQL 16 | **5433** → 5432 |
| **`redis`** | Redis 7, AOF | (внутренняя сеть) |
| **`backend`** | FastAPI / Uvicorn | **8003** → 8000 |
| **`integrations-worker`** | `workers.integrations_worker` | — |
| **`domain-events-worker`** | `workers.domain_events_worker` | — |
| **`notifications-worker`** | `workers.notifications_worker` | — |
| **`retention-worker`** | `workers.retention_worker` | — |
| **`adminer`**, **`pgadmin`** | UI БД | 8080 / 5050 — только с профилем **`tools`** (`docker compose --profile tools up -d`) |

Учётные данные БД по умолчанию в compose: пользователь и БД **`taska`**, пароль из **`DB_PASSWORD`** в корневом `.env` (см. [`.env.example`](../.env.example)).

**Прод:** привязка `backend` к `127.0.0.1:8003`, `restart: unless-stopped`, healthcheck и отдельный `redis` с `maxmemory` — настраиваются на сервере поверх этого файла или через override-файл compose; не дублируйте «вторую правду» без необходимости.

---

## 4. nginx

**Файл в репозитории:** [`ops/nginx/nginx.conf`](../ops/nginx/nginx.conf) — правьте его и копируйте на сервер после проверки `nginx -t`.

На **HTTPS** (`listen 443 ssl`) для сервера `chiranaasia.taska.uz` заданы:

- **HSTS:** `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- **X-Frame-Options: DENY**, **X-Content-Type-Options: nosniff**, **Referrer-Policy: strict-origin-when-cross-origin**
- **Content-Security-Policy** для SPA (в т.ч. `script-src 'self'`, `connect-src` с Meta/Telegram и `wss:`/`ws:` для уведомлений)

Обязательные **`location`**:

| Путь | Назначение |
|------|------------|
| `/` | Статика Vite build, `try_files` → `index.html` |
| `/api/` | Прокси на `127.0.0.1:8003` (или ваш порт backend) |
| `/api/notifications/ws/` | WebSocket: `Upgrade`, `Connection`, увеличенные `proxy_read_timeout` |
| `/webhook/` | Meta и др. вебхуки без префикса `/api` |
| `/health` | Публичный health backend: **200** `{"status":"ok"}` или **503** `{"status":"unavailable"}` если БД недоступна (`curl -f` падает на 503). Детали — только `GET /api/admin/health` с правами admin. |

HTTP → HTTPS: включите редирект с порта 80, когда сертификат готов (в репозитории есть закомментированный пример).

**Размер тела запроса:** в [`ops/nginx/nginx.conf`](../ops/nginx/nginx.conf) задано **`client_max_body_size 12m`** (выше лимитов API: `MAX_REQUEST_BODY_BYTES` / `WEBHOOK_MAX_BODY_BYTES`). После правки конфига — **`sudo nginx -t`** и **`reload`** (как в [`ops/scripts/deploy.sh`](../ops/scripts/deploy.sh)).

---

## 5. CI/CD (GitHub Actions)

**Факт в репозитории:** [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).

- **PR и push в `main`:** джобы `web` ([`ci-web.yml`](../.github/workflows/ci-web.yml)) и `api` ([`ci-api.yml`](../.github/workflows/ci-api.yml)) — линт, сборка фронта, pytest API (без integration), проверка **Alembic** (`heads` + `upgrade head` на сервисе Postgres в CI).
- **Деплой:** джоба `deploy` выполняется только на **push** или **workflow_dispatch** в ветку **`main`**, после успешных `web` и `api`. По SSH на сервер вызывается **[`ops/scripts/deploy.sh`](../ops/scripts/deploy.sh)** (в репозитории на сервере уже должен лежать актуальный `main`).

Скрипт деплоя:

1. `git fetch` + `git merge origin/main --ff-only`
2. дописывает в корневой `.env` секреты из GitHub (токены Meta/Telegram и т.д.)
3. **`docker compose up -d --build`** для **`db`**, **`redis`**, **`backend`**, **`integrations-worker`**, **`domain-events-worker`**, **`retention-worker`**, **`notifications-worker`** (см. §3)
4. пересобирает фронт (`npm ci`, `npm run build:web`) и обновляет **symlink** `FRONTEND_SYMLINK` (по умолчанию `/var/www/frontend`) на **`apps/web/dist`** — без rsync; см. **[ops/PORTS.md](../ops/PORTS.md)**
5. обновляет systemd-бота (`apps/bot`) при наличии токена
6. копирует **`ops/nginx/nginx.conf`** в sites-available и делает **`nginx -t`** + **`reload`**

Миграции БД накатываются **при старте контейнера `backend`** (см. §6), отдельный шаг в скрипте не нужен.

### GitHub Secrets (типовой набор для `deploy`)


| Secret | Описание |
| ------ | -------- |
| `SERVER_HOST` | IP или hostname сервера |
| `SERVER_USER` | SSH-пользователь |
| `SERVER_SSH_KEY` | Приватный SSH-ключ |
| `SERVER_PATH` | Путь к клону репозитория на сервере |
| `TELEGRAM_BOT_TOKEN` | Токен бота (в т.ч. для `deploy.sh` и compose) |
| `Meta_marker` или `META_MARKER` | Подтверждение маркера Meta |
| `META_TASKA`, `META_TIPA`, `META_UCHETGRAM` | Опционально, интеграции |
| `TELEGRAM_API_ID`, `TELEGRAM_API_HASH` | MTProto / личный Telegram |
| `BACKEND_URL` | URL API для бота (по умолчанию `http://127.0.0.1:` + порт из `BACKEND_PUBLISH_PORT`) |
| `BACKEND_PUBLISH_PORT` | Порт backend на хосте (как в `.env` compose); иначе скрипт читает из `.env` на сервере |
| `FRONTEND_SYMLINK` | Куда вешать symlink на `apps/web/dist` (по умолчанию `/var/www/frontend` = nginx `root`) |
| `NGINX_SITE_NAME` | Имя файла сайта nginx (по умолчанию `chiranaasia.taska.uz`) |

**.env на сервере** (корень репо): минимум **`DB_PASSWORD`**, **`SECRET_KEY`** — см. [`.env.example`](../.env.example); остальное дописывает скрипт из Secrets или задаётся вручную.

Полный перечень переменных приложения — раздел **§9** и [SECURITY.md](./SECURITY.md).

---

## 6. Миграции базы данных

Имя сервиса API в корневом compose — **`backend`** (не `api`).

```bash
# Проверить статус
docker compose exec backend alembic current

# Применить все
docker compose exec backend alembic upgrade head

# Откат на один шаг
docker compose exec backend alembic downgrade -1

# Создать новую миграцию
docker compose exec backend alembic revision --autogenerate -m "description"
```

**Политика:** при каждом старте процесса API выполняется **`alembic upgrade head`** в `lifespan` ([`apps/api/app/main.py`](../apps/api/app/main.py)). Ручные команды ниже — для отладки, отката или если контейнер не перезапускали.

Свежие примеры: **`026_auth_refresh`** — `users.token_version`, таблица **`refresh_tokens`**.

При проблемах: `docker compose logs backend | grep -i alembic`.

### 6.1 PostgreSQL: таймауты и тяжёлые запросы

- **`DATABASE_STATEMENT_TIMEOUT_MS`** (опционально в `.env` / compose для `backend` и воркеров): лимит одного SQL в миллисекундах на соединениях пула приложения (asyncpg `server_settings.statement_timeout`). **Alembic** при `upgrade` использует отдельный engine из `alembic/env.py` — этот лимит на миграции **не** распространяется. Подбирайте значение так, чтобы не обрывать легитимные отчёты; для прод-API часто **30–120 с** (30000–120000 мс), если нет долгих отчётов в том же процессе.
- **Роль в БД:** при необходимости задайте `statement_timeout` и на уровне роли PostgreSQL (единая политика для всех клиентов с этой ролью).
- **Диагностика:** расширение **`pg_stat_statements`**, просмотр `pg_stat_activity` для висящих запросов; при росте таблиц — следить за **autovacuum** и bloat (пороги — по метрикам, см. [ARCHITECTURE.md](./ARCHITECTURE.md) §16.4).

Подробнее про типы и ограничения схемы: [DATABASE.md](./DATABASE.md).

---

## 7. Резервное копирование

### PostgreSQL

Имя сервиса Postgres в compose — **`db`**; пользователь и БД по умолчанию из репозитория — **`taska`** / **`taska`** (пароль `DB_PASSWORD` в `.env`). Если на проде другие значения — подставьте их в команды.

```bash
# Ручной дамп (из корня репозитория на сервере)
docker compose exec db pg_dump -U taska taska > backup_$(date +%Y%m%d).sql

# Автоматический (cron на сервере)
0 3 * * * cd /var/www/chiranaasia.taska.uz && docker compose exec -T db pg_dump -U taska taska \
  | gzip > /backups/chiranaasia_$(date +\%Y\%m\%d).sql.gz

# Хранить последние 30 дней
find /backups -name "chiranaasia_*.sql.gz" -mtime +30 -delete
```

### Восстановление

```bash
gunzip < backup_20260101.sql.gz | docker compose exec -T db \
  psql -U taska -d taska
```

### Журнал учений restore (O4)

После каждого успешного теста восстановления на **копии** зафиксируйте дату и версию образа/миграции (внутренний wiki или строка ниже):

| Дата | Окружение | Версия `alembic` / git SHA | Примечание |
| ---- | --------- | -------------------------- | ---------- |
| _заполнить_ | staging / копия prod | | |

---

## 8. Мониторинг и алерты

### Health Check

```bash
curl https://chiranaasia.taska.uz/health
# Пример тела: {"status":"ok","version":"1.0.0","db":"ok"}
# При ошибке БД: "db":"error" и опционально "db_error" (диагностика)
```

Проверка Redis **в этом эндпоинте не отражается** — смотрите `docker compose exec redis redis-cli ping` и логи API при использовании Streams/lockout.

### Диагностика 5xx (краткий чеклист)

1. **Ответ API:** в JSON ошибки часто есть **`request_id`** — ищите его в логах `backend`.
2. **Логи:** `docker compose logs backend --tail=200` и при необходимости `notifications-worker`, `domain-events-worker`, `integrations-worker`.
3. **Метрики:** `GET /metrics` (см. ниже) — `http_requests_total`, `queue_depth`, `delivery_failed_total`; scrape только из доверенной сети или с Bearer **`PROMETHEUS_SCRAPE_TOKEN`** (см. nginx `location = /metrics`).
4. **Sentry:** при заданном **`SENTRY_DSN`** — события с тем же `request_id`/трейсом.
5. **Пороги нагрузки** (когда смотреть БД/Redis/воркеры): [ARCHITECTURE.md](./ARCHITECTURE.md) §16.4.

### Метрики (Prometheus)

```
Endpoint: GET /metrics  (только с внутренней сети, не публично!)

Ключевые метрики:
  http_requests_total{method, endpoint, status}
  http_request_duration_seconds (p50, p95, p99)
  queue_depth{queue_name}
  delivery_failed_total{channel}
  active_connections
```

### Алерты в Telegram

Настраиваются через `TELEGRAM_ALERT_CHAT_ID`:

- HTTP 5xx rate > 1% за 5 минут
- `/health` вернул ошибку
- Очередь `dead_letter_queue` не пустая
- Использование CPU/RAM > 90%

### Логи

```bash
# Логи API
docker compose logs backend --tail=100 -f

# Логи воркера уведомлений
docker compose logs notifications-worker --tail=50

# Системные логи через API
GET /api/admin/logs?level=error&limit=50

# Audit log для конкретной сущности
GET /api/system/audit?entity_type=deals&entity_id=<uuid>
```

---

## 9. Переменные окружения (полный список)


| Переменная                             | Обязательна | Описание                          | Пример                                                                                      |
| -------------------------------------- | ----------- | --------------------------------- | ------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                         | ДА          | PostgreSQL async URL              | `postgresql+asyncpg://user:pass@host/db`                                                    |
| `REDIS_URL`                            | ДА          | Redis URL                         | `redis://localhost:6379/0`                                                                  |
| `SECRET_KEY`                           | ДА          | JWT-ключ, ≥ 32 символа            | `openssl rand -hex 32`                                                                      |
| `DATABASE_STATEMENT_TIMEOUT_MS`      | нет         | Лимит одного SQL (мс), пул API/воркеров | `60000`                                                                                |
| `CORS_ORIGINS`                         | ДА          | Разрешённые origins через запятую | `https://chiranaasia.taska.uz`                                                                     |
| `API_PREFIX`                           | нет         | Префикс API                       | `/api`                                                                                      |
| `ACCESS_TOKEN_EXPIRE_MINUTES`          | нет         | Время жизни access JWT (минуты)   | `60`                                                                                        |
| `REFRESH_TOKEN_EXPIRE_DAYS`            | нет         | Время жизни refresh (дни)         | `30`                                                                                        |
| `BCRYPT_ROUNDS`                        | нет         | Раунды bcrypt (≥12)               | `12`                                                                                        |
| `ENVIRONMENT`                          | нет         | `production` — ожидания для прода | `development` / `production`                                                                |
| `CSRF_PROTECTION_ENABLED`              | нет         | `0` отключает CSRF (только отладка) | `1`                                                                                      |
| `SECURITY_CSP`                         | нет         | Переопределить CSP заголовок API  | пусто = дефолт в коде                                                                       |
| `SECURITY_ENABLE_HSTS`                 | нет         | HSTS на ответах API (прямой HTTPS)| `0` / `1`                                                                                   |
| `MAX_REQUEST_BODY_BYTES`               | нет         | Макс. размер тела запроса (байты) | `5000000`                                                                                   |
| `WEBHOOK_MAX_BODY_BYTES`               | нет         | Лимит для `/webhook/*`            | `10000000`                                                                                  |
| `COOKIE_SECURE`                        | нет         | Флаг Secure для csrf cookie       | `1` в проде за HTTPS                                                                        |
| `COOKIE_SAMESITE`                      | нет         | `lax` / `strict` / `none`         | `lax`                                                                                       |
| `COOKIE_DOMAIN`                        | нет         | Домен cookie (поддомены)           | пусто                                                                                       |
| `CSRF_COOKIE_NAME`                     | нет         | Имя cookie CSRF                   | `csrf_token`                                                                                |
| `LOGIN_MAX_ATTEMPTS`                   | нет         | Попыток до блокировки (Redis)     | `5`                                                                                         |
| `LOGIN_LOCKOUT_SECONDS`                | нет         | Длительность блокировки           | `900`                                                                                       |
| `META_APP_SECRET`                      | если Meta   | Секрет приложения Meta            | —                                                                                           |
| `META_MARKER`                          | если Meta   | Подтверждение маркера (verify)    | —                                                                                           |
| `META_TASKA`, `META_TIPA`, `META_UCHETGRAM` | нет    | Токены/маркеры по продуктам       | —                                                                                           |
| `TELEGRAM_BOT_TOKEN`                   | если TG     | Токен бота для лидов              | —                                                                                           |
| `TELEGRAM_EMPLOYEE_BOT_TOKEN`          | нет         | Бот команды                       | —                                                                                           |
| `TELEGRAM_ALERT_CHAT_ID`               | нет         | Chat ID для алертов               | —                                                                                           |
| `TELEGRAM_LEADS_POLL_INTERVAL_SECONDS` | нет         | Интервал polling лидов            | `5`                                                                                         |
| `REDIS_*_STREAM`, `REDIS_*_GROUP`, `DOMAIN_EVENTS_HUB_ASYNC` | нет | Очереди Redis — см. [QUEUES.md](./QUEUES.md) | `queue.domain.v1`, … |
| `NOTIFICATIONS_RETENTION_*`            | нет         | Retention-worker                  | `90` / `3600`                                                                               |
| `SENTRY_DSN`, `PROMETHEUS_SCRAPE_TOKEN` | нет      | Наблюдаемость                     | —                                                                                           |
| `S3_BUCKET`, `S3_ENDPOINT_URL`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | если медиа | S3-совместимое хранилище | см. `config.py` |
| `TELEGRAM_API_ID`, `TELEGRAM_API_HASH` | нет         | MTProto (личный Telegram)         | —                                                                                           |


---

## 10. Troubleshooting


| Симптом                                    | Что проверить                                                                                      |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Уведомления не приходят в реальном времени | nginx config: есть ли секция `/api/notifications/ws/` с `Upgrade`?                                 |
| «Чат не обновляется мгновенно»             | Ожидаемо — polling ~5 сек. WebSocket только для колокольчика                                       |
| Telegram доставки с задержкой              | `docker compose logs notifications-worker` — есть ли ошибки? DLQ в БД?                             |
| CORS при отправке лида с сайта             | Добавить origin в `CORS_ORIGINS`                                                                   |
| `403 Invalid origin` / `CSRF token missing` с браузера | Проверить `CORS_ORIGINS`, что фронт шлёт `Origin` и cookie+заголовок CSRF (см. [SECURITY.md](./SECURITY.md)) |
| API не стартует                            | Проверить `SECRET_KEY` (≥ 32 символа, не placeholder) и `DATABASE_URL`                             |
| Миграция упала при деплое                  | `docker compose logs backend \| grep -i alembic`                                                    |
| `500 Internal Server Error`                | В теле ответа есть `request_id`; логи: `docker compose logs backend --tail=50`, админка `/api/admin/logs` |
| Bot не работает после деплоя               | Проверить **`TELEGRAM_BOT_TOKEN`** в GitHub Secrets (`deploy` → `deploy.sh` → корневой `.env` и `apps/bot`); systemd `telegram-bot` |
| Redis недоступен                           | `docker compose ps redis` + `docker compose exec redis redis-cli ping`                             |


---

## 11. Runbook — процедуры по инцидентам

Runbook — это не документация кода, это инструкция «что делать прямо сейчас». Написан для человека в стрессе в 2 часа ночи.

---

### INC-01: Высокий процент 5xx ошибок

**Симптом:** алерт «HTTP 5xx rate > 1%», пользователи жалуются на ошибки.

```bash
# 1. Проверить живой ли API
curl https://chiranaasia.taska.uz/health

# 2. Посмотреть последние ошибки
docker compose logs backend --tail=100 | grep -E "ERROR|CRITICAL"
# или через UI: Настройки → Системные логи → filter: error

# 3. Если API не отвечает — перезапустить
docker compose restart backend
sleep 5
curl https://chiranaasia.taska.uz/health

# 4. Если падает после рестарта — проверить БД
docker compose ps db
docker compose exec db pg_isready -U taska -d taska

# 5. Если БД недоступна — проверить диск
df -h
docker compose logs db --tail=50
```

**Эскалация:** если через 15 минут не восстановлено → уведомить команду.

---

### INC-02: Telegram уведомления не доставляются

**Симптом:** пользователи не получают Telegram-уведомления, задержка > 10 мин.

```bash
# 1. Проверить воркер
docker compose ps notifications-worker
docker compose logs notifications-worker --tail=50

# 2. Проверить DLQ
docker compose exec db psql -U taska -d taska -c "
  SELECT queue_name, COUNT(*), MAX(failed_at)
  FROM dead_letter_queue
  WHERE resolved = false
  GROUP BY queue_name;
"

# 3. Проверить глубину очереди Redis
docker compose exec redis redis-cli XLEN queue.notifications.v1

# 4. Если очередь пустая, но доставок нет — проверить notification_deliveries
docker compose exec db psql -U taska -d taska -c "
  SELECT status, COUNT(*)
  FROM notification_deliveries
  WHERE created_at > now() - interval '1 hour'
  GROUP BY status;
"

# 5. Перезапустить воркер
docker compose restart notifications-worker
```

**Возможные причины:**

- Telegram Bot API заблокировал токен → проверить токен в настройках воронки
- Превышен rate limit Telegram → `delivery.last_error` содержит `retry_after`
- Redis недоступен → см. INC-05

---

### INC-03: DLQ не пустой (Dead Letter Queue)

**Симптом:** алерт «DLQ unresolved > 0».

```bash
# 1. Посмотреть что в DLQ
docker compose exec db psql -U taska -d taska -c "
  SELECT id, queue_name, message->>'type' as type,
         error, attempts, failed_at
  FROM dead_letter_queue
  WHERE resolved = false
  ORDER BY failed_at DESC
  LIMIT 20;
"

# 2. Для каждого типа ошибки принять решение:
#    - Transient (сеть, таймаут) → можно переотправить вручную
#    - Permanent (невалидные данные) → пометить resolved + изучить

# 3. Ручная переотправка (если уверен что ошибка устранена)
docker compose exec db psql -U taska -d taska -c "
  -- Вернуть сообщение в очередь через Redis
  -- (или через admin endpoint, если реализован)
  UPDATE dead_letter_queue SET resolved = true, resolved_at = now()
  WHERE id = '<uuid>';
"
```

---

### INC-04: Упала миграция БД при деплое

**Симптом:** деплой завершился с ошибкой alembic.

```bash
# 1. Посмотреть что случилось
docker compose logs backend 2>&1 | grep -A5 "alembic\|migration\|Error"

# 2. Проверить текущую версию миграции
docker compose exec backend alembic current

# 3. Посмотреть историю
docker compose exec backend alembic history --verbose

# 4. Откат на предыдущую версию (ОСТОРОЖНО — только если миграция не деструктивная)
docker compose exec backend alembic downgrade -1

# 5. Перезапустить API (применит миграции снова при старте)
docker compose restart backend

# 6. Если откат невозможен — поднять с backup
# (см. §7 — восстановление из backup)
```

**Правило:** деструктивные миграции (drop column, rename) — всегда делать в 2 шага:  
deploy 1: add new column, deploy 2 (через несколько дней): drop old.

---

### INC-05: Redis недоступен

**Симптом:** ошибки в логах `ConnectionRefusedError: [Errno 111]`, очереди не работают.

```bash
# 1. Статус контейнера
docker compose ps redis

# 2. Пинг
docker compose exec redis redis-cli ping
# → PONG (OK) или connection refused (проблема)

# 3. Логи Redis
docker compose logs redis --tail=50

# 4. Проверить диск (Redis может упасть при OOM)
docker stats redis --no-stream

# 5. Перезапустить
docker compose restart redis

# 6. Проверить appendonly файл (если не стартует)
# redis-check-aof --fix /data/appendonly.aof  # внутри контейнера
```

**Поведение системы при недоступном Redis:**

- API продолжает работать (PostgreSQL — основное хранилище)
- **Блокировка логина по числу неудач отключается** (см. логи `Login throttle: Redis недоступен`)
- События в Redis Stream не публикуются (события остаются в БД — по текущей логике приложения)
- WebSocket уведомления / воркеры, завязанные на Redis, могут деградировать
- После восстановления Redis перезапустите при необходимости `backend` и воркеры

---

### INC-06: Входящие лиды из Telegram не появляются

**Симптом:** лиды отправляют сообщения в бота, но в CRM ничего нет.

```bash
# 1. Проверить воркер интеграций
docker compose logs integrations-worker --tail=50

# 2. Проверить offset в Redis
docker compose exec redis redis-cli GET "telegram_offset:<funnel_id>"

# 3. Проверить токен воронки
docker compose exec db psql -U taska -d taska -c "
  SELECT id, title, sources->>'telegram' as tg_source
  FROM funnels WHERE is_archived = false;
"
# token должен быть непустым

# 4. Вручную проверить токен
curl "https://api.telegram.org/bot<TOKEN>/getMe"
# → {"ok":true,"result":{...}} или {"ok":false,"error_code":401}

# 5. Сбросить offset (заставить перечитать последние N апдейтов)
docker compose exec redis redis-cli SET "telegram_offset:<funnel_id>" 0
docker compose restart integrations-worker
```

---

### INC-07: MTProto сессия упала (личный Telegram)

**Симптом:** ошибки синхронизации переписки, статус сессии `error` или `inactive`.

```bash
# 1. Проверить статус сессии в БД
docker compose exec db psql -U taska -d taska -c "
  SELECT id, phone, status, updated_at
  FROM mtproto_sessions;
"

# 2. Если status = 'error' → нужна повторная авторизация
# Через UI: Настройки → Интеграции → Telegram → Переподключить

# 3. Если сессия зависла в pending_code/pending_password > 10 мин
docker compose exec db psql -U taska -d taska -c "
  UPDATE mtproto_sessions SET status = 'inactive'
  WHERE status IN ('pending_code','pending_password')
  AND updated_at < now() - interval '10 minutes';
"
```

---

### Общий чеклист после любого инцидента

```
[ ] Инцидент задокументирован в system_logs или внешнем трекере
[ ] Первопричина определена (не просто «перезапустили»)
[ ] DLQ проверен и очищен или помечен resolved
[ ] Метрики вернулись в норму (5xx < 1%, queue_depth < 100)
[ ] При необходимости — создана задача на устранение root cause
```

