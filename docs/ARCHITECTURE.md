# Архитектура системы

---

## Соглашения: **[CURRENT]** vs **[TARGET]**

Чтобы не смешивать «как в коде сейчас» и «как задумано», в тексте используются маркеры:


| Маркер          | Смысл                                                                                 |
| --------------- | ------------------------------------------------------------------------------------- |
| `**[CURRENT]`** | Фактическое поведение в репозитории (`apps/api`, `apps/web`, `apps/bot`).             |
| `**[TARGET]`**  | Целевое состояние; пока не реализовано — не рассчитывать на это в проде без проверки. |


**Пример в одну строку:** `process_domain_event` → **[CURRENT]** в HTTP при `DOMAIN_EVENTS_HUB_ASYNC=false` · **[CURRENT]** во воркере при `DOMAIN_EVENTS_HUB_ASYNC=true` (см. `docs/QUEUES.md`, §6–§7).

Таблица «сейчас vs цель» по темам — в §13; детальные потоки ниже помечены там, где это уменьшает двусмысленность.

**Индекс документации и сводка [CURRENT] / [TARGET]:** [`DOCUMENTATION.md`](./DOCUMENTATION.md). Ключевые ссылки: [`API.md`](./API.md), [`DATABASE.md`](./DATABASE.md), [`ENTITIES.md`](./ENTITIES.md), [`QUEUES.md`](./QUEUES.md), [`INTEGRATIONS.md`](./INTEGRATIONS.md), [`OPERATIONS.md`](./OPERATIONS.md), [`DECISIONS.md`](./DECISIONS.md), [`SECURITY.md`](./SECURITY.md), [`apps/api/CLAUDE.md`](../apps/api/CLAUDE.md), [`apps/web/CLAUDE.md`](../apps/web/CLAUDE.md).

---

## 1. Принципы


| Принцип                           | Что означает на практике                                                                                 |
| --------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **FastAPI как оркестратор**       | Роутеры тонкие: только HTTP-контракт, валидация, авторизация. Логика — в `services/` и `domain/`.        |
| **Домен в центре**                | Бизнес-правила не зависят от FastAPI и SQLAlchemy. Можно тестировать без HTTP-сервера.                   |
| **Stateless API**                 | Горизонтальное масштабирование без sticky-sessions (кроме WebSocket — см. §5).                           |
| **Явные переходы**                | Долгоживущие процессы (сессии Telegram, доставки) — конечные автоматы с задокументированными переходами. |
| **Устойчивость**                  | Retries с backoff, DLQ, идемпотентность — часть спецификации, не догоняющий рефакторинг.                 |
| **Принцип наименьших привилегий** | Секреты только на сервере. Каждый токен — минимальный scope. Медиа через API-прокси.                     |
| **Наблюдаемость**                 | Система без логов и метрик — чёрный ящик. Structured logs + Sentry + Prometheus — обязательный минимум.  |
| **Защитные таймауты**             | Каждый вызов внешнего сервиса имеет явный таймаут. Зависание одной интеграции не убивает worker.         |


---

## 2. Высокоуровневая схема

```
┌─────────────────────────────────────────────────┐
│                   КЛИЕНТЫ                        │
│   [Браузер SPA]          [Telegram Bot API]      │
└───────────┬──────────────────────┬───────────────┘
            │ HTTPS / WSS          │ HTTP (Webhook)
            ▼                      ▼
┌─────────────────────────────────────────────────┐
│                    nginx                         │
│   Статика · Reverse proxy · TLS termination      │
└───────────────────────┬─────────────────────────┘
                        │
            ┌───────────┴───────────┐
            ▼                       ▼
┌──────────────────┐    ┌──────────────────────────┐
│   FastAPI (API)  │    │   apps/bot               │
│   REST + WS      │    │   Telegram user-bot       │
│   RBAC · JWT     │◄───│   (отдельный процесс)     │
└────────┬─────────┘    └──────────────────────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐  ┌───────────────────────┐
│  PG   │  │  Redis                │
│  SoT  │  │  Streams / Pub-Sub    │
└───────┘  └───────────┬───────────┘
                       │
            ┌──────────┴──────────┐
            ▼                     ▼
┌─────────────────────┐  ┌──────────────────────┐
│ Worker: Notifs      │  │ Worker: Integrations  │
│ (отдельный проц.)   │  │ (отдельный проц.)     │
└─────────────────────┘  └──────────────────────┘
            │                     │
            ▼                     ▼
┌───────────────────────────────────────────────┐
│   Внешние сервисы                             │
│   Telegram Bot API · Meta Graph API · MTProto │
└───────────────────────────────────────────────┘
```

---

## 3. Слои приложения

### 3.1 Backend

```
apps/api/app/
│
├── main.py           FastAPI-приложение, middleware, lifespan
├── core/             Конфиг, JWT/auth, RBAC-константы, rate limit, mappers (row_to_*), seed
├── db/               Base, engine, сессии (get_db)
├── middleware/       CSRF, security headers, request id, лимит body
├── api/routers/      TRANSPORT LAYER
│   └── tasks.py      HTTP: валидация, вызов сервиса/ORM, ответ. Без тяжёлой бизнес-логики.
│
├── services/         APPLICATION LAYER
│   └── …             События, уведомления, интеграции, RBAC-helpers
│
├── domain/           DOMAIN LAYER — чистые правила без ORM/HTTP (`deals`, `finance_requests`, …); остальное в `services/`
│
├── models/           INFRASTRUCTURE (ORM)
│   └── task.py       SQLAlchemy. Минимум логики.
│
└── schemas/          CONTRACTS (Pydantic, точечно)
```

**Правило слоёв:** зависимости сверху вниз.  
`api/routers` → `services` → `models`; `core` и `db` — основание без импорта роутеров.

