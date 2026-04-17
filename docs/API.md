# API Reference

Базовый URL: `https://chiranaasia.taska.uz/api`  
OpenAPI: `GET /openapi.json` при запущенном сервере.

---

## Статус описаний в этом документе

Часть разделов описывает **уже существующий бэкенд**, часть — **целевой контракт** до полной реализации. Чтобы не смешивать ожидания, используются маркеры:


| Маркер              | Значение                                                                                             |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| `**[IMPLEMENTED]`** | Поведение соответствует коду в `apps/api` (проверяйте актуальность по `GET /openapi.json`).          |
| `**[PARTIAL]**`     | Часть есть в коде, часть — политика, прокси или запланированное дополнение; детали в тексте раздела. |
| `**[PLANNED]**`     | Целевой контракт; без проверки реализации полагаться на него нельзя.                                 |


**Примеры привязки тем к статусу:**


| Тема                                                                | Статус          |
| ------------------------------------------------------------------- | --------------- |
| Идемпотентность `Idempotency-Key`, scope `METHOD+path+key` (SHA256 в Redis), 409 при другом теле, `Idempotent-Replayed` (§3) | `[IMPLEMENTED]` |
| Таблица лимитов slowapi + ключ user/IP (§6); `X-RateLimit-*` в основном на **429** | `[IMPLEMENTED]` |
| ETag + `Cache-Control` на справочных GET (§9), `app/core/json_http_cache.py` | `[IMPLEMENTED]` |
| CSRF `X-CSRF-Token` для мутирующих `/api/*` (исключения в middleware) | `[IMPLEMENTED]` |
| `GET /metrics` (Prometheus), защита Bearer или localhost            | `[IMPLEMENTED]` |
| `GET /api/admin/dlq/rows`, requeue/resolve DLQ                      | `[IMPLEMENTED]` |
| `POST /api/auth/login`, `/refresh`, `/logout` — тело без лишних полей (`extra=forbid`) | `[IMPLEMENTED]` |
| `POST /api/integrations/site/leads` — тело без лишних полей (`extra=forbid`) | `[IMPLEMENTED]` |
| Непрозрачный cursor (§4.2): **Fernet** + JSON внутри (`list_cursor_page`); инвентаризация эндпоинтов — §4.2 | `[IMPLEMENTED]` |
| `GET /api/admin/logs`, защита логов JWT + `admin.system` (§7)       | `[IMPLEMENTED]` |
| Дедуп вебхука Meta по `metaMid` в комментариях (§8)                 | `[IMPLEMENTED]` |
| Асинхронная очередь после ACK вебхука Meta (`POST /webhook/meta` → Redis → worker) | `[IMPLEMENTED]` |


### Совместимость и ломающие изменения

Сюда выносим то, что может сломать скрипты или сторонние клиенты, даже если основной SPA уже обновлён.


| ⚠️ Breaking            | Что изменилось                                                                                                                                                                                                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /api/system/logs` | **Теперь обязательны** JWT и право системной админки (`admin.system`). Раньше запрос мог обходиться без авторизации — так больше не должно быть. Канон: **GET /api/admin/logs** с заголовком `Authorization: Bearer <token>`. Путь `/api/system/logs` остаётся как deprecated-алиас с теми же требованиями к auth. |


---

## 0. Версионирование API

### Текущая версия: v1 (неявная)

Все эндпоинты сейчас живут под `/api/...` без явного номера версии — это v1 по умолчанию.

### Стратегия при ломающих изменениях

```
/api/deals       → v1 (текущий, живёт вечно пока есть клиенты)
/api/v2/deals    → v2 (новый контракт)
```

**Ломающее изменение** — это:

- Удаление поля из ответа
- Переименование поля
- Изменение типа поля
- Изменение семантики статуса/enum
- Удаление эндпоинта

**Не ломающее** (можно без новой версии):

- Добавление нового поля в ответ
- Добавление нового опционального параметра запроса
- Добавление нового эндпоинта
- Изменение лимитов (rate limit, pagination max)

### Deprecation policy

```http
# Ответ от устаревшего эндпоинта
HTTP/1.1 200 OK
Deprecation: true
Sunset: Sat, 01 Jan 2027 00:00:00 GMT
Link: </api/v2/deals>; rel="successor-version"
```

Устаревший эндпоинт живёт минимум **3 месяца** после анонса.  
В этот период логируем клиентов, которые его вызывают, — для коммуникации.

### Строковые enum-поля (статусы, типы)

- **Можно:** добавлять **новые** допустимые значения; клиенты должны терпимо относиться к неизвестным строкам (fallback).
- **Нельзя** без мажорной версии API и миграции клиентов: **удалять** или **переименовывать** уже опубликованные значения, менять их **семантику** (одно и то же значение начинает значить другое).

### Версия в заголовке (альтернатива, если нужна)

```http
# Клиент явно запрашивает версию (опционально)
GET /api/deals
API-Version: 2026-04-11   # date-based versioning
```

Для внутреннего продукта с одним фронтом — URL-версионирование (`/v2/`) проще и понятнее.

---

## 1. Авторизация

### Схема

Все защищённые эндпоинты требуют валидный JWT в **HttpOnly cookie** `access_token`.  
Для мутирующих запросов (POST/PUT/PATCH/DELETE) обязателен заголовок `X-CSRF-Token`. Исключения (без CSRF): `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout` — см. `CSRFMiddleware` в коде.

```http
Cookie: access_token=<jwt>; csrf_token=<random>
X-CSRF-Token: <значение csrf_token cookie>
X-Request-ID: <uuid>          # клиент может прислать; если нет — сервер обязан сгенерировать (§12)
Idempotency-Key: <uuid>       # опционально, для POST-запросов
```

### Получение токена

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secret"
}
```

