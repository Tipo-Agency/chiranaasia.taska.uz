# Архитектура модуля уведомлений (Redis + Realtime)

## Статус документа

- Версия: `v1 (draft for approval)`
- Дата: `2026-03-16`
- Цель: зафиксировать архитектуру MVP, которая сразу готова к масштабированию.

### Статус реализации (факт в репозитории)

- `Phase 1` сделан: `notification_events`, Redis publish, API publish/recent.
- `Phase 2` сделан: `notifications`, `notification_deliveries`, notification hub.
- `Realtime` сделан: websocket endpoint `/api/notifications/ws/{user_id}`.
- **Доменные события (`log_entity_mutation` / `emit_domain_event`)** подключены ко всем основным продуктовым роутерам с мутациями — см. раздел **«19) Покрытие producers»** ниже. Неизвестные типы событий всё равно попадают в `notification_events` и (при доступном Redis) в Stream; пользовательские уведомления создаются только для типов, обработанных в `notification_hub`.
- Каналы `telegram/email` на этапе placeholder delivery (pending/runner), без внешнего провайдера.
- `Unread count` endpoint сделан: `GET /api/notifications/unread-count?user_id=...`.
- `Retention` реализован:
  - архив пользовательских уведомлений в `notifications_archive`,
  - автоочистка `notification_events` и `notification_deliveries` старше `NOTIFICATIONS_RETENTION_DAYS` (по умолчанию 90),
  - ручной запуск: `POST /api/notifications/retention/run`.

## 1) Что хотим получить

Единый модуль уведомлений, где **любое доменное событие системы** может:

1. попасть в централизованную шину событий,
2. быть обработано правилами,
3. превратиться в уведомления в каналах:
   - in-app (центр уведомлений в системе),
   - чат внутри системы,
   - Telegram,
   - Email,
4. остаться в аудите/логах.

Ключевое требование: не терять уведомления (допустимы редкие сбои, но с ретраями и восстановлением).

## 2) Принципы

1. **Event-first**: модули не шлют уведомления напрямую в UI/чат.
2. **Single Notification Hub**: все уведомления создаются единым сервисом.
3. **At-least-once delivery**: допускаем повторную доставку, предотвращаем дубли на уровне idempotency.
4. **Source of truth — PostgreSQL**: Redis — транспорт и realtime, не основное хранилище истории.
5. **Realtime by default**: in-app и чат получают обновления сразу.

## 3) Нужна ли "центральная шина всех данных"

Да, но в правильном объеме:

- Централизуем **шину доменных событий** (business events).
- Не переносим "все данные системы" в Redis как primary storage.

Итог: Redis Streams = центральная шина **обмена событиями**, PostgreSQL = источник правды для сущностей и истории.

## 4) Компоненты

### 4.1 Event Producers (все модули)

Модули (Tasks, CRM, Meetings, Docs, Finance, BPM, Inventory, Sites, Automation, Auth) публикуют доменные события в унифицированном формате.

### 4.2 Event Bus (Redis Streams)

- Stream: `events.domain.v1`
- Consumer groups:
  - `notifications-hub`
  - (опционально позже) `analytics`, `audit-export`, `webhooks`

### 4.3 Notification Hub

Сервис, который:
- читает события из Redis Streams,
- валидирует и нормализует,
- применяет правила и предпочтения пользователя,
- создает записи уведомлений,
- ставит задачи доставки по каналам,
- публикует realtime-события.

### 4.4 Delivery Workers

Отдельные воркеры по каналам:
- `inapp-worker`
- `chat-worker`
- `telegram-worker`
- `email-worker`

Каждый воркер читает свою очередь/stream доставки, фиксирует статус попыток.

### 4.5 Notification Center UI

Интерфейс в системе:
- список,
- фильтры (канал/тип/приоритет/прочитано),
- unread badge,
- deep links,
- mark read/unread.

### 4.6 Chat Bridge

Адаптер, который дублирует релевантные уведомления в чат между пользователями.

Пример:
"Пользователь A поставил вам задачу: `<название>`".

## 5) Контракт доменного события

