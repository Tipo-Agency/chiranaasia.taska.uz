# Messages — Входящие и Исходящие Сообщения

## Назначение

Messages (Inbox) — единое хранилище всех сообщений системы: диалоги с клиентами через Telegram,
Instagram, сайт, а также внутренний чат сотрудников. Сообщения привязываются к сделкам (`deal_id`)
и воронкам (`funnel_id`).

Ключевая особенность: **идемпотентная вставка** через `channel + externalMsgId` — повторное
получение одного и того же сообщения (webhook retry) не создаёт дубликат.

---

## Сущность и поля БД

### InboxMessage (таблица `inbox_messages`)

Определена в `models/settings.py`.

| Колонка | Тип БД | Nullable | Дефолт | Описание |
|---------|--------|----------|--------|----------|
| `id` | String(36) | NO | auto UUID | PK |
| `deal_id` | String(36) | YES | — | Привязка к сделке |
| `funnel_id` | String(36) | YES | — | Привязка к воронке |
| `direction` | String(16) | NO | "internal" | Направление: `in`, `out`, `internal` |
| `channel` | String(32) | NO | "internal" | Канал: `telegram`, `instagram`, `site`, `internal` |
| `sender_id` | String(255) | NO | — | ID отправителя (user UUID или внешний ID) |
| `body` | Text | NO | "" | Текст сообщения |
| `media_url` | Text | YES | — | URL медиа-вложения |
| `external_msg_id` | String(512) | YES | — | Внешний ID (из Telegram/Meta) |
| `is_read` | Boolean | NO | false | Прочитано |
| `recipient_id` | String(36) | YES | — | Получатель (user UUID) — для internal / маршрутизации |
| `attachments` | JSONB | YES | [] | Вложения (список объектов) |
| `created_at` | String(50) | NO | — | ISO 8601 метка времени |

**Уникальный индекс:**
```
UNIQUE(channel, external_msg_id)
  name: uq_inbox_messages_channel_external_msg_id
```
Гарантирует идемпотентность: одно и то же сообщение из одного канала не вставится дважды.

---

## Бизнес-правила

### Направление (`direction`)

| Значение | Смысл |
|----------|-------|
| `in` | Входящее от клиента (Telegram, Instagram, сайт) |
| `out` | Исходящее от сотрудника клиенту |
| `internal` | Внутреннее сообщение между сотрудниками |

### Канал (`channel`)

| Значение | Смысл |
|----------|-------|
| `telegram` | Сообщение через Telegram-бот воронки |
| `instagram` | Сообщение через Meta/Instagram |
| `site` | Сообщение с формы на сайте |
| `internal` | Внутренний чат системы |

### Папки (folder)

Используется в `GET /messages` для фильтрации:
- `inbox` — сообщения где `recipient_id = user_id` **ИЛИ** `recipient_id IS NULL/""` (широковещательные)
- `outbox` — сообщения где `sender_id = user_id`

### Идемпотентная вставка

При `POST /messages` с заданными `channel` + `externalMsgId`:
1. Нормализуется `externalMsgId` → `normalize_external_msg_id()`
2. `add_inbox_message()` пытается вставить через `INSERT ... ON CONFLICT DO NOTHING` или аналог
3. Если запись уже существует → возвращается `{ "ok": true, "id": <existing_id>, "deduplicated": true }`
4. Если вставлена новая → `{ "ok": true, "id": <new_id>, "deduplicated": false }`

Доменное событие `chat.message.sent` эмитируется **только при** `inserted=true`.

### Пагинация

Keyset cursor по `(created_at, id)`. Сортировка: `asc` или `desc` (параметр `order`).

---

## API-эндпоинты

| Метод | Путь | Описание | Право |
|-------|------|----------|-------|
| GET | /api/messages | Список сообщений (cursor) | auth |
| POST | /api/messages | Создать/отправить сообщение | auth |
| PATCH | /api/messages/{id} | Пометить прочитанным | auth |

---

## Запросы и ответы

### GET /api/messages — параметры

```
?folder=inbox         # inbox | outbox (обязателен)
&user_id=uuid         # ID текущего пользователя (обязателен)
&deal_id=uuid         # фильтр по сделке (опционально)
&limit=200            # 1..500; default 200
&cursor=<token>       # keyset cursor
&order=desc           # asc | desc по created_at
```

