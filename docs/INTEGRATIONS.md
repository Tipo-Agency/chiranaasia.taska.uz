# Интеграции с внешними сервисами

Сквозные договорённости (вебхуки, очереди, ошибки, SLA, секреты) — **§2**. Каналы Meta / Telegram / MTProto / сайт / бот / хранилище — **§3–§9**. Переменные окружения — **§10**, метрики SQL — **§11**. Согласовать с [ARCHITECTURE.md](./ARCHITECTURE.md), [API.md](./API.md), [SECURITY.md](./SECURITY.md).

Сверка кода с описанием интеграций, очередями и ADR — по этому файлу, [QUEUES.md](./QUEUES.md), [DECISIONS.md](./DECISIONS.md).

---

## 1. Обзор


| Интеграция                         | Направление      | Протокол            | Статус      |
| ---------------------------------- | ---------------- | ------------------- | ----------- |
| Meta (Instagram/Messenger)         | Вход + исходящие | Webhook + Graph API | Реализована |
| Telegram Bot API (исходящие лидам) | Исходящие        | Bot API             | Реализована |
| Telegram (входящие лиды)           | Вход             | getUpdates polling  | Реализована |
| Telegram MTProto (личный аккаунт)  | Двусторонний     | Telethon            | Реализована |
| Сайт (лиды через форму)            | Вход             | REST + API-key      | Реализована |
| apps/bot (внутренний бот команды)  | Двусторонний     | Bot API             | Реализован  |
| Корп. почта (Google / Яндекс / Microsoft 365) | Двусторонний | OAuth + Gmail API / Graph / IMAP | [PLANNED] §12 |
| 1С (несколько видов коннекторов)   | Вход / двусторонний | OData, HTTP-сервисы, файлы | [PLANNED] §12 |
| IP-телефония (АТС)                 | Вход событий     | Webhooks / CTI      | [PLANNED] §12 |
| ЭДО (операторы)                    | Двусторонний     | API оператора       | [PLANNED] §12 |
| Банки (несколько банков и типов)   | Вход / исход     | API, файлы, 1С-банк | [PLANNED] §12 |


### 1.1 Карта «интеграция → артефакты репозитория»

| Строка §1 | Роутеры / вход HTTP | Очередь / воркер | Прочее |
| --------- | -------------------- | ----------------- | ------ |
| Meta | `app/api/routers/meta_webhook.py` (`GET`/`POST /webhook/meta`) | `xadd_meta_webhook_job` → `REDIS_INTEGRATIONS_STREAM` (`queue.integrations.v1`), consumer `integrations_worker` | Разбор: `app/services/meta_instagram.py` (dedup `mid` / `metaMid` в комментариях сделки) |
| Telegram Bot исходящие | — | `queue.notifications.v1`, `notifications_worker` | `app/services/telegram_sender.py` (429 / `retry_after`) |
| Telegram входящие (polling) | — | `integrations_worker` → `app/services/telegram_leads.py` (`poll_all_funnels`, offset Redis + `telegram_integration_state`) | |
| Telegram MTProto | `app/api/routers/integrations_telegram_personal.py` | sync: `xadd_telegram_personal_sync_job` → тот же stream, `integrations_worker` | Сессии: `app/models/mtproto_session.py`, `app/services/telegram_personal.py` |
| Сайт (лиды) | `app/api/routers/integrations_site.py` (`POST /api/integrations/site/leads`) | — | Ключи: `SiteIntegrationKey`, схема `SiteLeadPayload` |
| apps/bot | отдельный пакет `apps/bot/` | см. архитектуру бота | |
| [PLANNED] §12 | `GET /api/integrations/roadmap`, `integrations_roadmap_catalog.py` | будущие jobs в `queue.*.vN` | `app/services/integration_domains/*` (заготовки) |

---

## 2. Сквозные принципы

Часть пунктов — **[TARGET]** (целевой контракт); в as-built сверять с кодом.