Ответ: устанавливает cookies `access_token`, `refresh_token`, `csrf_token`.

### Обновление токена

```http
POST /api/auth/refresh
```

Ответ: обновляет `access_token` cookie. `refresh_token` cookie отправляется автоматически браузером.

### Выход

```http
POST /api/auth/logout
```

Очищает все auth-cookies.

---

## 2. Формат ответов

### Успешный ответ (список)

```json
{
  "items": [...],
  "total": 142,
  "limit": 50,
  "offset": 0
}
```

### Успешный ответ (объект)

```json
{
  "id": "uuid",
  "title": "...",
  ...
}
```

### Ошибка

```json
{
  "error": "validation_error",
  "message": "Поле title не может быть пустым",
  "details": { "field": "title", "input": "" },
  "request_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

Обработка в приложении: `HTTPException`, ошибки валидации FastAPI/Pydantic и `429` от slowapi приводятся к этому виду (`app.main`, `app.core.api_errors`). В `GET /openapi.json` поле `info.description` дублирует кратко CSRF, rate limit и ссылку на этот документ.

### Строгие JSON-тела (`extra="forbid"`) `[IMPLEMENTED]`

На публичных и партнёрских входах, где важно отсечь опечатки в полях, тело запроса валидируется схемами Pydantic с `model_config = ConfigDict(extra="forbid")` — лишнее поле → **422**.


| Маршрут | Схема / примечание |
| ------- | ------------------ |
| `POST /api/auth/login` | `LoginRequest` |
| `POST /api/auth/refresh` | `RefreshRequest` (пустое `{}` допустимо через default factory) |
| `POST /api/auth/logout` | `LogoutRequest` |
| `POST /api/integrations/site/leads` | `SiteLeadPayload` / `SiteLeadUtm` |
| Прочие интеграционные тела в `app/schemas/integrations.py` с `extra="forbid"` | см. OpenAPI по конкретному пути |

Остальные маршруты могут использовать `extra="ignore"` ради обратной совместимости со SPA; новые внешние контракты — по политике **ARCHITECTURE** и [apps/api/CLAUDE.md](../apps/api/CLAUDE.md) (`extra=forbid`, явные схемы).

### HTTP-статусы


| Код | Когда                                                 |
| --- | ----------------------------------------------------- |
| 200 | Успех                                                 |
| 201 | Создано                                               |
| 204 | Удалено (без тела)                                    |
| 400 | Неверный запрос                                       |
| 401 | Не авторизован                                        |
| 403 | Нет прав                                              |
| 404 | Не найдено                                            |
| 409 | Конфликт (дубликат)                                   |
| 422 | Ошибка валидации Pydantic                             |
| 429 | Rate limit                                            |
| 500 | Внутренняя ошибка (подробности в логах по request_id) |


---

## 3. Идемпотентность `[IMPLEMENTED]`

Для создающих операций (POST) клиент может передать ключ идемпотентности:

```http
POST /api/deals
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
```

**Поведение:**

- Первый запрос с ключом — выполнить + сохранить **хэш тела запроса** и **сериализованный ответ** в Redis (TTL 24 ч).
- Повтор с тем же ключом и **тем же телом** (тот же хэш) — вернуть сохранённый ответ без повторного выполнения; заголовки `Idempotent-Replayed: true` и `X-Idempotent-Replayed: true` (дубликат для совместимости).
- Повтор с тем же ключом, но **другим телом** — `409 Conflict`, тело ошибки с идентификатором `idempotency_conflict`. Это защита от багов клиента (повтор с другим payload), а не «тихий» replay чужого результата.

```json
{
  "error": "idempotency_conflict",
  "message": "Idempotency-Key уже использован с другим телом запроса",
  "request_id": "..."
}
```

**Область хранения (scope) в Redis:** один и тот же `Idempotency-Key` на **разных** путях не делит запись. В реализации — SHA-256 от строки `METHOD:normalized_path:Idempotency-Key`, ключ Redis вида `taska:idemp:http:<hex>` (см. `IdempotencyMiddleware`).

- `normalized_path` — путь **без query string**, без завершающего `/` (кроме корня `/`). Сейчас используется **конкретный** путь запроса (например `/api/deals/550e…`), а не шаблон OpenAPI.

**Где поддерживается:** все **POST** под `/api/*` при наличии заголовка и Redis (`IDEMPOTENCY_ENABLED`). Точечные исключения не заданы — при необходимости добавить в middleware.

---

## 4. Пагинация

### 4.1 Offset-пагинация (стандартная)

Многие LIST-эндпоинты поддерживают классический offset (см. OpenAPI). Часть списков вместо этого использует **cursor** (§4.2).

```http
GET /api/<resource>?limit=50&offset=0
```


| Параметр | Тип | По умолчанию | Максимум |
| -------- | --- | ------------ | -------- |
| `limit`  | int | 50           | 500      |
| `offset` | int | 0            | —        |


**Ответ:**

```json
{ "items": [...], "total": 142, "limit": 50, "offset": 0 }
```

### 4.2 Cursor-пагинация (keyset) `[IMPLEMENTED]`

**Контракт для клиента:** query-параметр `cursor` и поле ответа `next_cursor` (или `null`, если страниц больше нет) — **opaque**; клиент не парсит строку и передаёт её обратно как есть.

**На сервере** (`app/services/list_cursor_page.py`): JSON-пейлоад (ресурс, отпечаток фильтров, части сортировки, значения keyset) сериализуется и шифруется **Fernet**; наружу — ASCII-токен. Для отладки нужен ключ Fernet приложения; вариант «Base64URL от ISO\|id» из старых черновиков **не используется**.

**Зачем cursor, если есть offset?**

Offset-пагинация имеет два скрытых недостатка:

1. **Дубли при вставке.** Пользователь открыл диалог, получил 50 сообщений (offset=0). Пока читал — пришло 3 новых. При прокрутке запрос offset=50 — он получит 3 сообщения повторно, потому что они сдвинули всё.
2. **Медленный OFFSET в PostgreSQL.** `SELECT ... OFFSET 5000 LIMIT 50` — база сканирует 5050 строк чтобы вернуть 50. При 100K сообщений в переписке — это заметно.

Cursor-пагинация решает оба: вместо «дай строки с 5000 по 5050» говорим «дай строки *после* этой конкретной точки».

```http
# Первый запрос (без курсора)
GET /api/messages/deal/uuid?limit=50
→ { "items": [...], "next_cursor": "<opaque>" }

# Следующая страница
GET /api/messages/deal/uuid?limit=50&cursor=<opaque>
→ { "items": [...], "next_cursor": "..." }  # null если страниц больше нет
```

**Эндпоинты с Fernet-cursor в коде:**


| Путь | Примечание |
| ---- | ---------- |
| `GET /api/messages/deal/{deal_id}` | Лента сообщений |
| `GET /api/tasks` | Keyset + фильтры |
| `GET /api/deals` | Keyset + фильтры |
| `GET /api/clients` | Keyset + фильтры |
| `GET /api/employees` | Keyset + фильтры |
| `GET /api/finance/requests` | Keyset + фильтры |

Неверный или чужой курсор → **400** (`invalid_cursor` или эквивалент в теле ошибки §2).

**Стабильность:** `ORDER BY` на эндпоинте фиксирован и согласован с полями в токене; смена фильтров или `sort`/`order` инвалидирует старый `cursor` (отпечаток в пейлоаде).

**Когда cursor, когда нет:**


| Endpoint | Тип | Примечание |
| -------- | --- | ---------- |
| Таблица выше | Cursor (Fernet) | `next_cursor` в ответе |
| `GET /api/notifications` | `limit` | В коде нет `next_cursor` |
| `GET /api/activity` | Полный список | Без cursor |
| Прочие списки | См. OpenAPI | Offset или иной контракт |


---

## 5. Сортировка

Эндпоинты из таблицы ниже принимают query-параметры `sort` и `order` (если не указано иное). Неизвестное значение `sort` → **422** с перечислением допустимых полей.

```http
GET /api/tasks?sort=created_at&order=desc
GET /api/deals?sort=amount&order=asc
GET /api/clients?sort=name&order=asc
```


| Параметр | Значения             | По умолчанию |
| -------- | -------------------- | ------------ |
| `sort`   | Зависит от эндпоинта | см. таблицу ниже |
| `order`  | `asc` или `desc`     | `/tasks`, `/deals` — `desc`; `/clients`, `/employees` — `asc` |


**Допустимые поля сортировки по эндпоинту:**


| Эндпоинт            | Поля                                                                  |
| ------------------- | --------------------------------------------------------------------- |
| `/tasks`            | `created_at`, `updated_at`, `due_date`, `priority`, `status`, `title` (`updated_at` в БД совпадает с `created_at`, отдельного столбца нет) |
| `/deals`            | `created_at`, `updated_at`, `amount`, `stage`, `title`                |
| `/clients`          | `name`, `company_name`, `id`, `created_at`                            |
| `/finance/requests` | Параметров `sort` / `order` **нет**; порядок фиксирован: `created_at DESC`, `id DESC` (`list_finance_requests`) |
| `/employees`        | `fullName`, `hireDate`, `departmentId`, `status`, `id` (в query — camelCase, как у `departmentId`) |


**Многоуровневая сортировка** (только там, где перечислено через запятую):

```http
GET /api/tasks?sort=priority,created_at&order=desc,asc
# сначала по priority desc, потом по created_at asc
```

Для `/deals` — так же, через запятую. Для `/clients` и `/employees` — одно поле в `sort`.

---

## 6. Rate Limiting `[IMPLEMENTED]`

В приложении — **slowapi** (`headers_enabled=True`): при **429** отдаются `Retry-After` и `X-RateLimit-*` (через `_inject_headers` обработчика лимита). На **успешных** ответах (200 и т.д.) эти заголовки **обычно отсутствуют** — клиент ориентируется на таблицу лимитов и обрабатывает 429.

**Ключ учёта в приложении (реализовано):** см. `app/core/rate_limit.py` — для `POST` `/api/auth/login`, `/refresh`, `/logout` и `/api/integrations/site/leads` ключ = **IP**; при валидном JWT cookie на остальных маршрутах — **`sub`** (id пользователя); иначе снова IP. Лимит по умолчанию для маршрутов без своего `@limiter.limit` — **300/мин** (`Limiter.default_limits`); точечные исключения — в таблице и в коде.


| Эндпоинт                            | Лимит                    |
| ----------------------------------- | ------------------------ |
| `POST /api/auth/login`              | 5 / мин / IP             |
| `POST /api/auth/refresh`            | 10 / мин / IP            |
| `POST /api/integrations/site/leads` | 30 / мин / IP            |
| `GET /api/calendar/feed/{token}.ics` | 45 / мин / IP         |
| Все остальные                       | 300 / мин / пользователь |


При превышении: `HTTP 429` + заголовок `Retry-After: <секунды>`.

**Ключ учёта (rate limit key):**

- **Авторизованный запрос** (валидный JWT): ключ = **`user_id`** из токена (например `sub`). Лимит привязан к пользователю, а не к IP офиса.
- **Неавторизованный запрос:** ключ = **IP клиента** (из доверенного `X-Forwarded-For`, выставляемого nginx; не доверять сырому заголовку от клиента).
- Маршруты **login / refresh / site leads** в таблице выше считаются **по IP** по умолчанию.

**Заголовки ответа (когда rate limiting включён на балансере или в приложении):**

Клиент может использовать их для backoff без парсинга тела ответа:

```http
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 42
X-RateLimit-Reset: 1712837460
```


| Заголовок               | Смысл                                                                                                                                   |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `X-RateLimit-Limit`     | Лимит запросов в окне для ключа §6 (`user_id` или IP по правилам выше; опционально отдельный лимит на маршрут).                         |
| `X-RateLimit-Remaining` | Сколько запросов осталось в текущем окне.                                                                                               |
| `X-RateLimit-Reset`     | Unix-время (секунды), когда счётчик окна сбросится; либо согласованная с реализацией семантика (зафиксировать в OpenAPI при внедрении). |


*Итог:* политика лимитов и ключей учёта соответствует таблице; заголовки rate limit — **на ответе 429** (и в теле — формат ошибки §2). При необходимости «всегда видеть остаток» — прокси (nginx) или расширение middleware вне текущего объёма.

---

### Optimistic locking (версия сущности)

Для **Task**, **Client**, **Deal** и заявок **FinanceRequest** в ответах API есть поле **`version`** (целое, ≥ 1). При **PATCH** можно передать ожидаемую версию так:

- заголовком **`If-Match`** (номер версии, опционально в кавычках);
- полем **`version`** в JSON-теле.

Если версию **не** передать, проверка optimistic lock **не выполняется** (обратная совместимость).

При конфликте: **`409 Conflict`**, в `detail` обычно `code: stale_version` и `message`; при гонке на commit возможен тот же код без `current_version`. Клиенту следует перечитать сущность и повторить запрос.

---

## 7. Эндпоинты

### Auth — `/api/auth`


| Метод  | Путь          | Описание                 | Auth   |
| ------ | ------------- | ------------------------ | ------ |
| POST   | `/login`      | Логин, установка cookies | ❌      |
| POST   | `/logout`     | Выход, очистка cookies   | ✅      |
| POST   | `/refresh`    | Обновление access token  | cookie |
| GET    | `/me`         | Текущий пользователь     | ✅      |
| GET    | `/users`      | Список пользователей     | admin  |
| POST   | `/users`      | Создать пользователя     | admin  |
| PUT    | `/users/{id}` | Обновить пользователя    | admin  |
| DELETE | `/users/{id}` | Удалить пользователя     | admin  |


---

### Tasks — `/api/tasks`


| Метод  | Путь                      | Описание             | Права          |
| ------ | ------------------------- | -------------------- | -------------- |
| GET    | `/`                       | Список задач         | `tasks.view`   |
| POST   | `/`                       | Создать задачу       | `tasks.create` |
| GET    | `/{id}`                   | Задача по ID         | `tasks.view`   |
| PATCH  | `/{id}`                   | Обновить задачу      | `tasks.edit`   |
| DELETE | `/{id}`                   | Удалить задачу       | `tasks.delete` |
| PUT    | `/batch`                  | Пакетное обновление  | `tasks.edit`   |
| GET    | `/{id}/comments`          | Комментарии          | `tasks.view`   |
| POST   | `/{id}/comments`          | Добавить комментарий | `tasks.edit`   |
| DELETE | `/{id}/comments/{cid}`    | Удалить комментарий  | `tasks.edit`   |
| POST   | `/{id}/attachments`       | Прикрепить файл      | `tasks.edit`   |
| DELETE | `/{id}/attachments/{aid}` | Удалить вложение     | `tasks.edit`   |


**GET /api/tasks — параметры фильтрации:**


| Параметр      | Тип    | Описание                  |
| ------------- | ------ | ------------------------- |
| `table_id`    | UUID   | Фильтр по таблице         |
| `status`      | string | `todo                     |
| `priority`    | string | `low                      |
| `assignee_id` | UUID   | Фильтр по исполнителю     |
| `is_archived` | bool   | По умолчанию false        |
| `due_before`  | date   | Срок до даты (YYYY-MM-DD) |
| `due_after`   | date   | Срок после даты           |
| `search`      | string | Full-text по title        |


**Схемы:**

```typescript
// TaskCreate
{
  title: string;           // required, 1-500 chars
  table_id: string;        // UUID, required
  description?: string;
  status?: TaskStatus;     // default: 'todo'
  priority?: TaskPriority;
  assignee_id?: string;    // UUID
  due_date?: string;       // YYYY-MM-DD
  tags?: string[];
}

// TaskUpdate (PATCH — все поля опциональны)
{
  version?: number;        // ожидаемая версия (альтернатива If-Match)
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignee_id?: string | null;
  due_date?: string | null;
  tags?: string[];
  position?: number;
}

// TaskRead (ответ)
{
  id: string;
  version: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority | null;
  table_id: string;
  assignee: UserShort | null;
  created_by: UserShort | null;
  due_date: string | null;
  tags: string[];
  comments_count: number;
  attachments_count: number;
  created_at: string;  // ISO 8601
  updated_at: string | null;
}
```

---

### Deals — `/api/deals`


| Метод  | Путь            | Описание          | Права              |
| ------ | --------------- | ----------------- | ------------------ |
| GET    | `/`             | Список сделок     | `crm.view`         |
| POST   | `/`             | Создать сделку    | `crm.deals.create` |
| GET    | `/{id}`         | Сделка по ID      | `crm.view`         |
| PATCH  | `/{id}`         | Обновить сделку   | `crm.deals.edit`   |
| DELETE | `/{id}`         | Удалить сделку    | `crm.deals.delete` |
| POST   | `/{id}/stage`   | Сменить стадию    | `crm.deals.edit`   |
| GET    | `/{id}/history` | История изменений | `crm.view`         |


**GET /api/deals — параметры:**


| Параметр      | Описание              |
| ------------- | --------------------- |
| `funnel_id`   | Фильтр по воронке     |
| `stage`       | Фильтр по стадии      |
| `assignee_id` | Фильтр по менеджеру   |
| `client_id`   | Фильтр по клиенту     |
| `source`      | `telegram             |
| `is_archived` | По умолчанию false    |
| `search`      | По title, client name |


---

### Clients — `/api/clients`


| Метод  | Путь             | Описание         | Права                |
| ------ | ---------------- | ---------------- | -------------------- |
| GET    | `/`              | Список клиентов  | `crm.clients.view`   |
| POST   | `/`              | Создать клиента  | `crm.clients.edit`   |
| GET    | `/{id}`          | Клиент по ID     | `crm.clients.view`   |
| PATCH  | `/{id}`          | Обновить         | `crm.clients.edit`   |
| DELETE | `/{id}`          | Удалить          | `crm.clients.delete` |
| GET    | `/{id}/deals`    | Сделки клиента   | `crm.view`           |
| GET    | `/{id}/messages` | История диалогов | `crm.chats`          |


---

### Messages (диалоги) — `/api/messages`


| Метод | Путь                   | Описание                              | Права       |
| ----- | ---------------------- | ------------------------------------- | ----------- |
| GET   | `/`                    | Список диалогов (последнее сообщение) | `crm.chats` |
| GET   | `/deal/{deal_id}`      | История переписки по сделке           | `crm.chats` |
| POST  | `/send`                | Отправить сообщение                   | `crm.chats` |
| POST  | `/deal/{deal_id}/read` | Пометить прочитанными                 | `crm.chats` |


**POST /api/messages/send:**

```json
{
  "deal_id": "uuid",
  "body": "Текст сообщения",
  "channel": "telegram",
  "media_url": null
}
```

---

### Notifications — `/api/notifications`


| Метод | Путь            | Описание                          |
| ----- | --------------- | --------------------------------- |
| GET   | `/`             | Список уведомлений (с пагинацией) |
| GET   | `/unread-count` | Количество непрочитанных          |
| POST  | `/{id}/read`    | Отметить прочитанным              |
| POST  | `/read-all`     | Отметить все прочитанными         |
| GET   | `/ws/{user_id}` | WebSocket (upgrade)               |
| GET   | `/prefs`        | Настройки каналов                 |
| PUT   | `/prefs`        | Обновить настройки                |


---

### Finance — `/api/finance`


| Метод | Путь                     | Описание            | Права             |
| ----- | ------------------------ | ------------------- | ----------------- |
| GET   | `/requests`              | Заявки на оплату    | `finance.view`    |
| POST  | `/requests`              | Создать заявку      | `finance.create`  |
| PATCH | `/requests/{id}`         | Обновить            | `finance.create`  |
| POST  | `/requests/{id}/approve` | Согласовать         | `finance.approve` |
| POST  | `/requests/{id}/reject`  | Отклонить           | `finance.approve` |
| POST  | `/requests/{id}/pay`     | Отметить оплаченным | `finance.approve` |
| GET   | `/receivable`            | Дебиторка           | `finance.view`    |
| POST  | `/receivable`            | Добавить запись     | `finance.create`  |
| GET   | `/bdr/{year}`            | БДР по году         | `finance.view`    |
| PUT   | `/bdr/{year}`            | Обновить БДР        | `finance.approve` |
| GET   | `/statements`            | Банковские выписки  | `finance.view`    |
| POST  | `/statements`            | Загрузить выписку   | `finance.create`  |


---

### HR — `/api/employees`, `/api/departments`


| Метод | Путь              | Описание           | Права                |
| ----- | ----------------- | ------------------ | -------------------- |
| GET   | `/employees`      | Список сотрудников | `org.employees.view` |
| POST  | `/employees`      | Добавить           | `org.employees.edit` |
| PATCH | `/employees/{id}` | Обновить           | `org.employees.edit` |
| GET   | `/departments`    | Оргструктура       | `org.employees.view` |
| POST  | `/departments`    | Создать отдел      | `org.employees.edit` |


### BPM — `/api/bpm`


| Метод | Путь                      | Описание                  | Права          |
| ----- | ------------------------- | ------------------------- | -------------- |
| GET   | `/processes`              | Список бизнес-процессов   | `org.bpm.view` |
| POST  | `/processes`              | Создать                   | `org.bpm.edit` |
| PATCH | `/processes/{id}`         | Обновить                  | `org.bpm.edit` |
| POST  | `/processes/{id}/start`   | Запустить экземпляр       | `org.bpm.edit` |
| GET   | `/instances`              | Активные экземпляры       | `org.bpm.view` |
| POST  | `/instances/{id}/advance` | Перейти к следующему шагу | `org.bpm.edit` |


---

### Spaces & Tables — `/api/projects`, `/api/tables`


| Метод | Путь                  | Описание                          |
| ----- | --------------------- | --------------------------------- |
| GET   | `/projects`           | Список проектов                   |
| POST  | `/projects`           | Создать проект                    |
| GET   | `/tables`             | Таблицы проекта (`?project_id=`)  |
| POST  | `/tables`             | Создать таблицу                   |
| PATCH | `/tables/{id}`        | Обновить                          |
| GET   | `/tables/{id}/public` | Публичный контент-план (без auth) |


---

### Docs — `/api/docs`, `/api/folders`


| Метод  | Путь         | Описание                            |
| ------ | ------------ | ----------------------------------- |
| GET    | `/folders`   | Дерево папок                        |
| POST   | `/folders`   | Создать папку                       |
| GET    | `/docs`      | Документы (`?folder_id=`)           |
| POST   | `/docs`      | Создать документ                    |
| GET    | `/docs/{id}` | Документ                            |
| PATCH  | `/docs/{id}` | Обновить (content — sanitized HTML) |
| DELETE | `/docs/{id}` | Удалить                             |


---

### Integrations


| Метод    | Путь                                        | Описание                           | Auth      |
| -------- | ------------------------------------------- | ---------------------------------- | --------- |
| GET/POST | `/webhook/meta`                             | Meta вебхук (без `/api` префикса!) | подпись   |
| POST     | `/api/integrations/site/leads`              | Лид с сайта                        | X-Api-Key |
| GET      | `/api/integrations/meta/accounts`           | Связанные Meta аккаунты            | JWT       |
| POST     | `/api/integrations/telegram/send`           | Отправить в Telegram               | JWT       |
| GET      | `/api/integrations/telegram/sessions`       | MTProto сессии                     | admin     |
| POST     | `/api/integrations/telegram/sessions/start` | Начать авторизацию MTProto         | admin     |


---

### System / Admin `[IMPLEMENTED]`

Сводка ниже — по текущему FastAPI; расхождения с другими таблицами этого файла разрешать в пользу OpenAPI.


| Метод | Путь                                | Описание                             | Auth                   |
| ----- | ----------------------------------- | ------------------------------------ | ---------------------- |
| GET   | `/health`                           | **Публичный** liveness: процесс + ping PostgreSQL; тело только `{"status":"ok"}` или при сбое БД **503** `{"status":"unavailable"}` (без версии, без текста ошибок). Redis здесь не проверяется. | ❌ |
| GET   | `/api/system/health`                | Публичный лёгкий ping JSON `{"status":"ok","version":"1.0"}` (без проверки БД; за прокси `/api/`) | ❌                      |
| GET   | `/api/admin/health`                 | Расширенное здоровье (`version`, `db`, `db_error`) | admin (`admin.system`) |
| GET   | `/api/admin/logs`                   | Системные логи (канон)               | admin (`admin.system`) |
| GET   | `/api/system/logs`                  | То же (legacy, deprecated в OpenAPI) | admin                  |
| GET   | `/api/admin/users`                  | Управление пользователями            | admin                  |
| POST  | `/api/admin/users/{id}/permissions` | Обновить права                       | admin                  |


Все административные read/write под `**/api/admin/***`; `**/api/system/logs**` оставлен для обратной совместимости.

---

## 8. Вебхуки без префикса /api `[PARTIAL]`

Маршруты, подпись и **приём в очередь** — `[IMPLEMENTED]`: `POST /webhook/meta` после проверки подписи кладёт сырое тело в Redis и отвечает `200` быстро; разбор — `integrations_worker`. Дедуп по `metaMid` — `[IMPLEMENTED]`. Остаётся `[PARTIAL]` по политике replay/окна свежести и единообразию с другими вебхуками.

```
GET /webhook/meta?hub.mode=subscribe&hub.challenge=...&hub.verify_token=...
  → Верификация: вернуть hub.challenge если verify_token совпадает