```json
{
  "id": "uuid",
  "type": "task.assigned",
  "occurredAt": "2026-03-16T12:00:00.000Z",
  "actorId": "u-1",
  "orgId": "org-1",
  "entityType": "task",
  "entityId": "t-123",
  "source": "tasks-module",
  "correlationId": "req-abc",
  "payload": {
    "assigneeId": "u-2",
    "title": "Подготовить КП",
    "priority": "high"
  }
}
```

### Минимальные обязательные поля

- `id`, `type`, `occurredAt`, `orgId`, `entityType`, `entityId`, `source`, `payload`.

## 6) Каналы и маршрутизация

Каналы MVP:

1. `in_app` — обязательно.
2. `chat` — обязательно.
3. `telegram` — обязательно поддержка в настройках и отправке.
4. `email` — обязательно поддержка в настройках и отправке.

Для каждого события:
- определяется получатель(и),
- проверяются user preferences,
- создается набор delivery jobs.

## 7) Пользовательские настройки (полноценные)

`notification_preferences` должны поддерживать:

- каналы по умолчанию (`in_app/chat/telegram/email`),
- типы событий (task/deal/meeting/...),
- quiet hours (time range + timezone),
- mute по проектам/таблицам/сущностям,
- уровни приоритета,
- digest-режимы (опционально),
- fallback-логику (если канал недоступен).

## 8) Надежность и анти-потери

### Гарантии

- At-least-once processing.
- Идемпотентность по `event.id` + `recipient` + `channel`.
- Дедупликация (короткое окно, например 1-5 мин для одинаковых событий).

### Retry policy

- Экспоненциальный backoff, например: `10s, 30s, 2m, 10m, 30m`.
- Лимит попыток (например 10), затем `dead-letter`.

### Dead letter

- Stream: `notifications.dlq.v1`
- Отдельный UI/админ-инструмент для requeue.

## 9) Realtime

Сразу делаем realtime (WebSocket/SSE).

Поток:
1. notification saved in DB,
2. публикуется realtime event в Redis pub/sub (или отдельный stream),
3. websocket gateway пушит клиенту,
4. UI обновляет счетчик/список без polling.

## 10) Хранилище и ретеншн 90 дней

### Что хранится 90 дней

- `event_log` (сырые события шины),
- `delivery_attempts` (технические попытки доставки),
- служебные retry/DLQ артефакты.

### Что после 90 дней

- Не "все удаляется".
- Политика:
  - технические логи чистим (TTL/cron),
  - пользовательские уведомления можно:
    - либо тоже хранить 90 дней,
    - либо переносить в архивную таблицу `notifications_archive` и хранить дольше.

Рекомендуется:
- `event_log`: 90 дней,
- `notifications`: 180 дней или archive-tier.

## 11) Предлагаемая модель БД (новые сущности)

1. `notification_events`
   - event envelope + payload (JSONB), source, correlation, processed_at.
2. `notifications`
   - recipient_id, type, title, body, priority, entity_ref, read_at, created_at.
3. `notification_deliveries`
   - notification_id, channel, status, attempts, last_error, delivered_at.
4. `notification_preferences`
   - расширение текущей таблицы предпочтений до полноценной схемы.
5. `notification_templates`
   - шаблоны сообщений и локализация.

## 12) Стандартные события MVP

- `task.assigned`
- `task.status.changed`
- `deal.assigned`
- `deal.stage.changed`
- `meeting.created`
- `meeting.reminder_due`
- `document.shared`
- `comment.created`
- `automation.failed`
- `system.alert`

## 13) Интеграция с чатом

Не "чат вместо уведомлений", а:
- Notification Hub создает каноничное уведомление,
- Chat worker отправляет user-facing сообщение в соответствующий диалог.

Плюсы:
- единые правила и аудит,
- единый read-state ядра уведомлений,
- меньше дублирования бизнес-логики.

## 14) Масштабирование

Что позволяет расти без переписывания:

- Redis Streams + Consumer Groups (горизонтально),
- независимые workers per channel,
- разделение stream по bounded context (позже),
- возможная миграция транспорта на Kafka (при необходимости) без смены доменной модели событий.