### Вебхуки (Meta, Telegram secret path, и т.д.)

| Тема | Правило |
| ---- | ------- |
| **Идемпотентность / dedup key** | У каждого входящего события — стабильный ключ: **Meta** — `mid` (и при необходимости составной ключ в БД); **Telegram Bot** — `update_id`; **сайт (лид)** — нормализованный `hash(funnel_id, phone, email, bucket_по_времени)` и/или заголовок **`Idempotency-Key`** от клиента формы. Повтор с тем же ключом — безопасный no-op или 200 с тем же телом. |
| **Replay protection** | Если в payload/заголовках есть **время события** — отклонять записи старше **5–10 минут** (с поправкой на clock skew). Плюс дедуп по уникальному id (см. [API.md](./API.md) §8). |
| **Таймаут HTTP** | В обработчике вебхука: **только валидация + `200 OK` + постановка в очередь** (**&lt; 1–2 с** SLA). Тяжёлая бизнес-логика — **только в воркере** ([ARCHITECTURE.md](./ARCHITECTURE.md) §6). |
| **Версия payload** | Опциональный заголовок **`X-Webhook-Version`** (или поле в JSON) для поэтапного rollout схемы; старые воркеры не ломаются при смене формата (см. versioning очередей в [DECISIONS.md](./DECISIONS.md) Часть III). |

### Согласованность

- **Порядок** между разными каналами (**Meta vs Telegram vs сайт**) **не гарантируется** — см. [DECISIONS.md](./DECISIONS.md), [ENTITIES.md](./ENTITIES.md) §0.
- Все интеграции рассматривать как **eventual consistency**: UI и отчёты после короткой задержки.

### Классификация ошибок (интеграции)

| Класс | Поведение |
| ----- | ---------- |
| **Transient** | Сеть, таймаут, **5xx**, часть **429** — retry с backoff, лимит попыток → DLQ |
| **Permanent** | **4xx** (кроме оговоренных), битая схема, невалидные данные — **не** бесконечный retry; лог + DLQ / отбой |
| **Auth** | Истёкший/отозванный токен — **reconnect / re-auth**, алерт; не забивать очередь ретраями до ротации секрета |

### Устойчивость к перегрузкам

- **Circuit breaker:** при длительной недоступности Meta/Telegram — временно снижать частоту вызовов / маркировать интеграцию «degraded», алерт команде.
- **Backpressure:** рост длины очереди → **замедлить ingestion** (polling реже, вебхук только enqueue без всплеска параллельных воркеров) до стабилизации.

### Очереди (Redis Streams / воркеры) — целевой контракт

- **Visibility / pending:** сообщение не ACK’нуто — считается «в работе»; при падении воркера — **возврат к другому consumer** (семантика consumer group / таймаут pending — по выбранной реализации).
- **Max retries:** например **5** попыток с backoff → **DLQ** ([ARCHITECTURE.md](./ARCHITECTURE.md) §6.3–6.4).
- **Poison message:** одно сообщение не должно **блокировать** всю очередь — после N неудач — DLQ + метрика/алерт, остальные сообщения обрабатываются.
- **Метрики:** длина очереди, время обработки, число retry, размер DLQ.

### Наблюдаемость (интеграции)

- **Корреляция:** **`X-Request-ID`** / **`trace_id`** на цепочке вебхук → воркер → Graph/Bot API ([API.md](./API.md) §12).
- **Логи:** структурированный JSON: `channel`, `event_type`, `integration`, `status`, `error`, `request_id` — **без секретов и тел токенов**. **[CURRENT]:** воркеры и часть сервисов пишут в стандартный лог с `msg_id` / контекстом (`worker_error_policy`); полный единый набор полей выше — **[TARGET]** (см. production JSON structlog в `observability.py`).
- **Алерты (ориентиры):** DLQ **> 0** (или выше порога), доля **delivery failed** выше порога, **polling** по воронке не обновлялся **> N минут** — **[TARGET]** до настройки дашбордов.

