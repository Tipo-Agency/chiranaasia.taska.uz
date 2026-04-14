# Redis Streams: имена и воркеры

Ретраи, DLQ, смоук и смена версии stream описаны в этом файле и в [ARCHITECTURE.md](./ARCHITECTURE.md) §6.

Контракт: **`queue.<домен>.v1`** (смена формата сообщения → новый поток `…v2`, старый дренируется). Исключения задаются только через env и комментарий в `app/core/config.py`.

## Таблица

| Stream (env) | Consumer group (env) | Процесс | Сервис в `docker-compose.yml` | Назначение |
|--------------|----------------------|---------|-------------------------------|------------|
| `REDIS_EVENTS_STREAM` → `queue.domain.v1` | `taska_domain_events` (создаётся в `event_bus`, id `0`) | — | `backend` (XADD) | Запись доменных событий (XADD), мониторинг |
| то же | `REDIS_DOMAIN_EVENTS_HUB_GROUP` → `notification_hub` (id `$` при создании) | `python -m workers.domain_events_worker` | **`domain-events-worker`** | Построение уведомлений (`process_domain_event`), если `DOMAIN_EVENTS_HUB_ASYNC=true` |
| `REDIS_INTEGRATIONS_STREAM` → `queue.integrations.v1` | `REDIS_INTEGRATIONS_GROUP` → `integrations` | `python -m workers.integrations_worker` | **`integrations-worker`** | Meta webhook, Telethon sync, polling лидов |
| `REDIS_NOTIFICATIONS_STREAM` → `queue.notifications.v1` | `REDIS_NOTIFICATIONS_GROUP` → `notifications` | `python -m workers.notifications_worker` | **`notifications-worker`** | Отправка telegram/e-mail по `notification_id` |

## Миграция с легаси-имён

Раньше по умолчанию использовались `events.domain.v1`, `queue.integrations`, `queue.notifications`. Пока старый stream не дренирован, задайте в `.env` / compose:

```bash
REDIS_EVENTS_STREAM=events.domain.v1
REDIS_INTEGRATIONS_STREAM=queue.integrations
REDIS_NOTIFICATIONS_STREAM=queue.notifications
```

После переноса сообщений уберите переопределения.

## Async hub

При `DOMAIN_EVENTS_HUB_ASYNC=true` API не вызывает `process_domain_event` в HTTP только если событие **успешно** опубликовано в stream (`publish_domain_event` → `published=True`); иначе hub выполняется в том же запросе. Нужен сервис **`domain-events-worker`**, иначе уведомления по новым событиям не построятся. Если Redis недоступен, `published=False` — fallback на синхронный hub в HTTP (см. `app/services/domain_events.py`).

## Retention уведомлений

Не в процессе Uvicorn: **`python -m workers.retention_worker`** (см. `docker-compose` сервис `retention-worker`).

## Consumer groups: `0` vs `$` и PEL

| Stream | Группа | `XGROUP CREATE … id` | Зачем |
|--------|--------|----------------------|--------|
| `REDIS_EVENTS_STREAM` | `taska_domain_events` | `0` | Совместимость с историей stream и мониторингом; эта группа **не** используется async hub-воркером. |
| то же | `notification_hub` (`REDIS_DOMAIN_EVENTS_HUB_GROUP`) | `$` | В группу попадают только записи **после** первого создания группы — без повторной обработки старых событий sync-эпохи (`domain_events_hub_stream.py`). |
| `REDIS_NOTIFICATIONS_STREAM` | `notifications` | `0` | Очередь с нуля; старые записи в stream доступны группе для вычитки при необходимости. |
| `REDIS_INTEGRATIONS_STREAM` | `integrations` | `0` | Аналогично. |

После `XREADGROUP` без `XACK` сообщение остаётся в **PEL** (pending) у consumer'а. Воркеры делают **XAUTOCLAIM** с `REDIS_*_CLAIM_IDLE_MS` и повторно обрабатывают «зависшие» id; в логах ищите `msg_id` / `notification_id`.

