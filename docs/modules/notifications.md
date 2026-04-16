# Notifications — Уведомления, Доставка, WebSocket

## Назначение

Notifications — кросс-модульная инфраструктура событий. Любое доменное событие
(задача назначена, сделка создана, заявка одобрена) проходит через этот слой
и доставляется пользователям через несколько каналов.

---

## Сущности и поля БД

### Notification (таблица `notifications`)

| Колонка | Тип | Nullable | Дефолт | Описание |
|---------|-----|----------|--------|----------|
| `id` | String(36) | NO | auto UUID | PK |
| `user_id` | String(36) | NO | — | Получатель; индекс |
| `type` | String(120) | NO | — | Тип уведомления; индекс |
| `title` | String(255) | NO | — | Заголовок |
| `body` | Text | NO | — | Тело |
| `entity_type` | String(60) | YES | — | Тип сущности (task, deal, ...) |
| `entity_id` | String(120) | YES | — | ID сущности |
| `is_read` | Boolean | NO | false | Прочитано; индекс |
| `created_at` | DateTime(TZ) | NO | now() | Дата создания; индекс |

### NotificationDelivery (таблица `notification_deliveries`)

Внешняя доставка уведомления (Telegram / Email).

| Колонка | Тип | Nullable | Дефолт | Описание |
|---------|-----|----------|--------|----------|
| `id` | String(36) | NO | auto UUID | PK |
| `notification_id` | String(36) | NO | — | FK→notifications.id; индекс |
| `channel` | String(30) | NO | — | `telegram` или `email`; индекс |
| `recipient` | String(512) | NO | "" | chat_id (Telegram) или email |
| `status` | String(30) | NO | "pending" | Статус; индекс |
| `attempts` | Integer | NO | 0 | Число попыток |
| `last_error` | String(2000) | YES | — | Последняя ошибка |
| `next_retry_at` | DateTime(TZ) | YES | — | Когда следующая попытка; индекс |
| `sent_at` | DateTime(TZ) | YES | — | Фактическая отправка |

### NotificationPreferences (таблица `notification_prefs`)

| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | String(36) | PK; значение = `user_id` или `"default"` |
| `prefs` | JSONB | Полный объект настроек |
| `default_funnel_id` | String(36) | Воронка по умолчанию для уведомлений |
| `telegram_group_chat_id` | String(50) | Групповой Telegram-чат для уведомлений |

### NotificationEvent (таблица `notification_events`)

Каноничный лог доменных событий (INSERT-only, не изменяется).

| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | String(36) | PK |
| `event_type` | String(120) | Тип события (task.assigned, deal.created, ...) |
| `occurred_at` | DateTime(TZ) | Время события (с timezone) |
| `actor_id` | String(36) | Кто инициировал |
| `org_id` | String(36) | Организация |
| `entity_type` | String(60) | Тип сущности |
| `entity_id` | String(120) | ID сущности |
| `source` | String(120) | Откуда (router name) |
| `correlation_id` | String(120) | Для трассировки |
| `payload` | JSONB | Данные события |
| `published_to_stream` | Boolean | Отправлено в Redis stream |
| `stream_id` | String(120) | ID в Redis stream |
| `hub_processed_at` | DateTime(TZ) | Обработано воркером |
| `created_at` | DateTime(TZ) | now() |

### NotificationArchive (таблица `notifications_archive`)

Архивные уведомления после retention. Структура идентична `notifications`.

### AutomationRule (таблица `automation_rules`)

| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | String(36) | PK |
| `rule` | JSONB | Произвольный объект правила автоматизации |

---

## Машина состояний доставки

```
pending
  │
  │ (worker взял задачу)
  ▼
sending
  │
  ├── успех → sent ✓
  │
  └── ошибка → (attempts < MAX_ATTEMPTS=5) → retry
                    │
                    │ (backoff: 60s / 300s / 900s / 3600s)
                    ▼
                 pending ← (next_retry_at наступил)
                    │
                    │ (attempts >= MAX_ATTEMPTS или fatal error)
                    ▼
                  dead → DeadLetterQueue
```

**MAX_ATTEMPTS = 5**

Backoff по числу попыток:
| Попытка | Задержка |
|---------|----------|
| 1 | 60 сек |
| 2 | 300 сек (5 мин) |
| 3 | 900 сек (15 мин) |
| 4 | 3600 сек (1 час) |
| 5+ | dead |

