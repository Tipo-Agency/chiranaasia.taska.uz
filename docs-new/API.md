# API Reference

Базовый URL: `https://tipa.taska.uz/api`  
OpenAPI: `GET /openapi.json` при запущенном сервере.

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
Для мутирующих запросов (POST/PUT/PATCH/DELETE) обязателен заголовок `X-CSRF-Token`.

```http
Cookie: access_token=<jwt>; csrf_token=<random>
X-CSRF-Token: <значение csrf_token cookie>
X-Request-ID: <uuid>          # опционально, для трассировки
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

## 3. Идемпотентность

Для создающих операций (POST) клиент может передать ключ идемпотентности:

```http
POST /api/deals
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
```

**Поведение:**

- Первый запрос с ключом — выполнить + сохранить **хэш тела запроса** и **сериализованный ответ** в Redis (TTL 24 ч).
- Повтор с тем же ключом и **тем же телом** (тот же хэш) — вернуть сохранённый ответ без повторного выполнения; заголовок `Idempotent-Replayed: true`.
- Повтор с тем же ключом, но **другим телом** — `409 Conflict`, тело ошибки с идентификатором `idempotency_conflict`. Это защита от багов клиента (повтор с другим payload), а не «тихий» replay чужого результата.

```json
{
  "error": "idempotency_conflict",
  "message": "Idempotency-Key уже использован с другим телом запроса",
  "request_id": "..."
}
```

**Где поддерживается (план / целевой контракт):** `POST /deals`, `POST /tasks`, `POST /clients`, `POST /finance/requests`, `POST /messages/send` — до внедрения middleware в бэкенде клиент может не полагаться на replay.

---

## 4. Пагинация

### 4.1 Offset-пагинация (стандартная)

Все LIST-эндпоинты поддерживают:

```http
GET /api/tasks?limit=50&offset=0
```


| Параметр | Тип | По умолчанию | Максимум |
| -------- | --- | ------------ | -------- |
| `limit`  | int | 50           | 500      |
| `offset` | int | 0            | —        |


**Ответ:**

```json
{ "items": [...], "total": 142, "limit": 50, "offset": 0 }
```

### 4.2 Cursor-пагинация (для feeds)

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

**Формат `cursor` (контракт для клиента):**

- Клиент трактует значение как **непрозрачную строку** (opaque token), не парсит и не конкатенирует вручную.
- На сервере логически курсор кодирует устойчивую позицию (например пара «время + id»). Рекомендуемое представление в API: **Base64URL** от строки вида `2026-01-15T10:30:00.000Z|<uuid>` (ISO 8601 + `|` + id строки), чтобы:
  - не привязывать клиентов к внутреннему разделителю в сыром виде;
  - при смене внутренней схемы оставить наружу всё ещё «просто строку».

Пример декодирования (только отладка): `base64url_decode(cursor) → "2026-01-15T10:30:00.000Z|550e8400-e29b-41d4-a716-446655440000"`.

**Как работает под капотом:**

```sql
-- Cursor = created_at + id (составной, стабильный)
SELECT * FROM inbox_messages
WHERE deal_id = $1
  AND (created_at, id) < ($cursor_ts::timestamptz, $cursor_id::uuid)