**Деплой:** смена стратегии `id` у уже существующей группы в Redis не выполняется кодом автоматически — нужен осознанный план (дренаж, новая группа, ручной `XPENDING` / `XCLAIM`).

## Поля XADD по потокам

**`queue.domain.v1` (`REDIS_EVENTS_STREAM`)** — каноническое доменное событие, сериализация в `event_bus._serialize_event`: строковые поля; `payload` и вложенные dict/list — JSON; `occurredAt` — ISO. Ключи: `id`, `type`, `occurredAt`, `actorId`, `orgId`, `entityType`, `entityId`, `source`, `correlationId`, `payload` (и прочие поля события, если появятся).

**`queue.notifications.v1`** — одно поле: `notification_id` (UUID строки уведомления). См. `notifications_stream.xadd_notification_job`.

**`queue.integrations.v1`** — поле `type` + нагрузка по типу:

- `meta_webhook` — `body`: raw webhook в **base64** (`xadd_meta_webhook_job`).
- `telegram_personal_sync` — `user_id`, `deal_id`, `limit` (`xadd_telegram_personal_sync_job`).

Новые типы — см. `INTEGRATIONS.md` и константы в `integrations_stream.py`.

## Ретраи, DLQ и runbook (кратко)

Политика ретраев и целевая DLQ описаны в [ARCHITECTURE.md](./ARCHITECTURE.md) §6.3–6.4. В коде воркеров stream-сообщения при ошибках обработки в основном **остаются в PEL** до XAUTOCLAIM; отдельные битые сообщения **ACK** (poison), чтобы не блокировать очередь (см. логи `ACK poison`, `empty notification_id`).

**Сообщение «зависло» в stream / растёт лаг**

1. Redis: `XLEN <stream>`, `XPENDING <stream> <group>`, при необходимости `XINFO GROUPS <stream>`.
2. Логи процесса: `domain_events_worker`, `notifications_worker`, `integrations_worker` — по `msg_id` и типу задачи.
3. БД: админка `GET /api/admin/metrics/queues` — inbox, доставки `dead`, нерешённые строки `dead_letter_queue`; список DLQ `GET /api/admin/dlq/rows`, requeue `POST /api/admin/dlq/{id}/requeue` (нужен Redis).

**Несовместимый payload (миграция v2):** новый ключ `queue.<домен>.v2`, producers только туда; старый поток дренируется — см. §«Миграция с легаси-имён» выше и [ARCHITECTURE.md](./ARCHITECTURE.md) §6.

## Наблюдаемость

- **Уже есть:** `GET /api/admin/metrics/queues` (счётчики inbox / failed deliveries / DLQ), логи воркеров с `msg_id` (`worker_error_policy.log_worker_exception`).
- **Prometheus:** при scrape `GET /metrics` (см. `PROMETHEUS_SCRAPE_TOKEN` / localhost в [apps/api/app/core/observability.py](../apps/api/app/core/observability.py)) обновляется gauge **`queue_depth{queue_name}`** для потоков `domain_events`, `integrations`, `notifications` (значение — `XLEN` stream из env, см. `REDIS_*_STREAM`).
- **[TARGET]:** алерты по порогам в вашей системе мониторинга (ориентиры — [ARCHITECTURE.md](./ARCHITECTURE.md) §10.3); при необходимости — отдельные метрики по PEL / lag групп.

## Смоук перед релизом

1. `docker compose ps` — для затронутых очередей подняты `backend`, `redis`, при `DOMAIN_EVENTS_HUB_ASYNC=true` — **`domain-events-worker`**, для доставок — **`notifications-worker`**, для интеграций — **`integrations-worker`** (см. [OPERATIONS.md](./OPERATIONS.md)).
2. Сценарий: действие API, порождающее доменное событие и уведомление → в логах backend/stream при необходимости проверить факт публикации; при async hub — обработку в `domain_events_worker`; для каналов telegram/email — работу `notifications_worker` (XADD уже делает `notification_hub`).
3. Только смена имён в env: `rg 'REDIS_.*STREAM|queue\\.' apps/api` — нет «висячих» старых ключей в compose без записи в этом файле.