POST /webhook/meta
  Headers: X-Hub-Signature-256: sha256=<hmac>
  Body: {...Meta event payload...}
  → Немедленно ответить 200 OK (тело можно минимальным JSON)
```

### Безопасность вебхука (подпись и replay)

- **`X-Hub-Signature-256` (или актуальный заголовок Meta):** обязательная проверка HMAC по сырому телу и `app_secret`; без совпадения — `403` / отбой.
- **Одной подписи мало для защиты от replay:** злоумышленник может повторно отправить тот же валидный запрос. Дополнительно:
  - **Идемпотентность по id события** (например `mid`, id доставки) — уже в доменной модели;
  - **Окно свежести:** если в payload или заголовках есть время события — отклонять записи старше **N минут** (с поправкой на clock skew); если явного времени нет — полагаться на дедуп по устойчивому ключу + короткий TTL кэша «уже обработанных» тел запросов (осторожно с объёмом).

Точные поля для Meta — сверять с актуальной документацией Graph / Instagram Messaging; в контракте API закрепляем **принцип**, а не единственный заголовок.

### Политика ретраев (Meta и аналоги)

Провайдер может **повторно отправить** тот же вебхук при таймаутах или `5xx`. Контракт бэкенда:

1. `**[IMPLEMENTED]` Идемпотентность по событию сообщения:** для Instagram Direct в комментариях сделки дубликаты по идентификатору сообщения Meta (`mid`) не создают второй комментарий — см. поле `metaMid` у комментария и проверку в обработчике вебхука.
2. `**[IMPLEMENTED]` Быстрый ACK + очередь:** тело в Redis stream интеграций, обработка в воркере (см. `meta_webhook.py`, `push_meta_webhook_from_api`).
3. **Повтор с тем же телом** безопасен: либо no-op, либо идемпотентное обновление.

Для других входящих вебхуков (Telegram secret path и т.д.) — аналогично: внешний **уникальный id события** + запись о факте обработки, если нельзя вывести идемпотентность из доменной модели.

---

## 9. ETag и кэширование `[IMPLEMENTED]`

ETag нужен для данных, которые редко меняются и часто запрашиваются.  
Не применять к feeds, спискам задач/сделок — там данные слишком динамичны.

Реализация: `app/core/json_http_cache.py` (`json_body_etag`, `json_304_or_response`) — MD5 от канонического JSON (`sort_keys=True`), ответ **304** при совпадении `If-None-Match` с вычисленным ETag (поддерживаются слабые ETag и кавычки в заголовке).

### Где имеет смысл

```http
# Запрос
GET /api/auth/users
If-None-Match: "abc123def456"

