# Spaces — Таблицы, Контент-план, Встречи, Недельные планы

## Назначение

Spaces — платформенный модуль организации контента и работы. Содержит:
- **Tables** — справочник таблиц; тип таблицы определяет, какой UI использовать
- **ContentPosts** — посты контент-плана (SMM)
- **Meetings** — встречи и события
- **ShootPlans** — планы съёмок (автоматически связаны с Meeting)
- **WeeklyPlans** — недельные планы сотрудников
- **Protocols** — протоколы собраний

---

## Сущности и поля БД

### TableCollection (таблица `tables`)

| Колонка | Тип | Nullable | Дефолт | Описание |
|---------|-----|----------|--------|----------|
| `id` | String(36) | NO | auto UUID | PK |
| `name` | String(255) | NO | — | Название таблицы |
| `type` | String(100) | YES | — | Тип: `tasks`, `backlog`, `functionality`, `content-plan`, `meetings`, `docs`, `aggregate` |
| `icon` | String(100) | YES | "" | Иконка |
| `color` | String(50) | YES | — | Цвет |
| `is_system` | Boolean | YES | false | Системная (нельзя удалять вручную) |
| `is_archived` | Boolean | YES | false | Архив |
| `is_public` | Boolean | YES | false | Публичный доступ (для контент-плана) |

**Типы таблиц:**
- `tasks` — обычные задачи
- `backlog` — беклог задач
- `functionality` — функциональность (продуктовый беклог)
- `content-plan` — посты контент-плана
- `meetings` — встречи
- `docs` — документы / база знаний
- `aggregate` — агрегатор из нескольких таблиц

### ContentPost (таблица `content_posts`)

| Колонка | Тип | Nullable | Дефолт | Описание |
|---------|-----|----------|--------|----------|
| `id` | String(36) | NO | auto UUID | PK |
| `table_id` | String(36) | YES | — | FK→tables.id |
| `topic` | String(500) | YES | — | Тема поста |
| `description` | Text | YES | — | Описание |
| `date` | String(50) | YES | — | Дата публикации |
| `platform` | JSONB | YES | — | Платформы: `["instagram", "telegram", ...]` |
| `format` | String(100) | YES | — | Формат: reels, stories, post, ... |
| `status` | String(100) | YES | — | Статус |
| `copy` | Text | YES | — | Текст поста (API: `post_copy`) |
| `media_url` | Text | YES | — | URL медиа |
| `is_archived` | Boolean | YES | false | Архив |

### Meeting (таблица `meetings`)

| Колонка | Тип | Nullable | Дефолт | Описание |
|---------|-----|----------|--------|----------|
| `id` | String(36) | NO | auto UUID | PK |
| `table_id` | String(36) | YES | — | FK→tables.id |
| `title` | String(500) | YES | — | Название |
| `date` | String(50) | YES | — | Дата |
| `time` | String(10) | YES | — | Время HH:MM |
| `participant_ids` | JSONB | YES | — | list[string] — user id |
| `participants` | JSONB | YES | — | list[{userId, role}] — детальные данные |
| `summary` | Text | YES | — | Итоги встречи |
| `type` | String(50) | YES | "work" | Тип: `work`, `client`, `project`, `shoot` |
| `deal_id` | String(36) | YES | — | Привязка к сделке |
| `client_id` | String(36) | YES | — | Привязка к клиенту |
| `project_id` | String(36) | YES | — | Привязка к проекту |
| `shoot_plan_id` | String(36) | YES | — | Привязка к плану съёмки |
| `recurrence` | String(50) | YES | "none" | Повторение: `none`, `weekly`, `monthly` |
| `is_archived` | Boolean | YES | false | Архив |

### ShootPlan (таблица `shoot_plans`)

| Колонка | Тип | Nullable | Дефолт | Описание |
|---------|-----|----------|--------|----------|
| `id` | String(36) | NO | auto UUID | PK |
| `table_id` | String(36) | YES | — | FK→tables.id |
| `title` | String(500) | YES | — | Название |
| `date` | String(50) | YES | — | Дата съёмки |
| `time` | String(10) | YES | "10:00" | Время начала |
| `participant_ids` | JSONB | YES | — | list[string] — user id |
| `items` | JSONB | YES | — | Список единиц контента (см. ниже) |
| `meeting_id` | String(36) | YES | — | Автоматически создаваемая встреча |
| `is_archived` | Boolean | YES | false | Архив |