### Секреты

- Токены Meta/Telegram/API-key в БД — **только в зашифрованном виде** (Fernet и т.д., см. §6 сайт, §10 env).
- **Ротация:** документированный runbook: добавить новый секрет → деплой → переключить трафик → отозвать старый; без простоя при двухключевой схеме где возможно.
- **Никогда** не логировать сырое значение токена/API-key.

### SLA / SLO (ориентиры для команды)

| Метрика | Цель |
| ------- | ---- |
| Ответ вебхука (ACK + enqueue) | **&lt; 2 с** |
| Доставка сообщения пользователю (P1, после принятия в очередь) | **&lt; 30 с** при нормальной нагрузке |
| Окно retry доставки | до **24 ч** с backoff, затем DLQ |

Точные числа — в конфиге и алертах.

---

## 3. Meta (Instagram / Messenger)

### Входящие события (Webhook)

```
Маршрут: POST /webhook/meta   (БЕЗ /api префикса!)
         GET  /webhook/meta   (верификация challenge: hub.verify_token == META_MARKER в env)

Верификация подписи POST:
  Header: X-Hub-Signature-256: sha256=<HMAC-SHA256(secret, body)>
  Секрет: META_APP_SECRET из env (если META_WEBHOOK_VERIFY_SIGNATURE=true)
```

**Алгоритм обработки:**

1. Немедленно проверить подпись → `hmac.compare_digest(expected, received)`
2. Ответить `200 OK` (Meta ждёт < 20 сек, иначе ретрай)
3. Отправить payload в очередь **`queue.integrations.v1`** (целевое имя stream; в as-built может быть прежний ключ — сверять с `docs/ARCHITECTURE.md` §6)
4. Воркер: распарсить события, дедупликация по **`mid`** (идемпотентность входа) → `inbox_messages`  
   Сквозные правила вебхука (replay, ACK+enqueue, версия payload) — **§2**.

**Типы событий Meta:**

- `messages` — входящее сообщение (text, image, video, file, sticker)
- `messaging_postbacks` — кнопки
- `message_deliveries` — статус доставки
- `message_reads` — статус прочтения

**Дедупликация:**

```python
# Уникальный индекс на (channel='instagram', external_msg_id=mid)
# При INSERT: ON CONFLICT DO NOTHING
```

### Исходящие (Graph API)

```
POST https://graph.facebook.com/v18.0/me/messages
Authorization: Bearer <PAGE_ACCESS_TOKEN>
{
  "recipient": {"id": "<instagram_user_id>"},
  "message": {"text": "Текст сообщения"}
}
```

**Ретрай при ошибках Meta:**

- `4xx` (кроме 429): не ретраить — ошибка данных
- `429`: уважать `Retry-After` заголовок
- `5xx`: exponential backoff через очередь
- **Retry только** для сети / **5xx** / оговоренных **429**, не для «плохого» **4xx**

**Логирование ошибок Graph API:** при неуспешном ответе логировать **HTTP-статус**, **`request_id`/`trace_id`**, безопасный фрагмент **тела ответа** (JSON error от Meta) — для отладки; **не** логировать `access_token` и полные PII.

**Ротация `PAGE_ACCESS_TOKEN`:** long-lived page token периодически обновляется через Graph (**обмен краткоживущего на долгоживущий** по документации Meta). Runbook: хранить в секретах **два ключа** при переключении; cron/воркер **обновляет токен до истечения**; при ошибке `OAuthException` / **190** — алерт и сценарий re-auth. Детали endpoint'ов — актуальная документация Facebook Login / Page tokens.

**Исходящий rate limiting:** единый **глобальный (или per-page) limiter** на все вызовы Graph из приложения (token bucket / очередь), чтобы не словить бан за burst; учитывать лимиты Instagram Messaging.

### Переменные окружения