## 15) Границы MVP (чтобы не застрять)

В MVP включаем:
- event bus Redis,
- Notification Hub,
- in-app + chat + telegram + email delivery workers,
- realtime gateway,
- полноценные user preferences,
- 90-дневный retention для event/delivery логов,
- базовый админ просмотр failed deliveries (минимум).

Не включаем в MVP:
- сложные digests и ML-приоритизацию,
- multi-tenant rate limiting enterprise-уровня,
- внешний webhook marketplace.

## 16) План внедрения

### Phase 1: Foundation
- Redis streams, event contract, producer SDK/helper, event log.

### Phase 2: Notification Core
- hub, rules engine, notifications + deliveries tables.

### Phase 3: Channels
- in-app + chat + telegram + email workers.

### Phase 4: Realtime + UI
- websocket gateway, notification center, badges, read-state.

### Phase 5: Hardening
- retries, DLQ, observability, retention jobs, load tests.

## 17) Критерии готовности MVP

1. Любое целевое событие проходит путь `module -> bus -> hub -> канал`.
2. In-app уведомление появляется realtime без перезагрузки.
3. Chat сообщение отправляется по правилам.
4. Telegram/Email уважают user preferences.
5. При временном сбое доставка восстанавливается ретраями.
6. Есть аудит: можно проследить судьбу события/уведомления.

## 18) Вопросы на окончательное согласование перед кодом

1. Retention `notifications`: `90` или `180` дней?
2. Quiet hours: глобальные или отдельные по каналам?
3. Email provider в MVP: SMTP/Sendgrid/другой?
4. Telegram в MVP: personal chat, group, или оба?
5. Нужно ли в MVP UI для DLQ requeue (или только админ endpoint)?

---

## 19) Покрытие producers (актуальный бэклог / факт)

**Паттерн в коде:** хелпер `log_entity_mutation` в `apps/api/app/services/domain_events.py` (обёртка над `emit_domain_event`: запись в БД → Redis Stream → `process_domain_event`).

### Роутеры, где мутации логируются в шину

| Роутер | Примечание |
|--------|------------|
| `tasks` | `emit_domain_event` |
| `deals`, `meetings`, `docs` | `emit` / `log_entity_mutation` |
| `clients`, `projects`, `employees`, `departments`, `tables`, `folders` | CRUD-события |
| `content_posts`, `statuses`, `priorities`, `automation`, `bpm`, `inventory` | |
| `accounts_receivable`, `funnels`, `finance` | включая финплан, выписки, БДР, заявки |
| `weekly_plans` | планы и протоколы + delete |
| `messages` | отправка и прочтение |
| `auth` | `user.created` / `updated` / `archived` |
| `notification_prefs` | компактный payload |
| `activity` | `POST` — построчно; `PUT` — одно событие **`activity_log.bulk_synced`** на весь запрос |
| `notifications` | смена прочитанности in-app уведомления |
| `notification_events` | ручной `POST /publish` |

### Намеренно без доменного события

| Что | Почему |
|-----|--------|
| `POST /auth/login` | не бизнес-мутация; при необходимости аудит сессий — отдельный канал |
| Роуты **`/admin/*`** | обслуживание (requeue, retention, тесты, тестовые сообщения в Telegram) |
| `POST /notifications/deliveries/run`, `POST /notifications/retention/run` | операционные джобы |
| Чтение (`GET`) | не пишет событий |

### Бэклог (продукт / техдолг, не «дыра в emit»)

- Потребители **Redis Streams** (кроме записи при publish): отдельные воркеры `analytics`, `audit-export`, `webhooks` — по мере необходимости.
- **Идемпотентность доставок** и **DLQ UI** — см. фазы 4–5 в этом документе.
- **Фоновые задачи** вне HTTP (если появятся) должны вызывать тот же `emit_domain_event` / `log_entity_mutation`, иначе события не появятся.

Подробнее про ожидания для Telegram-бота и честные ограничения — `docs/development/BOT.md`.
