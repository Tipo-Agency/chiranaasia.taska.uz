# Auth — Аутентификация, Пользователи, Роли, Права

## Назначение

Auth — фундамент системы. Управляет входом в систему, JWT-токенами, ролями и правами.
Без валидного JWT ни один защищённый эндпоинт не работает. Права управляют что именно
пользователь может делать в каждом модуле.

---

## Механизм аутентификации

### JWT в HttpOnly Cookie (НЕ Bearer header)

```
Вход → сервер устанавливает три cookie:
  access_token=<jwt>; HttpOnly; Path=/; SameSite=Lax; [Secure в prod]
  refresh_token=<jwt>; HttpOnly; Path=/api/auth/refresh; SameSite=Lax
  csrf_token=<uuid>; Path=/; SameSite=Lax  ← JS может читать!

Запрос → браузер автоматически шлёт cookies +
  X-CSRF-Token: <значение csrf_token cookie>   ← обязателен для мутаций
```

**Почему HttpOnly:** защита от XSS — JS не может прочитать `access_token`/`refresh_token`.
**Почему CSRF токен читаем:** frontend должен прочитать и отправить в заголовке.

### Bearer Header (только для dev/интеграций)

```
Authorization: Bearer <jwt>  — работает только если AUTH_ALLOW_BEARER_HEADER=True в config
                               DEFAULT=False, никогда не включать в prod
```

### Token Version (`tv` claim)

```
JWT payload содержит: { "sub": "user-id", "tv": 5, "exp": ... }

При смене пароля пользователя:
  → user.token_version в БД увеличивается на 1
  → все существующие JWT имеют старый tv
  → следующий запрос с любым из них → get_current_user() видит tv mismatch
  → HTTP 401 "Session invalidated"
  → Все сессии на всех устройствах принудительно завершены
```

### CSRF Double Submit Cookie

```
Мутирующие запросы (POST/PUT/PATCH/DELETE) на /api/*:
  → Обязателен заголовок X-CSRF-Token: <значение csrf_token cookie>
  → CSRFMiddleware сверяет через hmac.compare_digest()
  → Mismatch → HTTP 403

Исключения из CSRF (не нужен X-CSRF-Token):
  POST /api/auth/login
  POST /api/auth/refresh
  POST /api/auth/logout
  POST /api/integrations/telegram/webhook/*
  POST /api/integrations/meta/webhook
  POST /api/integrations/site/leads
```

---

## Сущности и поля БД

### User (таблица `users`)


| Колонка                 | Тип БД      | Nullable | Дефолт    | Описание                                 |
| ----------------------- | ----------- | -------- | --------- | ---------------------------------------- |
| `id`                    | String(36)  | NO       | auto UUID | PK                                       |
| `name`                  | String(255) | NO       | —         | Отображаемое имя                         |
| `role_id`               | String(36)  | NO       | —         | FK→roles.id                              |
| `avatar`                | String(500) | YES      | —         | URL или S3 ключ                          |
| `login`                 | String(100) | YES      | —         | UNIQUE; логин для входа                  |
| `email`                 | String(255) | YES      | —         | Email                                    |
| `phone`                 | String(50)  | YES      | —         | Телефон                                  |
| `telegram`              | String(100) | YES      | —         | Telegram username                        |
| `telegram_user_id`      | String(50)  | YES      | —         | Telegram user ID (для уведомлений)       |
| `password_hash`         | String(255) | YES      | —         | bcrypt hash; NULL = вход без пароля      |
| `must_change_password`  | Boolean     | YES      | false     | Принудительная смена при следующем входе |
| `is_archived`           | Boolean     | YES      | false     | Деактивирован (не может войти)           |
| `token_version`         | Integer     | NO       | 0         | Версия для принудительного выхода        |
| `calendar_export_token` | String(128) | YES      | —         | UNIQUE; токен для экспорта iCal          |


### Role (таблица `roles`)


| Колонка       | Тип         | Описание                                    |
| ------------- | ----------- | ------------------------------------------- |
| `id`          | String(36)  | PK                                          |
| `name`        | String(120) | Название роли                               |
| `slug`        | String(60)  | UNIQUE; slug для кода (admin, manager, ...) |
| `permissions` | JSONB       | list[string] — список прав                  |
| `is_system`   | Boolean     | Системная (нельзя удалить)                  |


---

## Каталог прав (Permissions)

### Группа Core — Рабочее пространство


| Право           | Что разрешает                          |
| --------------- | -------------------------------------- |
| `core.home`     | Доступ к дашборду Home                 |
| `core.tasks`    | Просмотр задач                         |
| `tasks.edit`    | Создание/редактирование/удаление задач |
| `core.inbox`    | Доступ к Входящим                      |
| `core.chat`     | Доступ к чату                          |
| `core.search`   | Глобальный поиск                       |
| `core.meetings` | Доступ к встречам                      |
| `core.docs`     | Доступ к документам                    |


### Группа CRM — Продажи