### 3.2 Frontend

**[CURRENT]** — фактическая раскладка (см. также `apps/web/CLAUDE.md`):

```
apps/web/
│
├── App.tsx                 Корень: публичный контент-план или провайдеры + авторизованное приложение
├── routes/                 View-модули дорожной карты UI (DashboardRoutes, TaskRoutes, …), AuthGuard
├── providers/              AppProviders, AppShellProviders
│
├── frontend/
│   ├── MainApp.tsx         Layout после логина, модалки, AppRouter
│   └── hooks/              useAppLogic, slices/ (состояние и загрузка данных)
│
├── components/             UI LAYER
│   ├── ui/                 Примитивы (Button, Input, Modal…)
│   ├── modules/            CRMHubModule, FinanceModule…
│   ├── pages/              WorkdeskView, TasksPage…
│   ├── settings/           Настройки и админ-врезки
│   └── features/           Доменные блоки (chat/, deals/, …)
│
├── backend/                Единый фасад HTTP
│   └── api.ts              Объект `api.*` над endpoint-модулями из services/apiClient.ts
│
├── services/
│   └── apiClient.ts        fetch, CSRF, cookies, обработка 401/403/422/5xx
│
├── types/                  CONTRACTS (доменные файлы + index.ts — barrel)
│
├── stores/                 [TARGET] Zustand — пока не обязательный слой
│
└── utils/, constants/, contexts/  Вспомогательное
```

Роутинг: **без react-router** — переключение `currentView` и ветвление в `AppRouter` (см. `routes/*.tsx`).

---

## 4. Поток данных: типовой HTTP-запрос