**Fatal errors** (сразу dead без retry):
- Неверная конфигурация получателя
- Telegram chat_id не найден (бот не запущен)
- Email адрес невалиден

**Rate limit (429 от Telegram)**: retry с увеличенным backoff.

---

## Pipeline уведомлений

```
1. Доменное событие
     ↓
2. emit_domain_event(db, event_type, ...)
     → INSERT notification_events (published_to_stream=false)
     → XADD queue.domain.v1 { event_id }
     ↓
3. domain_events_worker читает stream
     → Строит получателей по настройкам (prefs)
     → INSERT notifications (per user)
     → INSERT notification_deliveries (per channel per user)
     → hub_processed_at = now()
     ↓
4. XADD queue.notifications.v1 { notification_id }
     ↓
5. notifications_worker
     → process_deliveries_for_notification(db, notification_id)
     → Telegram: bot.send_message(chat_id, text)
     → Email: SMTP send
     → status: sending → sent / retry / dead
     ↓
6. realtime_hub.emit(user_id, payload)
     → Redis PUBLISH notifications:{user_id}
     → WebSocket push на все открытые вкладки
```

При ``DOMAIN_EVENTS_HUB_ASYNC=true`` шаг 4 (**XADD** ``queue.notifications.v1``) выполняется **после** ``COMMIT`` в ``domain_events_worker`` (и dedupe по ``notification_id`` в одном батче). При синхронном hub (``false``) — через ``flush_post_commit_notification_jobs`` после commit HTTP-сессии.

**Процессы, без которых «тишина» в Telegram/e-mail:** ``notifications-worker`` обязателен всегда; при ``DOMAIN_EVENTS_HUB_ASYNC=true`` ещё и ``domain_events_worker``. Старт API создаёт consumer group на ``queue.domain.v1`` через ``ensure_domain_events_hub_consumer_group`` (имя группы из ``REDIS_DOMAIN_EVENTS_HUB_GROUP``).

---

## WebSocket Realtime

```
wss://tipa.taska.uz/api/notifications/ws/{user_id}
```

- Клиент подключается при загрузке SPA
- `user_id` = UUID пользователя (не валидируется токеном в WS — только по uuid формату)
- Лимит: `WEBSOCKET_MAX_CONNECTIONS_PER_USER = 20` одновременных соединений
- Keepalive: клиент отправляет любой текст → сервер не обрабатывает, просто держит соединение
- При отключении: `realtime_hub.disconnect(uid, websocket)`
- Payload события в WS: произвольный JSON (зависит от типа события)

**Reconnect на клиенте:** exponential backoff (1s → 2s → 4s → max 30s).

---

## Настройки уведомлений (NotificationPreferences)

### Поиск настроек

```
GET /api/notification-prefs?user_id=uuid
1. Поиск по user_id в notification_prefs
2. Если не найдено → поиск по id="default"
3. Если "default" не найдено → возвращаются системные дефолты (_default_prefs())
```

### Структура объекта prefs

```json
{
  "channels": {
    "in_app": true,
    "chat": true,
    "telegram": false,
    "email": false
  },
  "quietHours": {
    "enabled": false,
    "start": "22:00",
    "end": "09:00",
    "timezone": "Asia/Tashkent"
  },
  "telegram": {
    "newTask": false,
    "statusChange": false,
    "taskAssigned": false,
    "taskComment": false,
    "taskDeadline": false,
    "docCreated": false,
    "docUpdated": false,
    "docShared": false,
    "meetingCreated": false,
    "meetingReminder": false,
    "meetingUpdated": false,
    "postCreated": false,
    "postStatusChanged": false,
    "purchaseRequestCreated": false,
    "purchaseRequestStatusChanged": false,
    "financePlanUpdated": false,
    "dealCreated": false,
    "dealStatusChanged": false,
    "clientCreated": false,
    "contractCreated": false,
    "employeeCreated": false,
    "employeeUpdated": false,
    "processStarted": false,
    "stepCompleted": false,
    "stepRequiresApproval": false
  }
}
```

### telegram_group_chat_id

Глобальная настройка: уведомления определённых типов отправляются в группу, а не только лично.
Хранится в `notification_prefs.telegram_group_chat_id`.

### default_funnel_id