```
META_APP_SECRET=...           # секрет приложения для верификации подписи (X-Hub-Signature-256)
META_MARKER=...               # as-built: токен верификации GET challenge (в UI Meta часто называют Verify Token)
META_PAGE_ACCESS_TOKEN=...    # токен страницы Facebook/Instagram (ротируемый) — в коде/настройках воронки, см. meta_sender
META_WEBHOOK_VERIFY_SIGNATURE=...  # bool, по умолчанию true; при true без секрета — 503 на POST
META_WEBHOOK_LOG_BODY=...     # bool: логировать сырое тело (осторожно: PII); только отладка
```

---

## 4. Telegram Bot API (исходящие лидам)

Отправка сообщений лидам через Bot API. Токен бота — из настроек **воронки** (`funnels.sources.telegram.token`), а не глобальный.

### Отправка сообщения

```python
# services/telegram_sender.py
async def send_telegram_message(
    bot_token: str,
    chat_id: str,
    text: str,
    media_url: str | None = None,
) -> dict:
    if media_url:
        method = "sendPhoto"
        payload = {"chat_id": chat_id, "photo": media_url, "caption": text}
    else:
        method = "sendMessage"
        payload = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
    
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"https://api.telegram.org/bot{bot_token}/{method}",
            json=payload,
            timeout=10.0
        )
        resp.raise_for_status()
        return resp.json()
```

### Доставка через очередь

```python
# При создании уведомления-доставки в notification_deliveries
# Worker читает очередь queue.notifications.v1 (целевое имя) и вызывает send_telegram_message()
# При TooManyRequests (429): читаем retry_after из ответа → next_retry_at
```

**Политика retry:** повторять отправку **только** при ошибках **сети** и **5xx**; на **429** — уважать **`retry_after`** из ответа Telegram; **4xx** (кроме оговоренных) — классифицировать как **permanent** (§2).

**Дедуп исходящих при retry:** для каждой логической отправки генерировать **`client_message_id`** (UUID), хранить в задаче очереди / `notification_deliveries`; перед повторной отправкой проверять «уже доставлено» / idempotency на стороне домена, чтобы **retry не создавал дубликат** в чате лида.

---

## 5. Telegram (входящие лиды — getUpdates polling)

Опрос входящих сообщений от лидов через `getUpdates`. **На каждую воронку с включённым Telegram-источником — отдельный цикл** (отдельная задача asyncio / отдельный воркер-шард): **изоляция ошибок** — падение/зависание одного loop **не останавливает** опрос остальных воронок.

**Текущее состояние [CURRENT]:** опрос в процессе **`integrations_worker`** (`poll_all_funnels` в `app/services/telegram_leads.py`), не в `lifespan` Uvicorn.

```text
integrations_worker: _telegram_poll_loop → telegram_leads.poll_all_funnels(session, redis)
  → getUpdates по воронкам, дедуп по message_id / update_id, last_update_id в БД и offset в Redis
```

**Дедупликация:** `update_id` — уникальный ключ (см. также §2 про ключи вебхуков/polling).

**Хранение offset:** Redis (быстро) → `SETEX telegram_offset:{funnel_id} 86400 {offset}`

**Параметры `getUpdates` [TARGET]:**

- **`limit`:** не более **100** update за один вызов (или меньше — по нагрузке).
- **Backoff при ошибках API:** базовый интервал (напр. **5 с**) → **10 с → 30 с** при сериях ошибок; сброс к базовому после успешного цикла.
- **Watchdog:** если цикл не завершил успешную итерацию дольше **N секунд** (зависание сети/Telegram) — лог + **перезапуск задачи** воркера / circuit breaker для этой воронки.
- Мониторинг «**последний успешный poll** по `funnel_id`**» — для алертов (§2, §11).

---

## 6. Telegram MTProto (личный аккаунт)

Позволяет отправлять сообщения от имени личного Telegram-аккаунта сотрудника и синхронизировать переписку.