Структура элемента `items[]`:
```json
{
  "postId": "uuid",
  "brief": "Описание съёмки",
  "referenceUrl": "https://...",
  "referenceImages": ["url1", "url2"]
}
```

### WeeklyPlan (таблица `weekly_plans`)

| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | String(36) | PK |
| `user_id` | String(36) | Пользователь |
| `week_start` | String(50) | Начало недели YYYY-MM-DD |
| `task_ids` | JSONB | list[string] — задачи на неделю |
| `notes` | Text | Заметки к плану |
| `created_at` | DateTime(TZ) | Дата создания |
| `updated_at` | DateTime(TZ) | Дата обновления |

### Protocol (таблица `protocols`)

| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | String(36) | PK |
| `title` | String(255) | Название протокола |
| `week_start` | String(50) | Начало периода |
| `week_end` | String(50) | Конец периода |
| `department_id` | String(36) | Отдел |
| `participant_ids` | JSONB | list[string] — участники (user id) |
| `planned_income` | Numeric(14,2) | Плановый доход |
| `actual_income` | Numeric(14,2) | Фактический доход |
| `created_at` | DateTime(TZ) | Дата создания |
| `updated_at` | DateTime(TZ) | Дата обновления |

---

## Бизнес-правила

### Tables

1. **Bulk-only управление** — нет отдельных POST/DELETE; только `PUT /tables` (bulk upsert)
2. **is_public** — при `is_public=true` таблица доступна через публичный эндпоинт без аутентификации
3. **Публичный контент-план** — только таблицы типа `content-plan` имеют смысл как публичные; другие типы технически тоже поддерживаются

### ContentPosts

1. **platform нормализация** — JSONB может содержать битые данные (не list); при чтении всегда нормализуется в `list[str]`, null-элементы отбрасываются
2. **Событие смены статуса** — при PUT если `status` изменился: эмитируется `content_post.status.changed` с `fromStatus`/`toStatus`
3. **Атрибут copy** — в БД хранится в колонке `copy`; в API называется `post_copy` (зарезервированное слово Python)
4. **Bulk-only** — `PUT /content-posts` (нет отдельного POST)

### Meetings

1. **Валидация datetime** — дата и время проверяются функцией `assert_valid_meeting_datetime`
2. **Проверка сделки** — если `deal_id` указан → сделка должна существовать и `is_archived=false`; при нарушении 400
3. **Участники — нормализация** — принимаются: `["user-uuid", ...]` (строки) или `[{"userId": "uuid", "role": "..."}, ...]` (объекты); оба варианта поддерживаются; дедублицируются
4. **DELETE = мягкое удаление** — устанавливает `is_archived=true`
5. **Синхронизация от ShootPlan** — встречи типа `shoot` создаются/обновляются автоматически при PUT /shoot-plans

### ShootPlans

1. **Авто-Meeting** — при каждом PUT ShootPlan автоматически создаётся или обновляется связанная `Meeting`:
   - `type = "shoot"`
   - `title` = заголовок ShootPlan
   - `date` и `time` = из ShootPlan
   - `participant_ids` = из ShootPlan
   - `summary` = `"Shoot plan: N items"` (N = len(items))
   - `table_id` = `"meetings-system"` (фиксировано)
   - `shoot_plan_id` = id ShootPlan
   - `meeting_id` обновляется на ShootPlan
2. **Архивирование ShootPlan** → автоматически архивирует связанную Meeting (`is_archived=true`)
3. **Bulk-only** — `PUT /shoot-plans`

### WeeklyPlans

1. **Фильтр по user_id и week_start** — оба параметра опциональны
2. **Hard delete** — `DELETE /weekly-plans/{id}` выполняет hard delete (не soft)
3. **Последний план** — `GET /weekly-plans/mine/latest?user_id=...` возвращает последний по `created_at`
4. **Bulk upsert** — `PUT /weekly-plans`

### Protocols

1. **Агрегированный ответ** — `GET /weekly-plans/protocols/{id}/aggregated` возвращает:
   - Сам протокол
   - Все `WeeklyPlan` участников за период `week_start..week_end`
   - `taskIdsByUser: { "user-uuid": ["task-id", ...] }` — задачи каждого участника
2. **Hard delete** — `DELETE /weekly-plans/protocols/{id}` — hard delete
3. **Плановый/фактический доход** — хранятся как Numeric(14,2)

---

## Публичный доступ (Content-Plan)