| Право              | Что разрешает                                          |
| ------------------ | ------------------------------------------------------ |
| `crm.spaces`       | Доступ к таблицам/проектам                             |
| `crm.sales_funnel` | Работа с воронкой + создание/редактирование сделок     |
| `crm.client_chats` | Доступ к диалогам с клиентами                          |
| `crm.clients`      | Доступ к клиентам и контрактам                         |
| `crm.deals.edit`   | Полный CRUD сделок + разблокировка won/lost + bulk PUT |


### Группа Организация


| Право                | Что разрешает                      |
| -------------------- | ---------------------------------- |
| `org.inventory`      | Доступ к складу                    |
| `org.employees`      | Просмотр сотрудников               |
| `org.employees.edit` | CRUD сотрудников                   |
| `org.bpm`            | Доступ к бизнес-процессам          |
| `org.production`     | Производственные маршруты и заказы |


### Группа Финансы


| Право             | Что разрешает                                    |
| ----------------- | ------------------------------------------------ |
| `finance.finance` | Просмотр и базовые операции в Finance            |
| `finance.approve` | Одобрение/отклонение заявок; одобрение финпланов |


### Группа Аналитика


| Право                 | Что разрешает      |
| --------------------- | ------------------ |
| `analytics.analytics` | Доступ к аналитике |


### Группа Настройки


| Право                   | Что разрешает                                          |
| ----------------------- | ------------------------------------------------------ |
| `settings.general`      | Общие настройки (статусы, приоритеты, воронки)         |
| `settings.integrations` | Управление интеграциями (Telegram webhook, Meta, сайт) |
| `access.users`          | Управление пользователями (bulk upsert, полный список) |
| `access.roles`          | Управление ролями (CRUD)                               |


### Группа Система


| Право                | Что разрешает                                |
| -------------------- | -------------------------------------------- |
| `system.full_access` | СУПЕРАДМИН — все права без исключений        |
| `admin.system`       | Системный администратор (логи, метрики, DLQ) |


### Специальная логика

```
Роль со slug == "admin" (case-insensitive):
  → имеет все права (проверка в rbac.py)
  → обходит все permission checks

Право "system.full_access":
  → эквивалент "admin" slug
  → обходит все permission checks

CRM messaging access (Telegram отправка):
  → system.full_access ИЛИ crm.client_chats ИЛИ crm.sales_funnel
```

### Права сотрудника по умолчанию (при создании)

```python
core.home, core.tasks, tasks.edit, core.inbox, core.chat, core.search,
core.meetings, core.docs, crm.spaces, crm.sales_funnel, crm.client_chats,
crm.clients, crm.deals.edit, org.inventory, org.employees, org.employees.edit,
org.bpm, finance.finance, analytics.analytics, settings.general
```

---

## Процесс входа в систему

### POST /api/auth/login

```
Rate limit: 5 запросов в минуту по IP

Body (LoginRequest, extra="forbid"):
{
  "login": "user@example.com",
  "password": "secret"
}

Логика:
1. Поиск пользователя:
   → по login (case-insensitive ILIKE) ИЛИ по name (exact)
   → только is_archived = false
2. Проверка пароля:
   → если password_hash == null: принимается любой пароль (passwordless)
   → если password_hash задан: bcrypt verify
3. При успехе:
   → инкрементировать? Нет, token_version не меняется при входе
   → создать access_token (JWT, default 60 мин, настраивается ACCESS_TOKEN_EXPIRE_MINUTES)
   → создать refresh_token (JWT, default 30 дней)
   → генерировать csrf_token = secrets.token_urlsafe(32)
   → Set-Cookie для трёх cookie
4. Ответ 200:
{
  "id": "...",
  "name": "...",
  "roleId": "...",
  "permissions": [...],
  "role": "manager",
  "roleSlug": "manager"
}
```

**JWT payload:**

```json
{
  "sub": "user-uuid",
  "name": "Иван Иванов",
  "tv": 5,
  "role": "manager",
  "permissions": ["tasks.edit", "crm.sales_funnel", ...],
  "exp": 1234567890
}
```

### POST /api/auth/refresh

```
Rate limit: 10 запросов в минуту

Требует: refresh_token cookie
Логика:
1. Decode refresh_token
2. Проверить token_version (tv) в JWT vs БД → 401 если mismatch
3. Ротировать refresh_token: отозвать старый, создать новый
4. Выдать новый access_token
5. Обновить cookie

Ответ 200: то же что при login
```

### POST /api/auth/logout

```
Не требует CSRF (исключение из middleware)
Логика:
1. Опционально: отозвать refresh_token в БД
2. Set-Cookie с истёкшим сроком для всех трёх cookie

Ответ 200: { "ok": true }
```

---

## Управление пользователями

### GET /api/auth/users

```
Без права access.users:
  → возвращает только активных пользователей (is_archived=false)
  → поля: id, name, avatar, roleId, role
  → используется для выпадающих списков (assignee и т.д.)

С правом access.users:
  → полный список включая архивированных
  → все поля AuthUserOut

Response: list[AuthUserOut]
```

### PUT /api/auth/users (Bulk upsert)

