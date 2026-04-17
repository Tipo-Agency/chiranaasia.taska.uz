# Integrations — Telegram, Meta/Instagram, Сайт, MTProto

## Назначение

Integrations — модуль внешних подключений. Обеспечивает получение входящих сообщений от клиентов
через мессенджеры и сайт, отправку исходящих, управление API-ключами, а также работу с личным
Telegram-аккаунтом сотрудника (MTProto/Telethon).

---

## Сущности и поля БД

### SiteIntegrationKey (таблица `site_integration_keys`)

| Колонка | Тип | Nullable | Дефолт | Описание |
|---------|-----|----------|--------|----------|
| `id` | String(36) | NO | auto UUID | PK |
| `funnel_id` | String(36) | NO | — | UNIQUE; воронка которой принадлежит ключ |
| `api_key_hash` | String(64) | NO | — | UNIQUE; SHA-256 хэш ключа |
| `key_last4` | String(4) | NO | — | Последние 4 символа ключа (для отображения) |
| `is_active` | Boolean | NO | true | Активен |
| `created_at` | DateTime(TZ) | NO | now() | Дата создания |
| `rotated_at` | DateTime(TZ) | YES | — | Дата последней ротации |

### TelegramIntegrationState (таблица `telegram_integration_states`)

| Колонка | Тип | Nullable | Описание |
|---------|-----|----------|----------|
| `funnel_id` | String(36) | NO | PK; воронка |
| `last_update_id` | BigInteger | YES | Watermark для polling Telegram Bot API |
| `updated_at` | DateTime(TZ) | YES | Дата последнего обновления |

### MtprotoSession (таблица `mtproto_sessions`)

| Колонка | Тип | Nullable | Описание |
|---------|-----|----------|----------|
| `id` | String(36) | NO | PK |
| `user_id` | String(36) | NO | UNIQUE; пользователь системы |
| `status` | String(30) | NO | Состояние сессии (см. ниже) |
| `session_data` | Text | YES | Fernet-зашифрованные данные сессии Telethon |
| `pending_phone` | String(30) | YES | Телефон в процессе авторизации |
| `pending_phone_code_hash` | String(100) | YES | Хэш кода из SMS |
| `phone_masked` | String(30) | YES | Маскированный номер для отображения (+998 ** *** 99) |
| `created_at` | DateTime(TZ) | YES | — |
| `updated_at` | DateTime(TZ) | YES | — |
| `connected_at` | DateTime(TZ) | YES | Когда стала active |

---

## Telegram Funnel Webhook

### Как работает

Каждая воронка может иметь собственный Telegram-бот. Настройки хранятся в `SalesFunnel.sources["telegram"]` (JSONB).

Структура `sources["telegram"]`:
```json
{
  "bot_token": "123456:ABC-...",
  "chat_id": null,
  "webhook_url": "https://tipa.taska.uz/api/integrations/telegram/webhook/<funnel_id>",
  "secret_token": "random-secret-32-chars"
}
```

### Регистрация webhook

```
POST /api/integrations/telegram/register
Body: { "funnelId": "uuid" }
```

1. Берёт `bot_token` из `SalesFunnel.sources["telegram"]`
2. Генерирует `secret_token` (32-символьный random)
3. Вызывает Telegram Bot API `setWebhook`:
   - `url` = `https://domain/api/integrations/telegram/webhook/{funnel_id}`
   - `secret_token` = сгенерированный токен
4. Сохраняет `secret_token` в `SalesFunnel.sources["telegram"]["secret_token"]`
5. Возвращает `{ "ok": true }`

### Отмена регистрации

```
POST /api/integrations/telegram/unregister
Body: { "funnelId": "uuid" }
```

Вызывает Telegram Bot API `deleteWebhook`. Очищает `secret_token`.

### Входящий webhook (публичный)

```
POST /api/integrations/telegram/webhook/{funnel_id}
Headers: X-Telegram-Bot-Api-Secret-Token: <secret>
```

**Без CSRF** (исключение из middleware).

1. Верификация `X-Telegram-Bot-Api-Secret-Token` из заголовка против `SalesFunnel.sources["telegram"]["secret_token"]`
2. Несовпадение → 200 (не 401, чтобы не раскрывать наличие эндпоинта)
3. При совпадении → вызывает `process_telegram_update_dict(db, funnel_id, update)`
4. Немедленно возвращает 200 (fast ack)