# Ответ — данные не изменились
HTTP/1.1 304 Not Modified
ETag: "abc123def456"

# Ответ — данные изменились
HTTP/1.1 200 OK
ETag: "xyz789new000"
Cache-Control: private, max-age=60
```

**Эндпоинты с ETag:**


| Эндпоинт               | TTL      | Инвалидация                         |
| ---------------------- | -------- | ----------------------------------- |
| `GET /api/auth/users`  | 60 сек   | При создании/изменении пользователя |
| `GET /api/funnels`     | 300 сек  | При изменении воронки               |
| `GET /api/statuses`    | 3600 сек | При изменении справочника           |
| `GET /api/priorities`  | 3600 сек | При изменении справочника           |
| `GET /api/departments` | 300 сек  | При изменении оргструктуры          |


**Реализация:** списки для ETag выбираются с **стабильным `ORDER BY id`**, затем `return json_304_or_response(request, data=..., max_age=...)` (см. `GET /api/auth/users`, `/api/funnels`, `/api/statuses`, `/api/priorities`, `/api/departments`).

---

## 10. Bulk-операции

### Существующие

```http
PUT /api/tasks/batch
Body: [{"id": "uuid", "status": "done"}, {"id": "uuid2", "assignee_id": "uuid3"}]
→ Обновить несколько задач за один запрос
```

### Планируемые

```http
# Bulk delete
DELETE /api/tasks/batch
Body: { "ids": ["uuid1", "uuid2", "uuid3"] }
→ 204 No Content
→ Только архивация (is_archived=true), не физическое удаление