### Сессии

```sql
-- Таблица mtproto_sessions
id          UUID PK
user_id     UUID FK → users(id)   -- чей аккаунт
phone       VARCHAR(50)
session_data TEXT                  -- зашифровано! Fernet(ENCRYPTION_KEY)
status      VARCHAR(30)            -- state machine ниже
created_at  TIMESTAMPTZ
updated_at  TIMESTAMPTZ
```

### State Machine сессии

```
inactive
   ↓ [POST /api/integrations/telegram/sessions/start]
pending_code     ← ждём SMS/звонок
   ↓ [POST /api/integrations/telegram/sessions/verify-code]
pending_password ← если включена 2FA
   ↓ [POST /api/integrations/telegram/sessions/verify-password]
active
   ↓ [любая ошибка авторизации Telethon]
error → inactive
```

### Синхронизация сообщений

**Текущее [CURRENT]:** `POST …/sync-messages` отвечает **202** и ставит задачу **`telegram_personal_sync`** в **`REDIS_INTEGRATIONS_STREAM`** (по умолчанию `queue.integrations.v1`); Telethon выполняется в **`integrations_worker`**, HTTP не ждёт истории.

**Отправка текста от личного аккаунта** (`POST …/send`) по-прежнему **синхронно** в HTTP — короткий путь; при росте нагрузки можно вынести в очередь по аналогии.

```python
# Фактический тип задачи в stream: telegram_personal_sync (см. integrations_stream.JOB_TYPE_TELEGRAM_PERSONAL_SYNC)
# 1. API: XADD + 202 { deal_id, user_id, limit }
# 2. Воркер: sync_deal_messages → inbox / сделка
```

**Connection pool / лимит сессий:** ограничить число **одновременно активных** Telethon-клиентов (на пользователя / на воркер), иначе рост памяти и файловых дескрипторов. Очередь задач **per session**, не «все синки параллельно».

**Rate limiting:** лимитер на **GetHistoryRequest**, отправку сообщений и прочие вызовы к Telegram (целевые QPS — конфиг), чтобы не словить FloodWait.

**Таймауты:** любая Telethon-операция в воркере — с **жёстким timeout** (async wait_for / cancel), чтобы не блокировать воркер бесконечно.

**Восстановление сессии:** при `status=error` или потере соединения — **ограниченное число** автоматических попыток переподключения с backoff; после лимита — `inactive` + уведомление пользователю перепройти авторизацию.

### Медиа через MTProto

**Никогда не возвращать прямые MTProto-ссылки клиенту.** Медиа проксируется:

```
GET /api/telegram/media/{message_id}?session_id={uuid}
  → воркер скачивает через Telethon
  → сохраняет в объектное хранилище (S3/Minio) под стабильным ключом
  → возвращает signed URL (действителен 1 час)
```

**Кеш медиа:** после первой выгрузки объект в **S3** с ключом по **`(session_id, message_id, media_unique_id)`** (или аналог); повторные запросы — **не качать** из Telegram повторно, а отдавать уже загруженный объект (см. §9).

---

## 7. Сайт (лиды через форму)

### Приём лида

```
POST /api/integrations/site/leads
Headers:
  X-Api-Key: <api_key_из_настроек_воронки>
  Idempotency-Key: <uuid>   # опционально, рекомендуется
  Content-Type: application/json

Body:
{
  "name": "Иван Иванов",
  "phone": "+998901234567",
  "email": "ivan@example.com",
  "message": "Хочу заказать...",
  "source": "contact-form",
  "funnel_id": "uuid",
  "website": ""              // honeypot — пустое поле [TARGET]
}
```

**Валидация (сервер):** обязательные проверки **формата и длины** `phone` (нормализация E.164), `email`, `message` — **422** при ошибке. См. [ENTITIES.md](./ENTITIES.md) §5.

**Rate limit:** **по IP** ориентир **10–30/мин** ([API.md](./API.md) §6).

