# Деплой и операции

---

## 1. Окружения

| Окружение | Где | Ветка | Деплой |
|-----------|-----|-------|--------|
| Локальное | localhost | любая | `docker-compose up` |
| Production | сервер | `main` | GitHub Actions → `deploy.sh` |

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
cd tipa.taska.uz

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

```bash
# apps/api/.env
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5433/tipa_dev
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=local-dev-secret-key-change-in-production-32chars
ENCRYPTION_KEY=<генерировать: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())">
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

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

## 3. Docker Compose (production)

```yaml
# docker-compose.yml
version: '3.9'

services:
  api:
    build: ./apps/api
    restart: unless-stopped
    environment:
      DATABASE_URL: ${DATABASE_URL}
      REDIS_URL: ${REDIS_URL}
      SECRET_KEY: ${SECRET_KEY}
      ENCRYPTION_KEY: ${ENCRYPTION_KEY}
      CORS_ORIGINS: ${CORS_ORIGINS}
      META_APP_SECRET: ${META_APP_SECRET}
      META_VERIFY_TOKEN: ${META_VERIFY_TOKEN}
      META_PAGE_ACCESS_TOKEN: ${META_PAGE_ACCESS_TOKEN}
      TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN}
      TELEGRAM_ALERT_CHAT_ID: ${TELEGRAM_ALERT_CHAT_ID}
    ports:
      - "127.0.0.1:8003:8000"   # только localhost, nginx проксирует
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 5s
      retries: 3

  worker-notifications:
    build: ./apps/api
    command: python -m workers.notifications_worker
    restart: unless-stopped
    environment:
      DATABASE_URL: ${DATABASE_URL}
      REDIS_URL: ${REDIS_URL}
      TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN}
    depends_on:
      - postgres
      - redis

  worker-integrations:
    build: ./apps/api
    command: python -m workers.integrations_worker
    restart: unless-stopped
    environment:
      DATABASE_URL: ${DATABASE_URL}
      REDIS_URL: ${REDIS_URL}
      TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN}
      META_APP_SECRET: ${META_APP_SECRET}
      ENCRYPTION_KEY: ${ENCRYPTION_KEY}
    depends_on:
      - postgres
      - redis

  bot:
    build: ./apps/bot
    restart: unless-stopped
    environment:
      TELEGRAM_BOT_TOKEN: ${TELEGRAM_EMPLOYEE_BOT_TOKEN}
      BACKEND_URL: http://api:8000
    depends_on:
      - api

  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-tipa_prod}
      POSTGRES_USER: ${POSTGRES_USER:-tipa}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-tipa}"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --appendonly yes --maxmemory 512mb --maxmemory-policy allkeys-lru
    volumes:
      - redisdata:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s

volumes:
  pgdata:
  redisdata:
```

---

## 4. nginx

```nginx
# ops/nginx/nginx.conf