# Bulk assign
PATCH /api/tasks/batch/assign
Body: { "ids": ["uuid1", "uuid2"], "assignee_id": "user-uuid" }
→ 200 { "updated": 2 }

# Bulk stage change (deals)
PATCH /api/deals/batch/stage
Body: { "ids": ["uuid1", "uuid2"], "stage": "negotiation" }
→ 200 { "updated": 2, "skipped": 0 }
# skipped — сделки где переход недопустим (won/lost)
```

**Правила bulk-операций (единая модель — без гибрида):**

- Максимум **100** id за один запрос (защита от DoS).
- **Частичный успех разрешён (partial success):** одной глобальной транзакции «всё или ничего» на весь bulk **нет**. Каждая строка обрабатывается независимо (или малыми под-транзакциями); в ответе явно указываются `updated`, `failed[]`, при необходимости `skipped` (как в примере PATCH стадий сделок).
- Ответ при смешанном исходе: **`200 OK`** с телом вида `{"updated": N, "failed": [{"id": "...", "reason": "..."}], "skipped": M}` — клиент обязан разбирать массив `failed`, а не считать весь запрос ошибкой.
- **Строгая атомарность «всё или ничто»** — только для отдельных, явно помеченных в OpenAPI эндпоинтов (если появятся); не смешивать с описанным выше публичным bulk по умолчанию.
- Права проверяются **для каждой** сущности (нельзя обновить чужое через bulk).

---

## 11. WebSocket контракт

**URL:** `wss://chiranaasia.taska.uz/api/notifications/ws/{user_id}`