### Отправка сообщения клиенту

```
POST /api/integrations/telegram/send
Право: system.full_access ИЛИ crm.client_chats ИЛИ crm.sales_funnel

Body: {
  "dealId": "uuid",
  "text":   "Текст сообщения",
  "mediaUrl": "https://... (опционально)"
}
```

1. Находит сделку → берёт `custom_fields._telegram.chat_id` и `funnel_id`
2. Берёт `bot_token` из `SalesFunnel.sources["telegram"]`
3. Отправляет через Telegram Bot API
4. Сохраняет исходящее сообщение через `POST /messages` (direction=out, channel=telegram)

### Статус webhook

```
GET /api/integrations/telegram/status?funnelId=uuid
```

Возвращает текущее состояние webhook: url, is_registered, pending_update_count.

---

## Meta / Instagram Webhook

### Верификация подписки (GET)

```
GET /api/integrations/meta/webhook
?hub.mode=subscribe
&hub.challenge=<string>
&hub.verify_token=<token>
```

1. Проверяет `hub.verify_token` против `META_WEBHOOK_VERIFY_TOKEN` из config
2. При совпадении → возвращает `hub.challenge` как plain text (200)
3. При несовпадении → 403

### Входящие события (POST)

```
POST /api/integrations/meta/webhook
Headers: X-Hub-Signature-256: sha256=<hmac>
```

**Без CSRF** (исключение из middleware).

1. Верификация подписи: `HMAC-SHA256(body, META_APP_SECRET)` против заголовка
2. Несовпадение → 403
3. **Дедупликация через Redis**: `SHA256(body)` → `SET NX` с TTL 600 секунд
   - Ключ уже существует → 200 (дубликат, пропускаем)
4. Валидная новая нагрузка → `push_meta_webhook_from_api(redis, body)` → XADD в Redis stream
5. Немедленно возвращает 200 (fast ack)

### Отправка в Instagram

```
POST /api/integrations/meta/instagram/send
Право: system.full_access ИЛИ crm.client_chats ИЛИ crm.sales_funnel

Body: {
  "dealId": "uuid",
  "text":   "Текст",
  "mediaUrl": "https://... (опционально)"
}
```

Использует тот же `send_message()` сервис что и Telegram.

---

## Сайт — Лиды

### Получение лида

```
POST /api/integrations/site/leads
Headers: X-Api-Key: <key>

Rate limit: 30 запросов в минуту (по IP + API key)
Без CSRF (исключение из middleware)
```

**Аутентификация**: `X-Api-Key` валидируется через SHA-256:
1. `SHA256(api_key)` → ищем в `SiteIntegrationKey.api_key_hash`
2. Ключ не найден или `is_active=false` → 401
3. Берём `funnel_id` из найденной записи

**Тело запроса** (`SiteLeadBody`):
```json
{
  "name":    "Иван Иванов",
  "phone":   "+998901234567",
  "email":   "ivan@example.com",
  "message": "Хочу заказать...",
  "source":  "contact_form"
}
```

**Дедупликация лидов:**
1. Нормализуем телефон: удаляем всё кроме цифр и `+`
2. Нормализуем email: lowercase + trim
3. Проверяем: есть ли Deal с `source="site"` и `custom_fields._site.phone == normalized_phone`
   **ИЛИ** `custom_fields._site.email == normalized_email`
4. Если дубликат найден → возвращаем `{ "ok": true, "dealId": <existing>, "new": false }`

**Создание сделки при новом лиде:**
1. Создаём `Deal`:
   - `title` = имя лида
   - `source = "site"`
   - `funnel_id` = из API ключа
   - `stage_id` = первая стадия воронки (min order)
   - `custom_fields._site` = `{ "phone": normalized_phone, "email": normalized_email, "message": message, "source": source }`
   - `assignee_id` = из `NotificationPreferences.default_funnel_id` или null
2. Эмитируется `deal.assigned` если assignee задан
3. Ответ: `{ "ok": true, "dealId": <new_id>, "new": true }`

### Управление API ключами

```
POST /api/integrations/site/keys/rotate
Body: { "funnelId": "uuid" }
Право: settings.integrations
```