server {
    listen 80;
    server_name tipa.taska.uz;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name tipa.taska.uz;
    
    ssl_certificate     /etc/letsencrypt/live/tipa.taska.uz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tipa.taska.uz/privkey.pem;
    
    # Безопасность
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header Referrer-Policy strict-origin-when-cross-origin;
    
    # Статика (React SPA)
    root /var/www/frontend;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
        
        # Кэш для статических ресурсов
        location ~* \.(js|css|png|jpg|ico|woff2)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # API (REST)
    location /api/ {
        proxy_pass http://127.0.0.1:8003;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
    
    # WebSocket (уведомления) — ОБЯЗАТЕЛЬНО!
    location /api/notifications/ws/ {
        proxy_pass http://127.0.0.1:8003;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 3600s;  # долгое соединение
        proxy_send_timeout 3600s;
    }
    
    # Meta Webhook (без /api префикса)
    location /webhook/ {
        proxy_pass http://127.0.0.1:8003;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # Health check
    location /health {
        proxy_pass http://127.0.0.1:8003;
    }
}
```

---

## 5. CI/CD (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env: { POSTGRES_PASSWORD: test, POSTGRES_DB: tipa_test }
      redis:
        image: redis:7
    steps:
      - uses: actions/checkout@v4
      - name: Backend tests
        run: |
          pip install -r apps/api/requirements-dev.txt
          pytest apps/api/tests/ -v
        env:
          DATABASE_URL: postgresql+asyncpg://postgres:test@localhost/tipa_test
          REDIS_URL: redis://localhost:6379/0
          SECRET_KEY: test-key-for-ci-at-least-32-characters-long
      
      - name: Frontend checks
        run: |
          npm ci
          npm run typecheck
          npm run lint
          npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Build frontend
        run: |
          npm ci
          npm run build
        env:
          VITE_API_URL: ''   # относительные пути

      - name: Deploy to server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SERVER_SSH_KEY }}
          script: |
            cd ${{ secrets.SERVER_PATH }}
            git pull origin main
            
            # Копировать собранный фронт
            rsync -az dist/ /var/www/frontend/
            
            # Запустить миграции и обновить контейнеры
            docker compose pull
            docker compose up -d --build api worker-notifications worker-integrations
            
            # Проверить здоровье
            sleep 5
            curl -f http://localhost:8003/health || exit 1
            
            echo "Deployment successful"
```

### GitHub Secrets (обязательные)

| Secret | Описание |
|--------|---------|
| `SERVER_HOST` | IP или hostname сервера |
| `SERVER_USER` | SSH-пользователь |
| `SERVER_SSH_KEY` | Приватный SSH-ключ |
| `SERVER_PATH` | Путь к репозиторию на сервере |
| `TELEGRAM_EMPLOYEE_BOT_TOKEN` | Токен бота команды |
| `BACKEND_URL` | URL API для бота |

**.env на сервере** (не в репозитории, не в Secrets):
```
DATABASE_URL=...
REDIS_URL=...
SECRET_KEY=<минимум 32 символа, сгенерировать: openssl rand -hex 32>
ENCRYPTION_KEY=<Fernet key>
CORS_ORIGINS=https://tipa.taska.uz
META_APP_SECRET=...
TELEGRAM_BOT_TOKEN=...
...
```

---

## 6. Миграции базы данных

```bash
# Проверить статус
docker compose exec api alembic current

# Применить все
docker compose exec api alembic upgrade head

# Откат на один шаг
docker compose exec api alembic downgrade -1

# Создать новую миграцию
docker compose exec api alembic revision --autogenerate -m "description"
```

**Миграции запускаются автоматически** при старте API-контейнера (через `lifespan`).  
При проблемах: `docker compose logs api | grep alembic`.

---

## 7. Резервное копирование

### PostgreSQL

```bash
# Ручной дамп
docker compose exec postgres pg_dump -U tipa tipa_prod > backup_$(date +%Y%m%d).sql

# Автоматический (cron на сервере)
0 3 * * * docker compose -f /var/www/tipa.taska.uz/docker-compose.yml \
  exec -T postgres pg_dump -U tipa tipa_prod \
  | gzip > /backups/tipa_$(date +%Y%m%d).sql.gz

# Хранить последние 30 дней
find /backups -name "tipa_*.sql.gz" -mtime +30 -delete
```

### Восстановление

```bash
gunzip < backup_20260101.sql.gz | docker compose exec -T postgres \
  psql -U tipa tipa_prod
```

---

## 8. Мониторинг и алерты

### Health Check

```bash
curl https://tipa.taska.uz/health
# {"status": "ok", "db": "ok", "redis": "ok", "timestamp": "2026-04-11T10:00:00Z"}
```

При `db: "error"` или `redis: "error"` — немедленно расследовать.

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
docker compose logs api --tail=100 -f

# Логи воркера уведомлений
docker compose logs worker-notifications --tail=50

# Системные логи через API
GET /api/admin/logs?level=error&limit=50

# Audit log для конкретной сущности
GET /api/system/audit?entity_type=deals&entity_id=<uuid>
```

---

## 9. Переменные окружения (полный список)

| Переменная | Обязательна | Описание | Пример |
|-----------|-------------|---------|--------|
| `DATABASE_URL` | ДА | PostgreSQL async URL | `postgresql+asyncpg://user:pass@host/db` |
| `REDIS_URL` | ДА | Redis URL | `redis://localhost:6379/0` |
| `SECRET_KEY` | ДА | JWT-ключ, ≥ 32 символа | `openssl rand -hex 32` |
| `ENCRYPTION_KEY` | ДА | Fernet-ключ для шифрования | `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` |
| `CORS_ORIGINS` | ДА | Разрешённые origins через запятую | `https://tipa.taska.uz` |
| `API_PREFIX` | нет | Префикс API | `/api` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | нет | Время жизни access token | `60` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | нет | Время жизни refresh token | `30` |
| `META_APP_SECRET` | если Meta | Секрет приложения Meta | — |
| `META_VERIFY_TOKEN` | если Meta | Verify token для вебхука | — |
| `META_PAGE_ACCESS_TOKEN` | если Meta | Токен страницы | — |
| `TELEGRAM_BOT_TOKEN` | если TG | Токен бота для лидов | — |
| `TELEGRAM_EMPLOYEE_BOT_TOKEN` | нет | Бот команды | — |
| `TELEGRAM_ALERT_CHAT_ID` | нет | Chat ID для алертов | — |
| `TELEGRAM_LEADS_POLL_INTERVAL_SECONDS` | нет | Интервал polling лидов | `5` |
| `REDIS_EVENTS_STREAM` | нет | Имя stream для событий | `events.domain.v1` |
| `NOTIFICATIONS_RETENTION_DAYS` | нет | Хранить уведомления N дней | `90` |
| `S3_ENDPOINT` | если медиа | URL хранилища | `http://minio:9000` |
| `S3_BUCKET` | если медиа | Имя bucket | `tipa-media` |
| `S3_ACCESS_KEY` | если медиа | Ключ доступа | — |
| `S3_SECRET_KEY` | если медиа | Секретный ключ | — |

---

## 10. Troubleshooting

| Симптом | Что проверить |
|---------|--------------|
| Уведомления не приходят в реальном времени | nginx config: есть ли секция `/api/notifications/ws/` с `Upgrade`? |
| «Чат не обновляется мгновенно» | Ожидаемо — polling ~5 сек. WebSocket только для колокольчика |
| Telegram доставки с задержкой | `docker compose logs worker-notifications` — есть ли ошибки? DLQ в БД? |
| CORS при отправке лида с сайта | Добавить origin в `CORS_ORIGINS` |
| API не стартует | Проверить `SECRET_KEY` (≥ 32 символа, не placeholder) и `DATABASE_URL` |
| Миграция упала при деплое | `docker compose logs api | grep alembic` + ручной `alembic downgrade -1` |
| `500 Internal Server Error` | `docker compose logs api --tail=50` + `/api/admin/logs?level=error` (JWT admin) |
| Bot не работает после деплоя | Проверить `TELEGRAM_EMPLOYEE_BOT_TOKEN` в GitHub Secrets и что workflow скопировал `.env` для бота |
| Redis недоступен | `docker compose ps redis` + `docker compose exec redis redis-cli ping` |

---

## 11. Runbook — процедуры по инцидентам

Runbook — это не документация кода, это инструкция «что делать прямо сейчас». Написан для человека в стрессе в 2 часа ночи.

---

### INC-01: Высокий процент 5xx ошибок

**Симптом:** алерт «HTTP 5xx rate > 1%», пользователи жалуются на ошибки.

```bash
# 1. Проверить живой ли API
curl https://tipa.taska.uz/health

# 2. Посмотреть последние ошибки
docker compose logs api --tail=100 | grep -E "ERROR|CRITICAL"
# или через UI: Настройки → Системные логи → filter: error

# 3. Если API не отвечает — перезапустить
docker compose restart api
sleep 5
curl https://tipa.taska.uz/health

# 4. Если падает после рестарта — проверить БД
docker compose ps postgres
docker compose exec postgres pg_isready -U tipa

# 5. Если БД недоступна — проверить диск
df -h
docker compose logs postgres --tail=50
```

**Эскалация:** если через 15 минут не восстановлено → уведомить команду.

---

### INC-02: Telegram уведомления не доставляются

**Симптом:** пользователи не получают Telegram-уведомления, задержка > 10 мин.

```bash
# 1. Проверить воркер
docker compose ps worker-notifications
docker compose logs worker-notifications --tail=50

# 2. Проверить DLQ
docker compose exec postgres psql -U tipa -d tipa_prod -c "
  SELECT queue_name, COUNT(*), MAX(failed_at)
  FROM dead_letter_queue
  WHERE resolved = false
  GROUP BY queue_name;
"

# 3. Проверить глубину очереди Redis
docker compose exec redis redis-cli XLEN queue.notifications

# 4. Если очередь пустая, но доставок нет — проверить notification_deliveries
docker compose exec postgres psql -U tipa -d tipa_prod -c "
  SELECT status, COUNT(*)
  FROM notification_deliveries
  WHERE created_at > now() - interval '1 hour'
  GROUP BY status;
"

# 5. Перезапустить воркер
docker compose restart worker-notifications
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
docker compose exec postgres psql -U tipa -d tipa_prod -c "
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
docker compose exec postgres psql -U tipa -d tipa_prod -c "
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
docker compose logs api 2>&1 | grep -A5 "alembic\|migration\|Error"

# 2. Проверить текущую версию миграции
docker compose exec api alembic current

# 3. Посмотреть историю
docker compose exec api alembic history --verbose

# 4. Откат на предыдущую версию (ОСТОРОЖНО — только если миграция не деструктивная)
docker compose exec api alembic downgrade -1

# 5. Перезапустить API (применит миграции снова при старте)
docker compose restart api

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
- WebSocket уведомления не работают
- Очереди не принимают задачи → доставки накапливаются в `notification_deliveries` со status=pending
- После восстановления Redis воркер автоматически продолжит обработку

---

### INC-06: Входящие лиды из Telegram не появляются

**Симптом:** лиды отправляют сообщения в бота, но в CRM ничего нет.

```bash
# 1. Проверить воркер интеграций
docker compose logs worker-integrations --tail=50

# 2. Проверить offset в Redis
docker compose exec redis redis-cli GET "telegram_offset:<funnel_id>"

# 3. Проверить токен воронки
docker compose exec postgres psql -U tipa -d tipa_prod -c "
  SELECT id, title, sources->>'telegram' as tg_source
  FROM funnels WHERE is_archived = false;
"
# token должен быть непустым

# 4. Вручную проверить токен
curl "https://api.telegram.org/bot<TOKEN>/getMe"
# → {"ok":true,"result":{...}} или {"ok":false,"error_code":401}

# 5. Сбросить offset (заставить перечитать последние N апдейтов)
docker compose exec redis redis-cli SET "telegram_offset:<funnel_id>" 0
docker compose restart worker-integrations
```

---

### INC-07: MTProto сессия упала (личный Telegram)

**Симптом:** ошибки синхронизации переписки, статус сессии `error` или `inactive`.

```bash
# 1. Проверить статус сессии в БД
docker compose exec postgres psql -U tipa -d tipa_prod -c "
  SELECT id, phone, status, updated_at
  FROM mtproto_sessions;
"

# 2. Если status = 'error' → нужна повторная авторизация
# Через UI: Настройки → Интеграции → Telegram → Переподключить

# 3. Если сессия зависла в pending_code/pending_password > 10 мин
docker compose exec postgres psql -U tipa -d tipa_prod -c "
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