ORDER BY created_at DESC, id DESC
LIMIT 50;
-- Использует индекс idx_messages_deal — всегда O(log N)
```

**Когда использовать cursor, когда offset:**


| Endpoint                  | Тип    | Почему                                        |
| ------------------------- | ------ | --------------------------------------------- |
| `GET /messages/deal/{id}` | Cursor | Растущий feed, нужна стабильность             |
| `GET /notifications`      | Cursor | Растущий feed                                 |
| `GET /activity`           | Cursor | Хронологическая лента                         |
| `GET /tasks`              | Offset | Нужна фильтрация + сортировка по разным полям |
| `GET /deals`              | Offset | Нужен jump к конкретной странице              |
| `GET /clients`            | Offset | Поиск + фильтрация важнее стабильности        |


---

## 5. Сортировка

Все LIST-эндпоинты поддерживают параметры сортировки:

```http
GET /api/tasks?sort=created_at&order=desc
GET /api/deals?sort=amount&order=asc
GET /api/clients?sort=name&order=asc
```


| Параметр | Значения             | По умолчанию |
| -------- | -------------------- | ------------ |
| `sort`   | Зависит от эндпоинта | `created_at` |
| `order`  | `asc`                | `desc`       |


**Допустимые поля сортировки по эндпоинту:**


| Эндпоинт            | Поля                                                                  |
| ------------------- | --------------------------------------------------------------------- |
| `/tasks`            | `created_at`, `updated_at`, `due_date`, `priority`, `status`, `title` |
| `/deals`            | `created_at`, `updated_at`, `amount`, `stage`, `title`                |
| `/clients`          | `created_at`, `name`, `company_name`                                  |
| `/finance/requests` | `created_at`, `amount`, `status`, `payment_date`                      |
| `/employees`        | `full_name`, `hire_date`, `department_id`                             |


**Многоуровневая сортировка** (когда нужна):

```http
GET /api/tasks?sort=priority,created_at&order=desc,asc
# сначала по priority desc, потом по created_at asc
```

---

## 6. Rate Limiting


| Эндпоинт                            | Лимит                    |
| ----------------------------------- | ------------------------ |
| `POST /api/auth/login`              | 5 / мин / IP             |
| `POST /api/auth/refresh`            | 10 / мин / IP            |
| `POST /api/integrations/site/leads` | 30 / мин / IP            |
| Все остальные                       | 300 / мин / пользователь |


При превышении: `HTTP 429` + заголовок `Retry-After: <секунды>`.

**Заголовки ответа (когда rate limiting включён на балансере или в приложении):**

Клиент может использовать их для backoff без парсинга тела ответа:

```http
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 42
X-RateLimit-Reset: 1712837460
```

| Заголовок | Смысл |
| --------- | ------ |
| `X-RateLimit-Limit` | Лимит запросов в окне для данного ключа (IP / пользователь / маршрут — зависит от политики). |
| `X-RateLimit-Remaining` | Сколько запросов осталось в текущем окне. |
| `X-RateLimit-Reset` | Unix-время (секунды), когда счётчик окна сбросится; либо согласованная с реализацией семантика (зафиксировать в OpenAPI при внедрении). |

*Примечание:* на момент описания документа лимиты в таблице выше — **целевая политика**; при отсутствии middleware заголовки могут не отдаваться — тогда ориентир только `429` + `Retry-After`.

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

### System / Admin


| Метод | Путь                                | Описание                  | Auth  |
| ----- | ----------------------------------- | ------------------------- | ----- |
| GET   | `/health`                           | Здоровье (db, redis)      | ❌     |
| GET   | `/api/admin/logs`                   | Системные логи (канон)    | admin (`admin.system`) |
| GET   | `/api/system/logs`                  | То же (legacy, deprecated в OpenAPI) | admin |
| GET   | `/api/admin/users`                  | Управление пользователями | admin |
| POST  | `/api/admin/users/{id}/permissions` | Обновить права            | admin |


Все административные read/write под **`/api/admin/*`**; **`/api/system/logs`** оставлен для обратной совместимости.

---

## 8. Вебхуки без префикса /api

```
GET /webhook/meta?hub.mode=subscribe&hub.challenge=...&hub.verify_token=...
  → Верификация: вернуть hub.challenge если verify_token совпадает

POST /webhook/meta
  Headers: X-Hub-Signature-256: sha256=<hmac>
  Body: {...Meta event payload...}
  → Немедленно ответить 200 OK (тело можно минимальным JSON)
```

### Политика ретраев (Meta и аналоги)

Провайдер может **повторно отправить** тот же вебхук при таймаутах или `5xx`. Контракт бэкенда:

1. **Идемпотентность по событию сообщения:** для Instagram Direct в комментариях сделки дубликаты по идентификатору сообщения Meta (`mid`) не создают второй комментарий — см. поле `metaMid` у комментария и проверку в обработчике вебхука.
2. **Быстрый ACK:** обработка не должна удерживать HTTP-соединение дольше разумного SLA Meta; тяжёлую работу (когда появится) выносить в очередь.
3. **Повтор с тем же телом** безопасен: либо no-op, либо идемпотентное обновление.

Для других входящих вебхуков (Telegram secret path и т.д.) — аналогично: внешний **уникальный id события** + запись о факте обработки, если нельзя вывести идемпотентность из доменной модели.

---

## 9. ETag и кэширование

ETag нужен для данных, которые редко меняются и часто запрашиваются.  
Не применять к feeds, спискам задач/сделок — там данные слишком динамичны.

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


**Реализация (FastAPI):**

```python
import hashlib

@router.get("/users")
async def get_users(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    users = await user_service.get_all(db)
    data = [u.model_dump() for u in users]
    etag = hashlib.md5(str(data).encode()).hexdigest()

    if request.headers.get("If-None-Match") == etag:
        return Response(status_code=304)

    return JSONResponse(
        content=data,
        headers={"ETag": etag, "Cache-Control": "private, max-age=60"}
    )
```

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

**Правила bulk-операций:**

- Максимум 100 ID за один запрос (защита от DOS)
- Атомарность: либо все, либо никто — в одной транзакции
- Partial failure: если нельзя обработать часть — вернуть `{"updated": N, "failed": [{"id": "...", "reason": "..."}]}`
- Права проверяются для каждой сущности (нельзя обновить чужое через bulk)

---

## 11. WebSocket контракт

**URL:** `wss://tipa.taska.uz/api/notifications/ws/{user_id}`

### Подключение

```javascript
const ws = new WebSocket(`wss://tipa.taska.uz/api/notifications/ws/${userId}`);
// Авторизация через cookie (access_token) — браузер шлёт автоматически
```

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
X-Request-ID: 550e8400-e29b-41d4-a716-446655440000  # клиент генерирует UUID
```

Если не передан — сервер генерирует сам.

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