Ответ: `{ "items": [...], "total": N, "limit": N, "next_cursor": "..." | null }`

```json
{
  "items": [
    {
      "id": "uuid",
      "senderId": "uuid",
      "recipientId": "uuid | null",
      "text": "текст",
      "body": "текст",
      "attachments": [],
      "createdAt": "2025-01-15T10:00:00Z",
      "read": false,
      "isRead": false,
      "dealId": "uuid | null",
      "funnelId": "uuid | null",
      "direction": "in",
      "channel": "telegram",
      "mediaUrl": null,
      "externalMsgId": "tg-12345"
    }
  ],
  "total": 42,
  "limit": 200,
  "next_cursor": null
}
```

Примечание: `text` и `body` — синонимы в ответе (оба содержат одинаковое значение).
`read` и `isRead` — тоже синонимы.

### POST /api/messages — MessageCreateBody (`extra="forbid"`)

```json
{
  "id":             "uuid (опционально; если не передан — auto UUID)",
  "recipientId":    "uuid | null",
  "body":           "текст сообщения",
  "text":           "альтернатива body",
  "channel":        "internal | telegram | instagram | site",
  "externalMsgId":  "внешний ID (для дедупликации)",
  "external_msg_id":"snake_case альтернатива",
  "direction":      "in | out | internal (def: out)",
  "dealId":         "uuid | null",
  "deal_id":        "snake_case альтернатива",
  "funnelId":       "uuid | null",
  "funnel_id":      "snake_case альтернатива",
  "mediaUrl":       "url | null",
  "media_url":      "snake_case альтернатива",
  "senderId":       "uuid | null",
  "attachments":    [],
  "createdAt":      "ISO8601 (def: now UTC)"
}
```

Приоритет полей: `body` или `text` (первый непустой); `dealId` или `deal_id`; `externalMsgId` или `external_msg_id`.

Ответ: `{ "ok": true, "id": "uuid", "deduplicated": bool }`

### PATCH /api/messages/{id} — MessageReadPatchBody (`extra="forbid"`)

```json
{
  "read":   true,
  "isRead": true
}
```

Приоритет: `read` если не null, иначе `isRead`. Если оба null — устанавливается `true`.

Ответ: `{ "ok": true }`

---

## Домейн-события

| Событие | Когда |
|---------|-------|
| `chat.message.sent` | POST создаёт новое сообщение (не дубликат) |
| `chat.message.read` | PATCH обновляет is_read |

Payload `chat.message.sent`:
```json
{
  "recipientId": "uuid",
  "textLen": 42,
  "attachmentCount": 0,
  "channel": "telegram",
  "deduplicated": false
}
```

---

## Связи с другими модулями

| Связь | Описание |
|-------|----------|
| CRM | `deal_id` — сообщения отображаются в карточке сделки |
| Integrations | Telegram/Meta webhook → `POST /messages` (direction=in, channel=telegram/instagram) |
| Integrations | Отправка сообщения → `POST /messages` (direction=out) + реальная отправка через API |
| Auth | `sender_id` / `recipient_id` = user UUID из системы |

---

## Коды ошибок

| HTTP | Когда |
|------|-------|
| 400 | `folder` != inbox/outbox: `"folder_must_be_inbox_or_outbox"` |
| 400 | `order` != asc/desc: `"order_must_be_asc_or_desc"` |
| 400 | Невалидный cursor: `"invalid_cursor"` |
| 422 | extra="forbid" нарушено в MessageCreateBody |

---

## Edge Cases

| Ситуация | Поведение |
|----------|-----------|
| POST без externalMsgId | Всегда вставляется новая запись |
| POST с channel+externalMsgId дубликат | Возвращает existing id; `deduplicated: true`; событие НЕ эмитируется |
| POST без body и text | Сохраняется пустая строка `""` |
| GET inbox без deal_id | Все входящие сообщения пользователя |
| GET inbox с deal_id | Только сообщения конкретной сделки |
| PATCH несуществующего id | Ошибки нет; возвращается `{ "ok": true }` |
| channel = internal, external_msg_id = null | Нет риска коллизии UNIQUE (NULL != NULL в PostgreSQL) |
| attachments | Произвольный JSONB список; не валидируется сервером |
| created_at | Если не передан — устанавливается текущее время UTC в формате `2025-01-15T10:00:00.000Z` |