1. Генерирует новый ключ (`secrets.token_urlsafe(32)`)
2. Обновляет `SiteIntegrationKey`:
   - `api_key_hash` = SHA256(new_key)
   - `key_last4` = new_key[-4:]
   - `rotated_at` = now()
3. Возвращает ключ **один раз**: `{ "apiKey": "...", "last4": "...", "rotatedAt": "..." }`

**Важно**: после ротации старый ключ немедленно перестаёт работать.

```
GET /api/integrations/site/keys/status?funnelId=uuid
Право: settings.integrations
```

Возвращает статус ключа без раскрытия самого ключа: `{ "last4": "xxxx", "isActive": true, "createdAt": "...", "rotatedAt": "..." }`.

---

## MTProto (Личный Telegram)

### Машина состояний сессии

```
inactive
  │ (POST /send-code — ввод телефона)
  ▼
pending_code
  │ (POST /sign-in/code — ввод SMS кода)
  ▼
pending_password (только если включена 2FA)
  │ (POST /sign-in/password)
  ▼
active ←──────────────────────────────────────────────────────────────────────
  │ (POST /disconnect или сессия протухла)
  ▼
inactive
```

| Статус | Описание | Разрешённые действия |
|--------|----------|----------------------|
| `inactive` | Нет активной сессии | POST send-code |
| `pending_code` | Ожидает SMS код | POST sign-in/code |
| `pending_password` | Ожидает пароль 2FA | POST sign-in/password |
| `active` | Сессия активна | send, disconnect |

Хелперы проверки состояния:
- `mtproto_can_request_code(session)` → True если inactive
- `mtproto_can_sign_in_code(session)` → True если pending_code
- `mtproto_can_sign_in_password(session)` → True если pending_password
- `mtproto_is_active(session)` → True если active

### Шифрование сессии

`session_data` содержит бинарные данные сессии Telethon, зашифрованные через **Fernet** (симметричное шифрование).
Ключ = `MTPROTO_SESSION_KEY` из config.

### API MTProto

```
POST /api/integrations/telegram-personal/send-code
Право: crm.client_chats ИЛИ crm.sales_funnel

Body: { "userId": "uuid", "phone": "+998901234567" }
```

1. Проверяет `status=inactive` → иначе 409
2. Инициирует авторизацию Telethon → получает `phone_code_hash`
3. Сохраняет `pending_phone`, `pending_phone_code_hash`, `phone_masked`
4. Статус → `pending_code`

```
POST /api/integrations/telegram-personal/sign-in/code
Body: { "userId": "uuid", "code": "12345" }
```

1. Проверяет `status=pending_code`
2. Передаёт код в Telethon
3. При успехе без 2FA → шифрует session_data, статус → `active`
4. При необходимости 2FA → статус → `pending_password`

```
POST /api/integrations/telegram-personal/sign-in/password
Body: { "userId": "uuid", "password": "..." }
```

1. Проверяет `status=pending_password`
2. Отправляет пароль в Telethon
3. При успехе → шифрует session_data, статус → `active`

```
POST /api/integrations/telegram-personal/disconnect
Body: { "userId": "uuid" }
```

1. Завершает Telethon сессию
2. Очищает `session_data`, статус → `inactive`

```
POST /api/integrations/telegram-personal/deals/{deal_id}/messages/sync
```

Асинхронная синхронизация переписки сделки через личный аккаунт.
Отправляет задачу в Redis Stream `integrations.stream.v1`.

```
POST /api/integrations/telegram-personal/send
Body: {
  "dealId":   "uuid",
  "text":     "Текст",
  "mediaUrl": "https://... (опционально)"
}
```

Отправка сообщения от личного аккаунта.

```
GET /api/integrations/telegram-personal/media/{message_id}
```

Стриминговая загрузка медиа-файла через личный аккаунт (chunked transfer encoding).

---

## API-эндпоинты — сводная таблица

### Telegram Funnel (Bot API)

| Метод | Путь | Описание | Право |
|-------|------|----------|-------|
| POST | /api/integrations/telegram/register | Зарегистрировать webhook | `settings.integrations` |
| POST | /api/integrations/telegram/unregister | Удалить webhook | `settings.integrations` |
| GET | /api/integrations/telegram/status | Статус webhook | `settings.integrations` |
| POST | /api/integrations/telegram/send | Отправить сообщение | `crm.client_chats` ИЛИ `crm.sales_funnel` |
| POST | /api/integrations/telegram/webhook/{funnel_id} | Входящий webhook | **без auth** |