### Подключение

```javascript
const ws = new WebSocket(`wss://chiranaasia.taska.uz/api/notifications/ws/${userId}`);
// Авторизация через cookie (access_token) — браузер шлёт автоматически при handshake
```

**Гарантия доставки:** WebSocket — **best-effort**. Сообщение может не дойти при обрыве, перезапуске API или до открытия сокета. Полный список уведомлений и статус «прочитано» — из **БД** и **`GET /api/notifications`** (и связанных REST-эндпоинтов), а не из WS.

### Истечение токена и refresh (edge cases)

- Пока WS открыт, **cookie с access token может истечь**; в другой вкладке мог выполниться **refresh** — долгоживущее соединение не обновляет токен само.
- **Сервер:** при невозможности доверять сессии (истёкший JWT при проверке, отозванный токен) — **закрыть** WebSocket с кодом **`1008`** (policy violation) или кастомным **`4401`** (диапазон 4000–4999, private use) и понятным `reason` (например `unauthorized`).
- **Клиент:** при **401** на параллельных REST-запросах или при `onclose` с указанным `reason` / кодом «не авторизован» — выполнить **обновление сессии** (`POST /api/auth/refresh` или повторный логин), затем **открыть новое** WS-соединение. Не полагаться на то, что старое соединение «доживёт» до конца дня.

### Сообщения от сервера (server → client)

Все сообщения — JSON объекты с полем `type`:

```typescript
// Тип для всех WS-сообщений
type WSMessage =
  | NotificationCreated
  | NotificationRead
  | PingMessage