### GET /api/tables/public/content-plan/{table_id}

**Без авторизации** (отдельный `public_router`). Возвращает:

```json
{
  "table": {
    "id": "uuid",
    "name": "Контент-план Q1",
    "type": "content-plan",
    "icon": null,
    "color": "#FF0000"
  },
  "posts": [
    {
      "id": "uuid",
      "topic": "Тема поста",
      "description": null,
      "date": "2025-02-01",
      "platform": ["instagram", "telegram"],
      "format": "reels",
      "status": "scheduled",
      "post_copy": "Текст поста...",
      "mediaUrl": "https://..."
    }
  ],
  "shootPlans": [
    {
      "id": "uuid",
      "title": "Съёмка продукта",
      "date": "2025-02-01",
      "time": "10:00",
      "items": [...]
    }
  ]
}
```

Логика:
- Таблица не найдена или `is_archived=true` → `{ "table": null, "posts": [], "shootPlans": [] }` (200)
- Таблица найдена, `is_public=false` → 403
- Возвращаются только не архивированные посты (`is_archived=false`)

---

## API-эндпоинты

### Tables

| Метод | Путь | Описание | Право |
|-------|------|----------|-------|
| GET | /api/tables | Все таблицы | auth |
| PUT | /api/tables | Bulk upsert | auth |
| GET | /api/tables/public/content-plan/{id} | Публичный контент-план | **без auth** |

### Content Posts

| Метод | Путь | Описание | Право |
|-------|------|----------|-------|
| GET | /api/content-posts | Все посты | auth |
| PUT | /api/content-posts | Bulk upsert | auth |

### Meetings

| Метод | Путь | Описание | Право |
|-------|------|----------|-------|
| GET | /api/meetings | Все не-архивные встречи | auth |
| GET | /api/meetings/{id} | Одна встреча | auth |
| POST | /api/meetings | Создать встречу | auth |
| PATCH | /api/meetings/{id} | Обновить встречу | auth |
| DELETE | /api/meetings/{id} | Архивировать | auth |
| PUT | /api/meetings | Bulk sync | auth |

### Shoot Plans

| Метод | Путь | Описание | Право |
|-------|------|----------|-------|
| GET | /api/shoot-plans | Все не-архивные планы | auth |
| PUT | /api/shoot-plans | Bulk sync (+ auto-Meeting) | auth |

### Weekly Plans

| Метод | Путь | Описание | Право |
|-------|------|----------|-------|
| GET | /api/weekly-plans | Список (фильтр: user_id, week_start) | auth |
| PUT | /api/weekly-plans | Bulk upsert | auth |
| GET | /api/weekly-plans/mine/latest | Последний план пользователя | auth |
| DELETE | /api/weekly-plans/{id} | Hard delete | auth |
| GET | /api/weekly-plans/protocols | Все протоколы | auth |
| PUT | /api/weekly-plans/protocols | Bulk upsert | auth |
| GET | /api/weekly-plans/protocols/{id}/aggregated | Агрегированный протокол | auth |
| DELETE | /api/weekly-plans/protocols/{id} | Hard delete | auth |

---

## Домейн-события

| Событие | Когда |
|---------|-------|
| `table.created` | PUT создаёт новую таблицу |
| `table.updated` | PUT обновляет существующую |
| `content_post.created` | PUT создаёт новый пост |
| `content_post.updated` | PUT обновляет существующий пост |
| `content_post.status.changed` | PUT обновляет пост и статус изменился |

---

## Edge Cases

| Ситуация | Поведение |
|----------|-----------|
| Публичный контент-план для закрытой таблицы | 403 |
| Публичный контент-план для несуществующей таблицы | 200 + пустые массивы |
| ContentPost.platform = null или не-list в JSONB | Нормализуется в `[]` |
| Встреча с dealId несуществующей сделки | 400 |
| Встреча с dealId архивированной сделки | 400 |
| ShootPlan PUT: встреча не существует | Создаётся новая Meeting с type="shoot" |
| ShootPlan PUT: встреча уже существует | Обновляется (title, date, time, participants, summary) |
| ShootPlan is_archived=true | Связанная Meeting тоже архивируется |
| WeeklyPlan DELETE | Hard delete (нет is_archived) |
| Protocol aggregated без планов участников | taskIdsByUser = {} |
| Table.is_public без type=content-plan | Публичный эндпоинт технически работает, но вернёт пустые posts/shootPlans |