```
1. Пользователь действует в UI
2. api.ts: fetch /api/tasks  + cookie (JWT) + X-CSRF-Token
3. nginx: проксирует на FastAPI
4. RequestIDMiddleware: устанавливает X-Request-ID
5. SlowAPIMiddleware (slowapi): лимиты, заголовки `X-RateLimit-*`   [CURRENT] — см. docs/API.md
6. CSRFMiddleware: `X-CSRF-Token` для мутирующих `/api/*` (кроме исключений) [CURRENT] — см. §8
7. Router: валидация тела (Pydantic), require_permission()
8. Service: бизнес-логика
9. Domain: проверка инвариантов
10. SQLAlchemy → PostgreSQL
11. emit_domain_event → notification_events (PG) + Redis XADD   [CURRENT]
12. process_domain_event → notifications + deliveries             [CURRENT] HTTP или воркер (`DOMAIN_EVENTS_HUB_ASYNC`)
13. realtime_hub.emit → Redis PUBLISH → PSUBSCRIBE → локальные WebSocket   [CURRENT] (лимит вкладок: `WEBSOCKET_MAX_CONNECTIONS_PER_USER`)
14. Response JSON → клиент
```

Шаги 5–6 и доставка realtime приведены к **[CURRENT]** по `main.py`; детали лимитов и CSRF — `docs/API.md`.

---

## 5. WebSocket (уведомления)

**[CURRENT]:** `realtime_hub` — локальные WebSocket + **Redis Pub/Sub** (`taska:pub:notifications:user:{userId}`) для нескольких инстансов API; лимит соединений на пользователя — `WEBSOCKET_MAX_CONNECTIONS_PER_USER`.

```
Инстанс A                Redis               Инстанс B
emit(user_id, msg)  →  PUBLISH channel   →  подписчики
      ↓                                          ↓
  WS-клиент A                             WS-клиент B
```

**URL:** `wss://chiranaasia.taska.uz/api/notifications/ws/{user_id}`  
**nginx:** требует заголовок `Upgrade: websocket` + `Connection: Upgrade`.  
**Переподключение:** клиент делает exponential backoff (1s → 2s → 4s → max 30s).

### Лимит соединений на пользователя **[TARGET]**

Один пользователь может открыть несколько вкладок → несколько одновременных WS. Без лимита возможна утечка файловых дескрипторов и памяти на сервере.

```text
1 user_id = N активных WebSocket (вкладки, устройства)
рекомендуемый лимит: N_max = 10 (настраиваемая константа)
при превышении: закрыть самое старое соединение или отклонить новое (например WebSocket close `1008` policy violation + понятный `reason`)
```

**[CURRENT]:** явный лимит в коде может отсутствовать — зафиксировать в бэлоге при появлении утечек.

---

## 6. Очереди и фоновые задачи

### 6.1 Текущее состояние (as-built) **[CURRENT]**

Фоновые задачи смешанные:

- **Доставка telegram/e-mail уведомлений** — Redis Stream `queue.notifications.v1` (env `REDIS_NOTIFICATIONS_STREAM`) + consumer group `notifications`; воркер `python -m workers.notifications_worker` (XREADGROUP / XAUTOCLAIM, XACK). API только **XADD** с полем `notification_id` при создании уведомления и при ручном дренаже.
- `**poll_all_funnels`** (Telegram лиды) — в `integrations_worker`, по интервалу из настроек.
- **Retention уведомлений** — отдельный процесс `python -m workers.retention_worker` (в compose: `retention-worker`).
- **Построение уведомлений по доменным событиям** — при `DOMAIN_EVENTS_HUB_ASYNC=true`: `python -m workers.domain_events_worker` читает `REDIS_EVENTS_STREAM` (по умолчанию `queue.domain.v1`) в группе `notification_hub`; иначе hub остаётся синхронно в HTTP.

**Проблемы:** без воркеров соответствующие очереди не разбираются; см. таблицу `[docs/QUEUES.md](./QUEUES.md)`.

### 6.2 Целевое состояние **[TARGET]**

Имена потоков (очередей) версионируются с суффиксом `**.v1`**, чтобы при смене формата payload старые воркеры не читали несовместимые сообщения из того же ключа — поднимается `queue.*.v2`, старый поток дренируется и выключается.

```yaml
# Отдельные Redis Streams + Consumer Groups (имена — пример контракта)
streams:
  queue.notifications.v1:   # Telegram, e-mail доставки
  queue.integrations.v1:    # Meta вебхуки, MTProto синк, Telegram polling
  queue.tasks.v1:           # массовые операции, отчёты

# Отдельные воркер-процессы
workers:
  - notifications_worker    # читает queue.notifications.v1
  - integrations_worker     # читает queue.integrations.v1
```

Сводная таблица stream / group / воркер: `[docs/QUEUES.md](./QUEUES.md)`.

Протокол XREADGROUP:

```
API: XADD queue.notifications.v1 * type telegram.send payload {...}
Worker: XREADGROUP GROUP workers worker-1 COUNT 10 BLOCK 5000 STREAMS queue.notifications.v1 >
Worker: обработка → XACK queue.notifications.v1 workers <id>
        ошибка 5x → INSERT INTO dead_letter_queue + XACK
```

### 6.3 Политика ретраев


| Попытка | Задержка перед повтором |
| ------- | ----------------------- |
| 1       | немедленно              |
| 2       | 1 мин                   |
| 3       | 5 мин                   |
| 4       | 15 мин                  |
| 5       | 60 мин                  |
| > 5     | → dead_letter_queue     |


### 6.4 Dead Letter Queue (DLQ) — политика **[TARGET]**

Дополняет таблицу ретраев: что происходит с сообщением после исчерпания попыток.

```yaml
dead_letter_queue:
  retention: 7 дней                    # хранить записи для разбора инцидентов
  ui: просмотр / фильтры (позже)      # админка: список, тело, причина, requeue
  requeue: да                          # ручной или безопасный автоматический возврат в исходный stream .v1 после фикса
```

На проде это сильно снижает риск «потеряли навсегда» при временном сбое внешнего API. Идемпотентность обработчиков обязательна: повтор из DLQ = at-least-once.

**[CURRENT]:** отдельная таблица `dead_letter_queue` и UI могут отсутствовать; доставки живут в `notification_deliveries` со своими статусами — не смешивать с целевой DLQ очередей.

---

## 7. Доменные события

```
Мутация сущности
       ↓
emit_domain_event(type, payload, user_id)
       ├─→ INSERT notification_events (PostgreSQL) — аудит, primary
       ├─→ XADD queue.domain.v1 (Redis, `REDIS_EVENTS_STREAM`) — вторично
       └─→ process_domain_event() — синхронно в HTTP **или** async (`domain_events_worker` при `DOMAIN_EVENTS_HUB_ASYNC=true`)
               ├─→ строим получателей по правилам
               ├─→ INSERT notifications
               ├─→ INSERT notification_deliveries (telegram / email)
               ├─→ XADD queue.notifications.v1 { notification_id }
               └─→ realtime_hub.emit() → WebSocket push
```

**Гарантия доставки событий (формулировка для команды):**

- Публикация и обработка — **at-least-once**, не **exactly-once**. Повтор HTTP-запроса, ретрай воркера или повторная доставка из очереди могут привести к повторному вызову обработчика → обработчики и побочные эффекты должны быть **идемпотентными** (см. §15).
- Запись в `notification_events` (Postgres) — опорный аудит; Redis `XADD` — **[CURRENT]** вторичный канал; при недоступности Redis событие в БД уже может существовать.

**[CURRENT]:** `process_domain_event` — в HTTP (флаг `DOMAIN_EVENTS_HUB_ASYNC=false`) или в `domain_events_worker` при `true` (Docker Compose по умолчанию включает async + воркер).

**Порядок между consumer'ами:** глобальная упорядоченность событий **не гарантируется**, если обрабатывают несколько воркеров или разные потоки. Обработчики не должны полагаться на то, что событие типа A всегда придёт раньше B «во всей системе» без явного контракта (один stream, один partition key и т.д.).

---

## 8. Аутентификация

```
Логин: POST /api/auth/login
  → access_token (JWT, 60 мин) в HttpOnly cookie "access_token"
  → refresh_token (JWT, 30 дней) в HttpOnly cookie "refresh_token" (path=/api/auth/refresh)
  → csrf_token (random UUID) в обычной cookie "csrf_token" (readable by JS)

Флаги cookie (целевой контракт безопасности для auth):
  SameSite=Lax     # снижает риск CSRF при типичной навигации
  Secure           # только по HTTPS в проде
  HttpOnly         # для access_token / refresh_token — недоступны из JS

[CURRENT]: фактические флаги сверять в apps/api (ответ Set-Cookie) и nginx; документ фиксирует намерение.

Запрос: браузер автоматически шлёт cookies
        + заголовок X-CSRF-Token: <csrf_token cookie value>

Обновление: POST /api/auth/refresh (автоматически при 401)

Выход: POST /api/auth/logout → clear cookies
```

JWT payload:

```json
{
  "sub": "user-uuid",
  "name": "Иван Иванов",
  "role": "manager",
  "permissions": ["tasks.create", "crm.deals.edit", ...],
  "exp": 1234567890
}
```

---

## 9. Конечные автоматы (State Machines)

### 9.1 Доставка уведомлений

```
pending → sending → sent
    ↓         ↓
  failed    failed → (retry) → pending
               ↓ (5+ ошибок)
             dead → dead_letter_queue
```

### 9.2 Сессия MTProto (Telegram личный)

```
inactive → pending_code → pending_password → active
                ↓                ↓
             expired           failed
                ↓                ↓
           inactive ←──────── inactive
```

### 9.3 Заявка на оплату (Finance)

```
draft → pending → approved → paid
            ↓
         rejected → archived
```

---

## 10. Observability

### 10.1 Structured Logging

Все логи — JSON в production, colorized в dev. Каждая запись содержит `request_id` для сквозной трассировки.

```python
# apps/api/app/logging_config.py
import structlog

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),   # prod
        # structlog.dev.ConsoleRenderer(),     # dev
    ],
)

log = structlog.get_logger()

# Использование в сервисе
log.info("task.created",
    task_id=str(task.id),
    table_id=str(task.table_id),
    assignee_id=str(task.assignee_id),
    request_id=request.state.request_id,
)

log.error("telegram.send.failed",
    delivery_id=str(delivery.id),
    attempt=delivery.attempts,
    error=str(e),
    request_id=ctx.request_id,
)
```

**Уровни:**

- `DEBUG` — детали алгоритмов (только dev)
- `INFO` — бизнес-события (создание, смена статуса)
- `WARNING` — деградация (ретрай, медленный запрос)
- `ERROR` — ошибка обработана, но требует внимания
- `CRITICAL` → автоматический алерт в Telegram

### 10.2 Sentry (обработка ошибок)

```bash
pip install sentry-sdk[fastapi]
```

```python
# main.py
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration

sentry_sdk.init(
    dsn=settings.SENTRY_DSN,           # опционально, без него просто не шлёт
    integrations=[FastApiIntegration()],
    traces_sample_rate=0.1,            # 10% запросов трасируем
    environment=settings.ENVIRONMENT,  # "production" | "staging"
    release=settings.APP_VERSION,
)
```

Что даёт: каждый необработанный exception автоматически попадает в Sentry с полным стектрейсом, request_id, user context. Настройка — 15 минут, окупается в первый же краш в проде.

### 10.3 Метрики (Prometheus)

As-built: `app/core/observability.py` — счётчики и гистограмма HTTP, `GET /metrics` (доступ по `PROMETHEUS_SCRAPE_TOKEN` или localhost). Глубина Redis Streams: **`queue_depth{queue_name}`** для `domain_events`, `integrations`, `notifications` (значение — `XLEN` соответствующего stream из env).

Черновик с `prometheus-fastapi-instrumentator` в репозитории не используется.

**Ключевые метрики:**


| Метрика                                      | Что показывает                |
| -------------------------------------------- | ----------------------------- |
| `http_requests_total{status,method}`       | Трафик, ошибки (агрегат по методу и коду ответа) |
| `http_request_duration_seconds`              | Латентность (p50, p95, p99)   |
| `queue_depth{queue_name}`                    | Длина Redis Stream (XLEN)     |
| `delivery_failed_total` / DLQ в Prometheus   | **[TARGET]**; сейчас см. `GET /api/admin/metrics/queues` |


**Алерты (пороги):**

- HTTP 5xx rate > 1% за 5 мин → Telegram alert
- `http_request_duration_seconds{p95}` > 2 сек → warning
- `queue_depth` > 1000 → warning
- нерешённые DLQ / failed deliveries — по данным админки `metrics/queues` или будущим метрикам Prometheus

### 10.4 Что НЕ нужно сейчас

**Distributed tracing (OpenTelemetry/Jaeger)** — имеет смысл когда > 5 независимых сервисов с межсервисными вызовами. У нас monolith API + 2 worker'а — `request_id` в structlog покрывает 95% потребностей в трассировке.

**Grafana** — подключить когда Prometheus уже работает и есть метрики для визуализации. Не нужна в день 1.

---

## 11. Таймауты и защита от зависания

Каждый вызов внешнего сервиса должен иметь явный таймаут. Без таймаута — worker зависает навсегда, сжирает connection pool, падает всё.

### 11.1 httpx (Meta Graph API, Bot API)

```python
# services/http_client.py
import httpx

# Глобальный клиент с таймаутами по умолчанию
HTTP_CLIENT = httpx.AsyncClient(
    timeout=httpx.Timeout(
        connect=5.0,    # время на TCP handshake
        read=10.0,      # время на чтение ответа
        write=5.0,      # время на отправку тела
        pool=3.0,       # время ожидания из connection pool
    ),
    limits=httpx.Limits(
        max_connections=50,
        max_keepalive_connections=20,
    ),
)

# Для медленных операций (загрузка медиа, большие payload'ы)
SLOW_HTTP_CLIENT = httpx.AsyncClient(
    timeout=httpx.Timeout(connect=5.0, read=60.0, write=30.0, pool=3.0),
)
```

### 11.2 Telethon (MTProto)

```python
# Явный таймаут на каждую Telethon-операцию
async def sync_messages(session, peer, limit=50):
    try:
        async with asyncio.timeout(30.0):   # Python 3.11+
            messages = await client.get_messages(peer, limit=limit)
    except asyncio.TimeoutError:
        log.error("mtproto.sync.timeout", peer=str(peer))
        raise
```

### 11.3 Таймауты в очереди

Worker не должен висеть вечно на одном сообщении:

```python
# workers/base_worker.py
async def process_with_timeout(message: dict, timeout: float = 60.0):
    try:
        async with asyncio.timeout(timeout):
            await handle_message(message)
    except asyncio.TimeoutError:
        log.error("worker.message.timeout",
            queue=queue_name,
            message_type=message.get("type"),
        )
        # считаем как ошибку → ретрай / DLQ
        raise
```

### 11.4 Политика таймаутов по операциям


| Операция                   | connect | read/total |
| -------------------------- | ------- | ---------- |
| Telegram Bot API           | 5s      | 10s        |
| Meta Graph API             | 5s      | 15s        |
| MTProto GetHistory         | 5s      | 30s        |
| MTProto скачивание медиа   | 5s      | 120s       |
| S3 upload                  | 5s      | 60s        |
| Worker обработка сообщения | —       | 60s        |


---

## 12. SLA-классификация операций

Не все операции одинаково критичны. Это определяет retry-политику, DLQ-обработку и приоритет алертов.


| Tier                 | Критичность            | Примеры                                                    | Политика                                   |
| -------------------- | ---------------------- | ---------------------------------------------------------- | ------------------------------------------ |
| **P0 — критично**    | Нельзя потерять        | Сохранение сделки, авторизация, входящий лид               | Транзакция БД, синхронно, алерт при ошибке |
| **P1 — важно**       | Желательно не потерять | Telegram-уведомление пользователю, доставка сообщения лиду | Очередь + 5 ретраев + DLQ                  |
| **P2 — best-effort** | Потеря допустима       | In-app уведомление в колокольчик, синк истории MTProto     | Очередь + 3 ретрая, DLQ без алерта         |
| **P3 — фоновое**     | Потеря ок              | Retention очистка, статистика                              | Раз в N минут, без ретраев                 |


**Правило DLQ:** P0 и P1 в DLQ → алерт в Telegram немедленно. P2 → ежедневный дайджест. P3 → только лог.

---

## 13. Расхождения: **[CURRENT]** vs **[TARGET]**

Таблица **актуализирована по репозиторию** (сверка: роутеры, `apiClient`, `integrations_stream`, CI). Устаревшие формулировки вроде «JWT в sessionStorage» или «везде `list[dict]`» относятся к прежним версиям продукта, не к текущему as-built.


| Тема                     | [CURRENT] (as-built)                                                                                               | [TARGET]                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| Фоновые задачи           | `lifespan`: миграции, ensure stream’ов, подписчик Redis для WS; polling/retention/hub/delivery — отдельные воркеры | Дальше выносить из `lifespan` только то, что не старт API |
| Redis Streams            | Имена `queue.<домен>.v1`, `XADD` + группы, `XREADGROUP` / `XAUTOCLAIM` / `XACK`                                    | —                                                         |
| WebSocket hub            | Redis Pub/Sub + локальные соединения; лимит сессий на пользователя                                                 | —                                                         |
| Валидация bulk / PATCH   | Pydantic в `app/schemas/`; `extra=forbid` на телах `login` / `refresh` / `logout`                                  | Расширять строгие тела на партнёрские/публичные POST      |
| JWT / сессия             | HttpOnly cookies + `tv`, CSRF double-submit (`apps/api/CLAUDE.md`)                                                 | —                                                         |
| Доменный слой            | `app/domain/` (сделки, заявки на оплату) + вызов из сервисов/роутеров                                              | Новые правила — в `domain/` по мере касания кода          |
| Типы БД                  | Смешение VARCHAR/JSONB (исторически)                                                                               | Эпик выравнивания типов в [DATABASE.md](./DATABASE.md) закрыт (✅); дальнейшие типы — по мере миграций; остаток §13        |
| Тесты                    | Unit (`-m "not integration"`), выборочные контракты (auth, metrics, domain, …)                                     | Рост покрытия `services/` и контрактов API                |
| Динамический PATCH       | Сервисы `deals_api` / `tasks_api` — явное применение полей (без `setattr` от клиента)                              | Сохранять явность при новых сущностях                     |
| Observability            | structlog, опциональный Sentry, Prometheus `/metrics`, `X-Request-ID`, system_logs                                 | —                                                         |
| Таймауты внешних вызовов | `app/services/http_client.py` + настройки в config                                                                 | Новые исходящие HTTP — через общий клиент                 |
| Ошибки в воркерах        | `worker_error_policy` во всех `workers/*.py`                                                                       | Новые воркеры — сразу с той же политикой                  |


---

## 14. Классификация ошибок (Error Taxonomy)

Явная классификация убирает неявные решения из кода воркеров: «эту ошибку ретраить, эту — нет». Без этого код полон `except Exception: retry()` где надо и `pass` где не надо.

### 14.1 Типы ошибок


| Тип                       | Примеры                                         | Поведение                                                   |
| ------------------------- | ----------------------------------------------- | ----------------------------------------------------------- |
| **Transient** (временная) | Сетевой таймаут, 503, Redis недоступен          | Ретрай с backoff                                            |
| **Rate limit**            | HTTP 429, Telegram `TooManyRequests`            | Ретрай с задержкой из `retry_after`                         |
| **Permanent / Client**    | HTTP 400, 404, невалидные данные, схема сломана | Не ретраить → DLQ + лог                                     |
| **Auth**                  | HTTP 401, 403, Telegram `Unauthorized`          | Не ретраить → алерт, требует действия человека              |
| **Business**              | Нельзя перевести сделку won→new, дубликат       | Не ретраить → вернуть ошибку вызывающему                    |
| **Infrastructure**        | БД недоступна, OOM                              | Ретраить → если не восстановилось за N мин → critical алерт |


### 14.2 Реализация в воркере

```python
# workers/error_policy.py
from enum import Enum

class ErrorAction(Enum):
    RETRY   = "retry"
    DLQ     = "dlq"
    SKIP    = "skip"
    ALERT   = "alert"

def classify_error(exc: Exception) -> ErrorAction:
    """Определить что делать с ошибкой."""
    
    # Временные — ретраить
    if isinstance(exc, (httpx.TimeoutException, httpx.ConnectError,
                        asyncio.TimeoutError)):
        return ErrorAction.RETRY
    
    if isinstance(exc, httpx.HTTPStatusError):
        code = exc.response.status_code
        if code == 429:
            return ErrorAction.RETRY   # с задержкой из Retry-After
        if code >= 500:
            return ErrorAction.RETRY   # серверная ошибка внешнего сервиса
        if code in (400, 404, 422):
            return ErrorAction.DLQ     # наши данные плохие, ретрай не поможет
        if code in (401, 403):
            return ErrorAction.ALERT   # протухший токен, нужен человек
    
    # Telegram-специфичные
    if "FloodWaitError" in type(exc).__name__:
        return ErrorAction.RETRY
    if "AuthKeyError" in type(exc).__name__:
        return ErrorAction.ALERT
    
    # Всё неизвестное — в DLQ (не теряем, но и не ретраим бесконечно)
    return ErrorAction.DLQ

# Использование в воркере
async def handle_with_policy(message: dict, attempt: int):
    try:
        await process(message)
    except Exception as exc:
        action = classify_error(exc)
        
        if action == ErrorAction.RETRY and attempt < MAX_ATTEMPTS:
            delay = backoff_delay(attempt)
            await schedule_retry(message, delay)
        elif action == ErrorAction.ALERT:
            await send_alert(f"Требуется действие: {exc}", message)
            await move_to_dlq(message, str(exc))
        else:
            await move_to_dlq(message, str(exc))
```

### 14.3 HTTP-ответы API (для клиентов)

```python
# Единый формат ошибки
class ErrorCode(str, Enum):
    # Валидация
    VALIDATION_ERROR    = "validation_error"
    REQUIRED_FIELD      = "required_field"
    
    # Авторизация
    UNAUTHORIZED        = "unauthorized"
    FORBIDDEN           = "forbidden"
    CSRF_INVALID        = "csrf_invalid"
    
    # Данные
    NOT_FOUND           = "not_found"
    CONFLICT            = "conflict"          # дубликат
    
    # Бизнес-логика
    INVALID_TRANSITION  = "invalid_transition"  # нельзя won→new
    INSUFFICIENT_FUNDS  = "insufficient_funds"
    
    # Система
    RATE_LIMITED        = "rate_limited"
    INTERNAL_ERROR      = "internal_error"    # без деталей наружу
    INTEGRATION_ERROR   = "integration_error" # внешний сервис недоступен
```

Фронтенд принимает решение на основе `error` кода, не парсит `message`.

---

## 15. Политика идемпотентности

Идемпотентность — повтор запроса (сетевой ретрай, дубль вебхука, кнопка нажата дважды) не создаёт дублей и не ломает состояние.

### 15.1 Где обязательна


| Операция                                  | Механизм                                                   |
| ----------------------------------------- | ---------------------------------------------------------- |
| Входящие Meta вебхуки                     | `external_msg_id = entry.messaging[].mid`, UNIQUE INDEX    |
| Входящие Telegram апдейты                 | `update_id` — UNIQUE, пропускать уже обработанные          |
| Лиды с сайта                              | дедупликация по `phone + email` за 24ч                     |
| Создание сущности по вебхуку              | UNIQUE constraint на `(channel, external_id)`              |
| Batch-обновление задач (PUT /tasks/batch) | операция идемпотентна по природе: применить новые значения |
| Смена стадии сделки                       | применить только если текущая стадия != целевой            |


### 15.2 Idempotency Key для клиентов API

Для создающих операций (POST) клиент может передать ключ идемпотентности:

```http
POST /api/deals
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
Content-Type: application/json
```

Сервер хранит результат в Redis с **областью ключа** (как в `docs/API.md` §3), TTL 24ч:

```text
idempotency:{METHOD}:{normalized_path}:{idempotency_key}
```

- Первый запрос: выполнить + сохранить ответ  
- Повтор с тем же ключом **на том же маршруте**: вернуть сохранённый ответ, не выполнять снова

```python
# middleware/idempotency.py (идея; путь нормализовать по правилам OpenAPI)
async def idempotency_middleware(request: Request, call_next):
    key = request.headers.get("Idempotency-Key")
    path = request.url.path  # или шаблон маршрута

    if key and request.method == "POST":
        redis_key = f"idempotency:{request.method}:{path}:{key}"
        cached = await redis.get(redis_key)
        if cached:
            return JSONResponse(json.loads(cached))

        response = await call_next(request)

        if response.status_code in (200, 201):
            body = b""
            async for chunk in response.body_iterator:
                body += chunk
            await redis.setex(redis_key, 86400, body)
            return Response(
                content=body,
                status_code=response.status_code,
                headers=dict(response.headers),
            )

    return await call_next(request)
```

### 15.3 Правила для разработчиков

```
✅ Вебхуки: ВСЕГДА проверять external_id перед INSERT
✅ Повторные задачи в очереди: проверять статус в БД перед обработкой
✅ Создание через API: поддерживать Idempotency-Key для POST /deals, /clients
✅ State transitions: сначала проверить текущий статус

❌ Не полагаться на уникальность UUID от клиента без проверки
❌ Не считать что очередь доставит сообщение ровно один раз (at-least-once!)
```

---

## 16. Capacity Thinking (прикидки нагрузки)

Не «купи 40 серверов», а понимание откуда взять числа при выборе пула соединений, TTL кэша и т.п.

### 16.1 Целевой профиль нагрузки


| Параметр                             | Значение     |
| ------------------------------------ | ------------ |
| Пользователей всего                  | до 200       |
| Одновременно онлайн                  | ~20–30 (пик) |
| HTTP-запросов/мин (пик)              | ~500–1000    |
| WebSocket-соединений                 | ~20–30       |
| Входящих сообщений/день (все каналы) | ~1000–5000   |
| Задач в очереди (пик)                | < 500        |


### 16.2 PostgreSQL — connection pool

```
Один uvicorn worker = asyncio event loop.
SQLAlchemy async pool на процесс: pool_size=10, max_overflow=5.

Расчёт:
  API: 1 процесс × 15 коннектов = 15
  Worker notifications: 1 × 5 = 5
  Worker integrations:  1 × 5 = 5
  Bot:                  1 × 3 = 3
  Alembic/migrations:   1 × 1 = 1 (только при деплое)
  ─────────────────────────────
  Итого: ~29 коннектов

PostgreSQL default: max_connections = 100.
Запас: 70+ коннектов → комфортно.
```

```python
# config.py / create_async_engine
engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=10,          # постоянных коннектов
    max_overflow=5,        # временных при пике
    pool_pre_ping=True,    # проверять коннект перед использованием
    pool_recycle=3600,     # пересоздавать коннекты раз в час
)
```

### 16.3 Redis — память

```
Streams (очереди), имена как в §6.2:
  queue.notifications.v1: maxlen=10_000 × ~0.5KB = ~5 MB
  queue.integrations.v1:  maxlen=10_000 × ~1KB   = ~10 MB

Idempotency keys: 10_000 keys × 2KB × TTL 24h = ~20 MB пиково

WebSocket pub/sub: < 1 MB

Кэш сессий MTProto offset: N воронок × 100 bytes = несколько KB

Итого: ~50–100 MB
Redis maxmemory=512mb → 5-кратный запас.
```

### 16.4 Когда пересматривать


| Сигнал                                         | Действие                                              |
| ---------------------------------------------- | ----------------------------------------------------- |
| DB pool exhausted (`QueuePool limit overflow`) | Увеличить `max_overflow` или добавить инстанс API     |
| Redis > 80% maxmemory                          | Увеличить maxmemory или чистить кэш агрессивнее       |
| HTTP p95 latency > 1 сек                       | Профилировать медленные запросы (pg_stat_statements)  |
| `queue_depth` в Prometheus стабильно > 500    | Добавить воркер-процесс или оптимизировать обработчик (см. §10.3) |


### 16.5 Что НЕ нужно считать сейчас

При 200 пользователях PostgreSQL на 2 CPU / 4 GB RAM справляется с запасом. Партиционирование таблиц, read replicas, шардинг — актуально при > 100K записей/день или > 1000 одновременных пользователей. Смотреть по метрикам, не гадать заранее.

---

## 17. Что осознанно НЕ делаем (и почему)


| Идея                                    | Почему не сейчас                                                                                                                                                              |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Distributed tracing (Jaeger/Zipkin)** | Нужен при N > 5 независимых сервисов. У нас monolith + 2 worker'а — `request_id` в structlog достаточно.                                                                      |
| **Feature flags (LaunchDarkly и др.)**  | Продукт для конкретной команды, без A/B тестов и постепенного rollout. Когда понадобится — env variable + строка в `config` таблице БД закроет 95% задач без внешней системы. |
| **Service Mesh (Istio)**                | Kubernetes + несколько сервисов. Не наш случай.                                                                                                                               |
| **Event Sourcing**                      | Аудит-лог (`audit_log` таблица) даёт историю изменений без сложности event sourcing.                                                                                          |
| **CQRS**                                | Один инстанс PostgreSQL, нет разделения read/write нагрузки — преждевременно.                                                                                                 |


---

## 18. Cost-Awareness (стоимость решений)

Архитектурные решения имеют цену — в деньгах, в CPU, в полосе пропускания. Понимание этого предотвращает счёт на $500 там, где ожидали $20.

### 18.1 Текущая модель затрат

```
Инфраструктура (self-hosted VPS):
  Сервер:         ~$20–50/мес (фиксированно)
  PostgreSQL:     включён в сервер
  Redis:          включён в сервер
  nginx:          включён в сервер

Внешние API (бесплатные в нашем объёме):
  Telegram Bot API:    бесплатно (без лимитов на отправку)
  Meta Graph API:      бесплатно до определённых лимитов
  MTProto (Telethon):  бесплатно

Потенциальные платные:
  S3 / Minio:          ~$0.023/GB хранения + $0.09/GB egress (AWS S3)
  Email (SMTP):        бесплатно до ~500/день, дальше — сервис
  Sentry:              бесплатно до 5K событий/мес, $26/мес за 100K
```

**Вывод:** при текущем масштабе доминирующая статья — VPS. Но S3 и Sentry могут вырасти непропорционально если не следить.

### 18.2 Архитектурные решения с ценой

**Polling vs Webhook**

```
Telegram getUpdates каждые 5 сек:
  Запросов/день = 86400 / 5 × N_воронок
  При 10 воронках = 172,800 запросов/день
  → CPU на сетевые вызовы, но бесплатно (Telegram не берёт за это)

Webhook (push):
  0 запросов от нас + требует публичный URL + настройка
  → экономит CPU, но сложнее в настройке
```

Вывод: при < 10 воронках polling — разумный компромисс. При > 20 — переходить на webhook.

**Медиа через MTProto vs прямые ссылки**

```
Без S3 (текущее):
  Каждый просмотр медиа = скачивание через Telethon = CPU + память
  При 100 просмотрах/день одного файла = 100× скачиваний
  → O(N×просмотров) нагрузка

С S3 (целевое):
  Первое скачивание: Telethon → S3 upload (один раз)
  Все последующие: браузер → S3 signed URL (без нашего CPU)
  → O(1) нагрузка на сервер
```

Вывод: S3 для медиа — экономит CPU и пропускную способность, не только безопасность.

**Размер payload'ов**

```python
# Дорого: отдавать всё без пагинации
GET /api/tasks → 5000 задач × 2KB = 10 MB на запрос
  → CPU на сериализацию
  → RAM на JSON
  → Трафик (если VPS тарифицирует исходящий)

# Дёшево: пагинация + проекция полей
GET /api/tasks?limit=50&fields=id,title,status → 50 × 0.2KB = 10 KB
```

### 18.3 Правила cost-aware разработки

```
✅ Пагинация на всех LIST-эндпоинтах (уже требование, теперь и экономическое)
✅ Медиа: не хранить в PostgreSQL (BYTEA), не держать в памяти — только S3 ссылки
✅ S3 uploads: ограничить размер (MAX_UPLOAD_SIZE = 50 MB)
✅ Polling: интервал не меньше 5 сек, не крутить в tight loop
✅ Sentry: sample_rate=0.1 для трейсов (не 1.0) — иначе 10K событий/день при 100 пользователях

⚠️  Email-рассылки: перед добавлением оценить объём (даже 1000 писем/день = платный SMTP)
⚠️  S3 egress: signed URL с TTL — клиент ходит напрямую в S3, не через наш сервер
⚠️  Логи: не логировать тела запросов с медиа (раздуют объём хранения логов)
```

### 18.4 Когда пересматривать модель


| Триггер                       | Что делать                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------ |
| S3 > $20/мес                  | Аудит что хранится, добавить lifecycle policy (удалять неиспользуемое через 90 дней) |
| Sentry > лимита               | Снизить `traces_sample_rate`, фильтровать 4xx от Sentry                              |
| VPS CPU > 70% average         | Профилировать (pg_stat_statements, structlog timing), не апгрейдить вслепую          |
| Исходящий трафик > лимита VPS | Проверить не отдаём ли медиа через наш сервер                                        |


---

## 19. Product Coupling — архитектура и бизнес

Staff-уровень думает не только «как работает», но и «как это ускоряет или тормозит продукт». Каждое архитектурное решение — это ставка на то, что будет меняться часто, а что — редко.

### 19.1 Что дёшево менять (правильные решения сейчас)


| Решение                               | Почему продуктово правильно                                                                |
| ------------------------------------- | ------------------------------------------------------------------------------------------ |
| **Domain layer отдельно от роутеров** | Бизнес-правило «нельзя закрыть сделку без суммы» — меняется в одном месте, не в 5 роутерах |
| **RBAC через таблицу, не хардкод**    | Новая роль или новое право — запись в БД, не деплой                                        |
| **Воронки и стадии — конфиг в БД**    | Заказчик сам настраивает воронку без программиста                                          |
| **Pydantic-схемы на границе API**     | Изменение поля — одно место, TypeScript-типы генерируются автоматически                    |
| **Enum'ы для статусов**               | Добавить новый статус — 2 строки в enum + миграция, не grep по всему коду                  |
| **Очереди с DLQ**                     | Новый тип доставки (e-mail, push) — добавить обработчик в воркер, не трогать API           |


### 19.2 Что дорого менять (осознанный технический долг)


| Проблема                          | Цена изменения                                | Когда менять                                     |
| --------------------------------- | --------------------------------------------- | ------------------------------------------------ |
| VARCHAR для дат/UUID в БД         | Миграция с копированием данных, риск downtime | По мере роста запросов с фильтрацией по дате     |
| JSONB для comments/attachments    | Разбивка на таблицы + миграция данных         | Когда нужен поиск по комментариям или агрегация  |
| useAppLogic монолит (фронт)       | Постепенная миграция на Zustand, нельзя сразу | Один слайс за раз при добавлении новых фич       |
| Polling вместо webhook (Telegram) | Переход на webhook = настройка + тесты        | При > 20 воронках или требовании < 1 сек latency |
| Синхронный process_domain_event   | Вынос в воркер = рефакторинг flow событий     | Когда уведомления заметно замедляют API          |


### 19.3 Архитектурные ставки (что мы предполагаем о продукте)

Каждое архитектурное решение — неявная ставка. Лучше сделать их явными:


| Ставка                          | Предположение                                          | Если ошибёмся                                                             |
| ------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------- |
| Monolith (не microservices)     | Команда < 5 бэкендеров, фичи пересекаются              | Разделить на сервисы — дорого, но это месяцы, не годы                     |
| Single PostgreSQL               | Нет требований к geographic distribution               | Read replica добавляется без изменения кода (SQLAlchemy поддерживает)     |
| Redis Streams (не Kafka)        | < 10K сообщений/день, нет требований к replay > 7 дней | Kafka — замена воркеров, API не меняется                                  |
| Self-hosted VPS (не Kubernetes) | Команда без DevOps, нет требований к auto-scaling      | Докеризация уже есть — переезд на K8s это ops-работа, не рефакторинг кода |
| Без multi-tenancy               | Один заказчик, один инстанс                            | Multi-tenancy = добавить `company_id` FK во все таблицы — это больно      |


### 19.4 Принцип: защищай то, что меняется часто

```
Часто меняется (бизнес-логика):
  → В domain/ и services/ — за интерфейсом, легко тестировать
  → Enum статусов, правила переходов, расчёты

Редко меняется (инфраструктура):
  → PostgreSQL схема — менять дорого, проектировать тщательно
  → API контракт — ломающие изменения требуют версионирования
  → Очереди — протокол должен быть стабильным

Никогда не меняется (принципы):
  → Stateless API
  → Аудит всех мутаций
  → Секреты только на сервере
```

### 19.5 Когда архитектура тормозит продукт — красные флаги

```
🔴 "Чтобы добавить новое поле в сделку, надо менять 5 файлов"
   → Нет слоя схем, нет Pydantic

🔴 "Нельзя быстро проверить гипотезу — надо менять БД"
   → Используй JSONB `custom_fields` как escape hatch для экспериментов

🔴 "Новый сотрудник боится трогать FinanceView.tsx"
   → 2000-строчный компонент — продуктовый тормоз, не только технический

🔴 "Каждый новый источник лидов требует деплой"
   → Конфиг источников должен быть в БД (funnels.sources), уже так

🔴 "Не знаем почему пришёл лид — откуда, когда, что произошло"
   → Observability — это продуктовая функция, не только техническая
```