interface NotificationCreated {
  type: 'notification.created';
  data: {
    id: string;
    title: string;
    body: string | null;
    entity_type: string | null;   // 'deal' | 'task' | 'message' | ...
    entity_id: string | null;
    created_at: string;           // ISO 8601
  };
  unread_count: number;           // новый счётчик непрочитанных
}

interface NotificationRead {
  type: 'notification.read';
  data: {
    id: string | null;            // null = все прочитаны
  };
  unread_count: number;
}

interface PingMessage {
  type: 'ping';
  timestamp: string;
}
```

### Сообщения от клиента (client → server)

```typescript
// Pong в ответ на ping (keepalive)
{ "type": "pong" }
```

### Переподключение (клиент)

```typescript
const connect = (retryCount = 0) => {
  const ws = new WebSocket(url);

  ws.onclose = () => {
    // Exponential backoff: 1s, 2s, 4s, 8s... max 30s
    const delay = Math.min(1000 * Math.pow(2, retryCount), 30_000);
    setTimeout(() => connect(retryCount + 1), delay);
  };

  ws.onopen = () => {
    retryCount = 0; // сбросить счётчик при успешном коннекте
  };
};
```

### Поведение при разных сценариях


| Сценарий              | Поведение                                                                          |
| --------------------- | ---------------------------------------------------------------------------------- |
| Пользователь офлайн   | Уведомления копятся в `notifications` таблице, придут при `/api/notifications` GET |
| nginx перезапуск      | WS закрывается, клиент переподключается                                            |
| API перезапуск        | Аналогично                                                                         |
| Множественные вкладки | Каждая вкладка — отдельное WS-соединение, каждая получает push                     |
| N инстансов API       | Redis Pub/Sub шина (см. ARCHITECTURE.md §5)                                        |


---

## 12. Трассировка и аудит в API

### Заголовки запроса (клиент → сервер)

```http
X-Request-ID: 550e8400-e29b-41d4-a716-446655440000  # клиент может прислать UUID
```

Если заголовок **отсутствует или пустой**, сервер **обязан** сгенерировать `request_id` (UUID), проставить его в контекст запроса и вернуть в ответе — чтобы каждый запрос был связан с логами.

### Заголовки ответа (сервер → клиент)

```http
X-Request-ID: 550e8400-e29b-41d4-a716-446655440000  # эхо из запроса или сгенерированный
X-Response-Time: 142ms                               # время обработки
```

**Использование:** при обращении в поддержку пользователь называет `X-Request-ID` → разработчик находит строку в логах с полным контекстом.

### Audit trail в ответах (опционально)

Для критичных мутаций ответ может содержать `_audit`:

```json
// PATCH /api/deals/uuid/stage
{
  "id": "uuid",
  "stage": "won",
  "_audit": {
    "changed_by": "user-uuid",
    "changed_at": "2026-04-11T10:30:00Z",
    "previous_stage": "proposal",
    "request_id": "550e8400-..."
  }
}
```

`_audit` поле — дополнительное (non-breaking), клиент может игнорировать.  
Полная история — через `GET /api/deals/{id}/history`.

---

## 13. Enum-значения (контракт фронт ↔ бэкенд)

**Обратная совместимость (обязательное правило API):**

- **Новые** значения enum в ответах и в JSON-схемах **можно добавлять** (клиенты должны tolerate unknown / запасной веткой `default`).
- **Существующие** значения **нельзя удалять и нельзя менять смысл** без новой версии API: иначе ломается фронт и любые сохранённые клиентские состояния.
- Переименование — через добавление нового значения + deprecation старого + миграция данных, а не «тихая» замена строки.

```typescript
type TaskStatus    = 'todo' | 'in_progress' | 'review' | 'done' | 'cancelled'
type TaskPriority  = 'low' | 'medium' | 'high' | 'urgent'
type DealStage     = 'new' | 'contacted' | 'negotiation' | 'proposal' | 'won' | 'lost'
type DealSource    = 'telegram' | 'instagram' | 'site' | 'manual'
type MsgChannel    = 'telegram' | 'instagram' | 'site' | 'internal'
type MsgDirection  = 'in' | 'out'
type DeliveryStatus = 'pending' | 'sending' | 'sent' | 'failed' | 'dead'
type FinanceStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'paid'
type ARStatus      = 'pending' | 'partial' | 'paid' | 'overdue'
type BPIStatus     = 'active' | 'completed' | 'cancelled'
type ContentStatus = 'draft' | 'ready' | 'scheduled' | 'published' | 'cancelled'
type UserRole      = 'admin' | 'manager' | 'employee' | 'readonly'
```

---

## 14. Права доступа (полный список)

```
core.home                   Рабочий стол
tasks.view                  Просмотр задач
tasks.create                Создание задач
tasks.edit                  Редактирование задач
tasks.delete                Удаление задач
spaces.view                 Пространства (просмотр)
spaces.manage               Пространства (управление)
crm.view                    CRM (просмотр)
crm.deals.create            Создание сделок
crm.deals.edit              Редактирование сделок
crm.deals.delete            Удаление сделок
crm.chats                   Диалоги с лидами
crm.clients.view            Клиенты (просмотр)
crm.clients.edit            Клиенты (редактирование)
crm.clients.delete          Клиенты (удаление)
finance.view                Финансы (просмотр)
finance.create              Финансы (создание записей)
finance.approve             Финансы (согласование)
org.employees.view          HR (просмотр)
org.employees.edit          HR (редактирование)
org.bpm.view                BPM (просмотр)
org.bpm.edit                BPM (редактирование)
inventory.view              Склад (просмотр)
inventory.edit              Склад (редактирование)
production.view             Производство (просмотр)
production.edit             Производство (редактирование)
content.view                Контент (просмотр)
content.edit                Контент (редактирование)
admin.users                 Управление пользователями
admin.settings              Настройки системы
admin.logs                  Системные логи
```