Воронка по умолчанию для новых входящих сообщений/лидов.
Хранится в `notification_prefs.default_funnel_id`.

---

## API-эндпоинты

### Уведомления

| Метод | Путь | Описание | Право |
|-------|------|----------|-------|
| GET | /api/notifications | Список уведомлений пользователя | auth |
| GET | /api/notifications/unread-count | Количество непрочитанных | auth |
| POST | /api/notifications/{id}/read | Пометить прочитанным/непрочитанным | auth |
| WS | /api/notifications/ws/{user_id} | Realtime подключение | — |
| POST | /api/notifications/deliveries/run | Поставить в очередь доставки | auth |
| POST | /api/notifications/retention/run | Архивировать старые уведомления | auth |

### Настройки

| Метод | Путь | Описание | Право |
|-------|------|----------|-------|
| GET | /api/notification-prefs | Настройки пользователя | auth |
| PUT | /api/notification-prefs | Обновить настройки | auth |

### Доменные события

| Метод | Путь | Описание |
|-------|------|----------|
| GET | /api/notification-events/recent | Последние события |
| POST | /api/notification-events | Опубликовать событие вручную |

### Автоматизации

| Метод | Путь | Описание |
|-------|------|----------|
| GET | /api/automation/rules | Все правила автоматизации |
| PUT | /api/automation/rules | Bulk upsert правил |

---

## Параметры GET /api/notifications

```
?user_id=uuid       (обязателен)
&unread_only=false  (только непрочитанные)
&limit=50           (1..500)
```

Ответ: `list[NotificationRowRead]`

```json
[
  {
    "id": "uuid",
    "userId": "uuid",
    "type": "task.assigned",
    "title": "Вам назначена задача",
    "body": "Проверить договор с клиентом",
    "entityType": "task",
    "entityId": "uuid",
    "isRead": false,
    "createdAt": "2025-01-15T10:00:00Z"
  }
]
```

---

## Параметры POST /api/notifications/{id}/read

```json
{ "isRead": true }
```

Ответ: `{ "ok": true }` или `{ "ok": false, "error": "not_found" }`

---

## Retention (очистка старых уведомлений)

```
POST /api/notifications/retention/run?days=90
```

- По умолчанию: `NOTIFICATIONS_RETENTION_DAYS` из settings
- Старые уведомления перемещаются в `notifications_archive`
- Удаляются старые `notification_events` и `notification_deliveries`

Ответ: `{ "ok": true, "days": 90, "archived_notifications": 1234, "deleted_events": 5678, "deleted_deliveries": 910 }`

---

## Deliveries Run (ручной запуск доставки)

```
POST /api/notifications/deliveries/run?limit=100
```

Ставит в очередь `queue.notifications.v1` задачи для всех `pending`/`retry` доставок,
у которых `next_retry_at` уже наступил. Не выполняет синхронную отправку.

Ответ: `{ "ok": true, "queued": 42 }`

---

## Связи с другими модулями

| Модуль | Какие события |
|--------|---------------|
| Tasks | `task.assigned`, `task.status.changed` |
| CRM | `deal.created`, `deal.status.changed`, `client.created` |
| Finance | `finance_request.created`, `finance_request.status.changed` |
| BPM | `bpm.process.started`, `bpm.step.completed` |
| Spaces | `content_post.status.changed`, `meeting.created` |
| HR | `employee.created`, `employee.updated` |
| Messages | `chat.message.sent` |

---

## Коды ошибок

| HTTP | Когда |
|------|-------|
| 503 | `deliveries/run` — Redis недоступен |

---

## Edge Cases

| Ситуация | Поведение |
|----------|-----------|
| WS: > 20 соединений от пользователя | Старые соединения закрываются |
| Telegram не настроен в prefs | Канал telegram пропускается при создании deliveries |
| Quiet hours | Доставка откладывается до конца тихих часов (логика в воркере) |
| Delivery dead (5 попыток) | Запись в DeadLetterQueue; gauge `notification_deliveries_dead_count` обновляется |
| notification_prefs не найдено | Возвращаются системные дефолты (все каналы off кроме in_app/chat) |
| AutomationRule.rule | Произвольный JSONB; структура не валидируется сервером (клиентская логика) |
| Retention run без параметра days | Использует NOTIFICATIONS_RETENTION_DAYS из config |