**Спам [TARGET]:** honeypot; при необходимости — **CAPTCHA** для публичных форм.

**Идемпотентность:** заголовок **`Idempotency-Key`** — **[TARGET]** (в коде intake пока не разбирается). **[CURRENT]:** дедуп по **нормализованным** `phone` / `email` среди **неархивных** сделок воронки с `source=site` (см. `_find_duplicate_site_lead`); окно «24 часа» из примера ниже **не** реализовано — повтор с тем же номером/email возвращает 200 с тем же `dealId` независимо от давности.

**Ответы:**

- `201 Created` — лид создан, сделка добавлена в воронку
- `200 OK` — идемпотентный повтор / дедуп
- `401 Unauthorized` — неверный API-ключ
- `429 Too Many Requests` — превышен rate limit

**Дедупликация [CURRENT] (упрощённо):** последняя активная сделка воронки с тем же нормализованным телефоном или email в `custom_fields._site` — ответ **200** с `duplicate: true`, без окна по времени.

### API-ключ: scope, хранение, ротация

- Ключ привязан к **`funnel_id`** (не глобальный доступ ко всем воронкам).
- В БД — **не plaintext:** предпочтительно **хэш** ключа (bcrypt/argon2) и проверка `verify(plaintext, digest)` при каждом запросе; альтернатива — **зашифрованный** секрет (Fernet), если продукт требует иного, но **никогда** не логировать и не возвращать ключ после первого показа.
- **Ротация:** второй ключ для той же воронки → смена на сайте → отзыв старого (перекрытие без даунтайма).

### Генерация API-ключа

```python
import secrets
plaintext = secrets.token_hex(32)
digest = hash_api_key(plaintext)  # сохранить digest + funnel_id; plaintext — один раз UI
```

---

## 8. apps/bot (внутренний бот команды)

Отдельный Python-процесс (`apps/bot/`). Взаимодействует с API через HTTP.

### Возможности

- Зеркалирование внутреннего чата: сообщения из inbox → Telegram и обратно
- Рассылки по расписанию
- Уведомления команды

### Архитектура

```
apps/bot/ → HTTP POST /api/messages → FastAPI → inbox_messages
Telegram → apps/bot webhook → HTTP POST /api/messages → FastAPI
```

**Бот не обращается напрямую к БД.** Только через API.

**Аутентификация:** **service token** / технический пользователь с **минимальными правами** (только нужные эндпоинты), **не** учётка `admin`.

**Rate limiting:** лимит исходящих сообщений в Telegram (анти-спам), конфигурируемый.

**Ошибки доставки:** повтор через **`queue.notifications.v1`** (или аналог) с backoff, не бесконечный цикл в том же процессе.

---

## 9. Объектное хранилище (медиа)

**Текущее:** медиа-файлы нигде не хранятся (только ссылки или inline в JSONB).  
**Целевое:** S3-совместимое хранилище (Minio для self-hosted).

```python
# services/storage.py
import aioboto3

async def upload_media(file_data: bytes, filename: str, mime_type: str) -> str:
    session = aioboto3.Session()
    async with session.client(
        "s3",
        endpoint_url=settings.S3_ENDPOINT,
        aws_access_key_id=settings.S3_ACCESS_KEY,
        aws_secret_access_key=settings.S3_SECRET_KEY,
    ) as s3:
        # Ключ объекта: UUID, не оригинальное имя файла (path traversal / коллизии)
        key = f"media/{uuid4()}"
        await s3.put_object(
            Bucket=settings.S3_BUCKET,
            Key=key,
            Body=file_data,
            ContentType=mime_type,
        )
        return key

async def get_signed_url(key: str, expires_in: int = 3600) -> str:
    # presigned URL, действует ограниченное время; bucket не публичный
    ...
```

**Валидация загрузок:** проверка **MIME** (allowlist) и **макс. размера** (ориентир **10 MB** для форм; для MTProto — отдельный лимит по продукту).