```
Право: access.users

Body: list[UserBulkItem] (extra="forbid"):
{
  "id":               string ≤36
  "name":             string ≤255
  "login":            string ≤255
  "email":            string ≤255
  "phone":            string ≤50
  "telegram":         string ≤100
  "telegramUserId":   string ≤100
  "roleId":           string ≤36
  "role":             string ≤50 (slug, legacy)
  "avatar":           string
  "password":         string (если bcrypt hash → сохраняется как есть; иначе → хешируется)
  "mustChangePassword": bool
  "isArchived":       bool
}

Логика на сервере для каждого пользователя:
1. Найти по id
2. Если не найден → создать с role="employee" если roleId не задан
3. Если найден → обновить поля из payload
4. Пароль:
   → if looks_like_bcrypt_hash(password): сохранить как есть
   → else: bcrypt.hash(password, rounds=BCRYPT_ROUNDS)
5. При смене пароля: token_version += 1 (принудительный выход)

Response 200: { "ok": true }
```

---

## Управление ролями

### GET /api/auth/roles

```
Право: access.roles ИЛИ access.users

Response: list[RoleApiRow]
{
  "id": "...",
  "name": "Менеджер",
  "slug": "manager",
  "permissions": ["tasks.edit", "crm.sales_funnel", ...],
  "isSystem": false
}
```

### POST /api/auth/roles

```
Право: access.roles

Body:
{
  "name": "Менеджер по продажам",  // 1-120 chars
  "slug": "sales-manager",          // опционально, ≤60 chars; auto-generate если не задан
  "permissions": ["crm.sales_funnel", "tasks.edit"]
}

Логика:
1. Если slug не задан → генерировать из name (транслит + slug)
2. Slug UNIQUE → 409 если уже занят
3. Создать роль

Response 200: { "ok": true, "id": "..." }
```

### PATCH /api/auth/roles/{role_id}

```
Право: access.roles

Body (все опционально):
{
  "name": "...",
  "permissions": [...]
}

Правила:
→ Системную роль (is_system=true) нельзя удалять, но можно обновлять
→ slug изменить нельзя через PATCH

Response 200: { "ok": true }
```

### DELETE /api/auth/roles/{role_id}

```
Право: access.roles

Правила:
→ Если is_system=true: 400 "cannot_delete_system_role"
→ Если есть пользователи с этой ролью: 400 "role_has_users"
→ Иначе: удаление

Response 200: { "ok": true }
```

---

## Текущий пользователь и сессия

### GET /api/auth/me

```
Response: AuthUserOut
{
  "id": "uuid",
  "name": "Иван Иванов",
  "roleId": "role-uuid",
  "avatar": "...",
  "login": "ivan",
  "email": "ivan@company.com",
  "phone": "+998901234567",
  "telegram": "@ivan",
  "telegramUserId": "123456",
  "isArchived": false,
  "mustChangePassword": false,
  "roleSlug": "manager",
  "roleName": "Менеджер",
  "permissions": ["tasks.edit", "crm.sales_funnel", ...],
  "role": "manager",
  "calendarExportToken": "...",
  "calendarExportUrl": "https://tipa.taska.uz/api/calendar-feed/..."
}
```

### GET /api/auth/csrf

```
Возвращает/обновляет CSRF cookie.
Используется когда frontend не имеет csrf_token (e.g. первый визит).

Response: { "ok": true }
Устанавливает новый csrf_token cookie если отсутствует.
```

---

## Коды ошибок Auth


| HTTP | Ключ                  | Когда                                      |
| ---- | --------------------- | ------------------------------------------ |
| 401  | `not_authenticated`   | Нет токена                                 |
| 401  | `session_invalidated` | token_version не совпадает                 |
| 401  | `token_expired`       | JWT истёк                                  |
| 401  | `invalid_token`       | JWT невалиден                              |
| 403  | `forbidden`           | Недостаточно прав                          |
| 403  | (CSRF mismatch)       | X-CSRF-Token не совпадает                  |
| 404  | `user_not_found`      | Пользователь не найден при входе           |
| 409  | `slug_conflict`       | Slug роли уже занят                        |
| 429  | —                     | Rate limit (login: 5/min, refresh: 10/min) |


---

## Edge Cases


| Ситуация                                  | Поведение                                          |
| ----------------------------------------- | -------------------------------------------------- |
| Вход заархивированного пользователя       | 401 user_not_found (или аналог)                    |
| Вход с пустым паролем + passwordless user | OK                                                 |
| Вход с неверным паролем                   | 401                                                |
| Refresh с истёкшим refresh_token          | 401                                                |
| Refresh с отозванным refresh_token        | 401                                                |
| Смена пароля через bulk PUT users         | token_version++; все JWT инвалидируются            |
| Удаление роли у которой есть пользователи | 400                                                |
| Удаление системной роли                   | 400                                                |
| Два пользователя с одним login            | 409 (UNIQUE constraint)                            |
| Пользователь без password_hash            | Может войти с любым паролем                        |
| calendar_export_token                     | Уникальный токен для экспорта iCal-ленты без OAuth |