### Meta / Instagram

| Метод | Путь | Описание | Право |
|-------|------|----------|-------|
| GET | /api/integrations/meta/webhook | Верификация подписки | **без auth** |
| POST | /api/integrations/meta/webhook | Входящие события | **без auth** |
| POST | /api/integrations/meta/instagram/send | Отправить сообщение | `crm.client_chats` ИЛИ `crm.sales_funnel` |

### Сайт (Лиды)

| Метод | Путь | Описание | Право |
|-------|------|----------|-------|
| POST | /api/integrations/site/leads | Получить лид | `X-Api-Key` |
| POST | /api/integrations/site/keys/rotate | Ротация API ключа | `settings.integrations` |
| GET | /api/integrations/site/keys/status | Статус API ключа | `settings.integrations` |

### MTProto (Личный Telegram)

| Метод | Путь | Описание | Право |
|-------|------|----------|-------|
| POST | /api/integrations/telegram-personal/send-code | Начать авторизацию | `crm.client_chats` |
| POST | /api/integrations/telegram-personal/sign-in/code | Ввести SMS код | `crm.client_chats` |
| POST | /api/integrations/telegram-personal/sign-in/password | Ввести пароль 2FA | `crm.client_chats` |
| POST | /api/integrations/telegram-personal/disconnect | Отключить сессию | `crm.client_chats` |
| POST | /api/integrations/telegram-personal/send | Отправить сообщение | `crm.client_chats` |
| POST | /api/integrations/telegram-personal/deals/{id}/messages/sync | Синхронизировать историю | `crm.client_chats` |
| GET | /api/integrations/telegram-personal/media/{msg_id} | Скачать медиа | `crm.client_chats` |

---

## Коды ошибок

| HTTP | Когда |
|------|-------|
| 401 | X-Api-Key отсутствует или не найден в БД |
| 401 | SiteIntegrationKey.is_active = false |
| 403 | Meta webhook: подпись X-Hub-Signature-256 не совпадает |
| 403 | Meta verify: hub.verify_token не совпадает |
| 409 | MTProto: send-code когда сессия не в состоянии inactive |
| 409 | MTProto: sign-in когда статус неверный |
| 429 | Site leads: rate limit 30/min |

---

## Конфигурация (env / config)

| Переменная | Описание |
|------------|----------|
| `META_WEBHOOK_VERIFY_TOKEN` | Токен верификации Meta подписки |
| `META_APP_SECRET` | Secret для HMAC подписи Meta событий |
| `MTPROTO_SESSION_KEY` | Fernet ключ для шифрования Telethon сессий |
| `SITE_INTEGRATION_API_KEY` | Базовый ключ (генерируется при первом запуске) |

---

## Связи с другими модулями

| Связь | Описание |
|-------|----------|
| CRM | Лиды с сайта → создаются Deal с source="site"; Telegram/Instagram сообщения привязываются к Deal |
| Messages | Все входящие/исходящие → INSERT в `inbox_messages` |
| Notifications | Входящее сообщение от клиента → уведомление назначенному менеджеру |
| Auth | `settings.integrations` — право на управление ключами и webhook; `crm.client_chats` — право на отправку |

---

## Edge Cases

| Ситуация | Поведение |
|----------|-----------|
| Telegram webhook с неверным secret_token | Возвращает 200 (не раскрываем наличие эндпоинта) |
| Meta webhook повторный запрос (retry) | SHA256 деdup → Redis SET NX; дубликат возвращает 200 без обработки |
| Лид с телефоном существующей сделки | `deduplicated: true`; сделка НЕ обновляется |
| Лид без телефона и email | Проверка дедупликации пропускается; создаётся новая сделка |
| Site API key ротация | Старый ключ немедленно перестаёт работать |
| MTProto: send когда сессия inactive | 409 или ошибка на уровне Telethon |
| MTProto session_data потеряна/повреждена | Статус → inactive; требуется повторная авторизация |
| Telegram send без chat_id в сделке | Ошибка: не удаётся найти получателя |