**Доступ:** клиент получает файл **только через signed URL** или прокси API; **не** открывать bucket в public-read.

**Lifecycle [TARGET]:** автоудаление или архивация объектов старше **90 дней**, если нет ссылки из БД / пометки использования — политика в OPERATIONS.

**Антивирус [опционально]:** ClamAV или облачный скан для вложений — при требованиях заказчика; для минимального VPS может быть отложено с явным риском в SECURITY.

---

## 10. Переменные окружения для интеграций

```bash
# Meta
META_APP_SECRET=...
META_MARKER=...                     # verify token для GET /webhook/meta (challenge)
META_WEBHOOK_VERIFY_SIGNATURE=true
# META_PAGE_ACCESS_TOKEN — в настройках продукта/воронки или отдельных сервисах отправки

# Telegram
TELEGRAM_BOT_TOKEN=...              # основной бот (исходящие)
TELEGRAM_EMPLOYEE_BOT_TOKEN=...     # бот команды (apps/bot)
TELEGRAM_ALERT_CHAT_ID=...          # чат для алертов
TELEGRAM_LEADS_POLL_INTERVAL_SECONDS=5

# Шифрование
ENCRYPTION_KEY=...                  # Fernet key: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# Хранилище
S3_ENDPOINT=http://minio:9000       # или https://s3.amazonaws.com
S3_BUCKET=tipa-media
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
```

---

## 11. Мониторинг интеграций

SQL-примеры ниже — дополняют метрики и алерты из **§2** (очереди, DLQ, polling). Структурированные логи интеграций — JSON с `channel`, `event_type`, `status`, `error`, `request_id`.

```sql
-- Метрики для дашборда интеграций
-- Количество входящих за 24ч по каналу
SELECT channel, COUNT(*) as count
FROM inbox_messages
WHERE created_at > now() - interval '24 hours' AND direction = 'in'
GROUP BY channel;

-- Ошибки доставки
SELECT channel, COUNT(*) as failed
FROM notification_deliveries
WHERE status = 'dead' AND created_at > now() - interval '7 days'
GROUP BY channel;

-- Dead Letter Queue
SELECT queue_name, COUNT(*) as count
FROM dead_letter_queue
WHERE resolved = false
GROUP BY queue_name;
```

---

## 12. Планируемые домены: почта, 1С, телефония, ЭДО, банки

Секция фиксирует **архитектурный каркас** до появления кода коннекторов. Детальная машиночитаемая структура (домены → сценарии → виды коннекторов) отдаётся API **`GET /api/integrations/roadmap`** (авторизованный пользователь); исходник списка — `app/services/integrations_roadmap_catalog.py`, схемы — `app/schemas/integrations_roadmap.py`.

### 12.1 Модель «несколько интеграций одного типа»

- **Банки:** у организации может быть **несколько** активных подключений: разные БИК, счета, договоры API. В рантайме — **массив коннекторов** с полями `kind` (например `api_open_banking` / `file_swift_mt940`), `display_label`, статус, секреты в зашифрованном виде (как в §2, §6 сайта).
- **1С:** из одной экосистемы заказчика приходят **разные потоки** (номенклатура, контрагенты, документы, обмен с банком). Каждый сценарий — **отдельный коннектор** или подписка на очередь, с общим слоем: аудит, идемпотентность по GUID 1С, корреляция `request_id`.
- **Почта:** несколько ящиков / делегирование домена — **N записей** коннектора на tenant с привязкой к пользователю или к «сервисной» учётке.
- **Телефония и ЭДО:** несколько АТС или операторов ЭДО — тот же паттерн: **реестр коннекторов**, нормализация событий во внутренние сущности (звонок, УПД).

Целевая таблица (на будущее, имена ориентировочные): `integration_connectors(id, tenant_id, domain_id, item_id, connector_kind, config_json_encrypted, status, …)` — миграции появятся при первой реализации.

### 12.2 Корпоративная почта (Google / Яндекс)

- **Google Workspace:** OAuth 2.0, при необходимости делегирование домена; основной путь — **Gmail API** + опционально push (Pub/Sub); **IMAP/SMTP** как fallback по политике безопасности заказчика.
- **Яндекс 360 / Почта для бизнеса:** OAuth и/или парольные политики, IMAP по документации Яндекса; учёт лимитов и 2FA.
- Входящие письма: валидация + **постановка в очередь** (как вебхуки в §2), тяжёлый парсинг — воркер. Исходящие — отдельный исходящий limiter и DLQ при ошибках провайдера.

### 12.3 1С — отдельный «зонтичный» раздел

Сценарии не сводятся к одному протоколу:

| Подход | Назначение |
| ------ | ---------- |
| **OData** | Чтение справочников и документов из опубликованной базы |
| **HTTP-сервисы конфигурации** | Вызов процедур по контракту конкретной конфигурации |
| **Файловый обмен** | CommerceML, EnterpriseData, произвольный XML/JSON — загрузка в объектное хранилище + воркер |
| **Клиент банка через 1С** | Связка с доменом «Банки» (§12.6) |

Прямой read-only SQL к БД 1С — только как крайняя мера и с изоляцией (см. каталог `onec_direct_db`).

### 12.4 IP-телефония

- Вход: **вебхуки АТС** → нормализация в `CallEvent` (номера, направление, длительность, запись).
- Исход: **click-to-call**, при необходимости CTI (всплытие карточки CRM).
- Адаптеры под конкретных провайдеров (Asterisk ARI/AMI, облачные АТС) не смешивают сырые payload с доменной моделью — только через слой маппинга.

### 12.5 ЭДО

- Интеграция через **API оператора** (разные контракты); в продукте — единые сущности: документ, стороны, статус подписи, отказ.
- Секреты и ключи оператора — как в §2; долгие опросы статусов — воркеры, не HTTP-запрос пользователя.

### 12.6 Банки

- **Несколько банков и типов:** выписки (API, MT940/CAMT/CSV, обмен через 1С), исходящие платежи (API, файлы клиент-банка).
- Сверка с модулями CRM/финансов — по правилам идемпотентности (хеш движения / ID из банка).

### 12.7 Код на бэкенде (заготовки)

Пакет **`app/services/integration_domains/`** зарезервирован под фасады доменов (`email_corp`, `onec`, `telephony`, `edo`, `banking`). Пока без бизнес-логики — чтобы импорты и границы модулей были согласованы с дорожной картой.

### 12.8 Чеклист PR — новая интеграция (вход или исход)

Использовать вместе с [DECISIONS.md](./DECISIONS.md) и [ARCHITECTURE.md](./ARCHITECTURE.md) §6 (очереди / вебхуки).

1. **ADR** в [DECISIONS.md](./DECISIONS.md), если новый провайдер или смена транспорта.
2. **Строка в §1** этого файла + при необходимости строка в **§1.1** (роутер, stream, воркер).
3. **Входящий вебхук / публичный intake:** валидация + **быстрый ACK**; тяжёлое — **XADD** в `queue.<домен>.vN` и воркер ([ARCHITECTURE.md](./ARCHITECTURE.md) §6).
4. **Идемпотентность:** явный ключ в коде и в документе (как в §2).
5. **Секреты:** не в логах; хранение как в §2 / [SECURITY.md](./SECURITY.md).
6. **Схемы Pydantic** в `app/schemas/`, `extra` по политике [apps/api/CLAUDE.md](../apps/api/CLAUDE.md); без `list[dict]` в роутерах.
7. **Тесты:** минимум smoke (422/401/429 где уместно) + `pytest -m "not integration"`.
8. **Очередь:** имя stream и группа в [QUEUES.md](./QUEUES.md) / config, без второго не версионированного имени для того же смысла.

