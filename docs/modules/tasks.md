# Tasks — Задачи

## Назначение

Tasks — универсальный трекер работы. Задача (`Task`) является атомарной единицей работы в системе.
Задачи живут внутри **таблиц** (`table_id`). Один и тот же тип задачи используется для обычных задач,
беклога, BPM-шагов, заявок на оплату (purchase_request), идей и функциональностей.

Ключевые особенности: пагинация по keyset-курсору, batch upsert до 100 задач, оптимистичная блокировка,
событийная эмиссия при назначении и смене статуса.

---

## Сущность и поля БД

### Task (таблица `tasks`)


| Колонка               | Тип БД      | Nullable | Дефолт    | Описание                                           |
| --------------------- | ----------- | -------- | --------- | -------------------------------------------------- |
| `id`                  | String(36)  | NO       | auto UUID | PK                                                 |
| `version`             | Integer     | NO       | 1         | Версия строки (optimistic locking)                 |
| `table_id`            | String(36)  | YES      | —         | FK→tables.id                                       |
| `entity_type`         | String(30)  | YES      | "task"    | Тип: `task`, `idea`, `feature`, `purchase_request` |
| `title`               | String(500) | NO       | —         | Заголовок задачи                                   |
| `status`              | String(100) | NO       | —         | Статус (произвольная строка, def: "todo")          |
| `priority`            | String(100) | NO       | —         | Приоритет (произвольная строка)                    |
| `assignee_id`         | String(36)  | YES      | —         | Основной исполнитель → users.id                    |
| `assignee_ids`        | JSONB       | YES      | []        | Множество исполнителей (list[string])              |
| `project_id`          | String(36)  | YES      | —         | Проект                                             |
| `start_date`          | String(10)  | YES      | —         | Дата начала YYYY-MM-DD                             |
| `end_date`            | String(10)  | YES      | —         | Дедлайн YYYY-MM-DD (API: `due_date`)               |
| `description`         | Text        | YES      | —         | Описание (HTML/Markdown)                           |
| `is_archived`         | Boolean     | YES      | false     | Архив                                              |
| `comments`            | JSONB       | YES      | []        | Комментарии (встроенные, см. ниже)                 |
| `attachments`         | JSONB       | YES      | []        | Вложения (встроенные, см. ниже)                    |
| `content_post_id`     | String(36)  | YES      | —         | Контент-пост                                       |
| `process_id`          | String(36)  | YES      | —         | Бизнес-процесс                                     |
| `process_instance_id` | String(36)  | YES      | —         | Экземпляр процесса                                 |
| `step_id`             | String(36)  | YES      | —         | Шаг процесса                                       |
| `deal_id`             | String(36)  | YES      | —         | Сделка CRM                                         |
| `source`              | String(100) | YES      | —         | Источник (site, import и т.д.)                     |
| `category`            | String(100) | YES      | —         | Категория                                          |
| `task_id`             | String(36)  | YES      | —         | Родительская задача (sub-task)                     |
| `created_by_user_id`  | String(36)  | YES      | —         | Создатель → users.id                               |
| `created_at`          | String(50)  | YES      | —         | ISO 8601 дата создания                             |
| `requester_id`        | String(36)  | YES      | —         | Инициатор (для purchase_request)                   |
| `department_id`       | String(36)  | YES      | —         | Отдел (для purchase_request)                       |
| `category_id`         | String(36)  | YES      | —         | Категория (для purchase_request)                   |
| `amount`              | String(50)  | YES      | —         | Сумма (для purchase_request; строка для гибкости)  |
| `decision_date`       | String(50)  | YES      | —         | Дата решения (для purchase_request)                |


**Индексы:**

- `idx_tasks_table_archived_created_id` — composite on (`table_id`, `is_archived`, `created_at`, `id`) — покрывает типичный список задач таблицы
- `version_id_col` — SQLAlchemy optimistic lock (StaleDataError при коллизии)

### Структура JSONB `comments[]`

```json
{
  "id": "uuid",
  "task_id": "uuid",
  "user_id": "uuid",
  "text": "текст комментария",
  "created_at": "ISO8601",
  "is_system": false,
  "attachment_id": "uuid | null"
}
```

Поддерживаются оба casing при чтении: `task_id`/`taskId`, `user_id`/`userId` и т.д. (AliasChoices).

### Структура JSONB `attachments[]`

```json
{
  "id": "uuid",
  "task_id": "uuid",
  "name": "filename.pdf",
  "url": "https://...",
  "mime_type": "application/pdf",
  "uploaded_at": "ISO8601",
  "doc_id": "uuid | null",
  "attachment_type": "file | doc | null",
  "storage_path": "s3-key | null"
}
```

Legacy поле `type` принимается как `mime_type` (AliasChoices).

---

## Бизнес-правила

1. `**title` обязателен для POST** — минимум 1 символ, максимум 500
2. `**table_id` обязателен для POST** — задача всегда принадлежит таблице
3. **Дефолтный статус** — при создании: `status = "todo"` если не передан
4. **Дефолтный priority** — пустая строка `""` если не передан (не NULL)
5. **Архив вместо DELETE** — `DELETE /tasks/{id}` выполняет hard delete (не soft!); архив делается через `PATCH {is_archived: true}`
6. **По умолчанию скрываются архивные** — GET без `is_archived` параметра = фильтр `is_archived=false`
7. **Batch-лимит 100** — `PUT /tasks/batch` принимает максимум 100 элементов → 422 при превышении
8. **Batch — upsert семантика** — если id не найден: задача **создаётся** (`new_task_shell` + defaults); если найден: обновляется
9. **Batch: только переданные поля** — каждый элемент обновляет только поля, присутствующие в JSON (exclude_unset)
10. **Optimistic locking на PATCH** — принимается `If-Match: <version>` заголовок **или** `"version": N` в теле; если версия не совпадает → `StaleDataError` → 409 `stale_version`
11. **Batch без optimistic lock** — `PUT /tasks/batch` не использует версию (last-write-wins)
12. **AuditLog** — каждая мутация (create/update/delete) логируется через `log_mutation`
13. **entity_type** — задаётся при создании и не меняется. Значения: `task`, `idea`, `feature`, `purchase_request`

---

## Поля API (request/response)

### POST /api/tasks — TaskCreate

```
{
  "title":        string 1-500      (обязателен)
  "table_id":     string 1-36       (обязателен)
  "description":  string | null
  "status":       string ≤100       (def: "todo")
  "priority":     string ≤100 | null
  "assignee_id":  string ≤36 | null
  "due_date":     string YYYY-MM-DD | null  (→ end_date в БД)
  "tags":         list[string] | null
}
```

Ответ 201: `TaskRead`

### PATCH /api/tasks/{id} — TaskUpdate

Все поля опциональны:

```
{
  "version":      int ≥1 | null     (optimistic lock альтернатива If-Match)
  "title":        string 1-500 | null
  "description":  string | null
  "status":       string ≤100 | null
  "priority":     string ≤100 | null
  "assignee_id":  string | null
  "due_date":     string YYYY-MM-DD | null
  "tags":         list[string] | null
  "position":     int | null
  "is_archived":  bool | null
}
```

Заголовок: `If-Match: <version>` (опционально, альтернатива полю version)

Ответ 200: `TaskRead`; 404 если не найдена; 409 если stale version.

### PUT /api/tasks/batch — TaskBatchItem[]

Каждый элемент:

```
{
  "id":                   string 1-36   (обязателен)
  "table_id":             string ≤36
  "entity_type":          string ≤30
  "title":                string ≤500
  "status":               string ≤100
  "priority":             string ≤100
  "assignee_id":          string ≤36
  "assignee_ids":         list[string]
  "project_id":           string ≤36
  "start_date":           string ≤10   YYYY-MM-DD
  "end_date":             string ≤10   YYYY-MM-DD
  "description":          string
  "is_archived":          bool
  "comments":             list[TaskCommentRead]
  "attachments":          list[TaskAttachmentRead]
  "content_post_id":      string ≤36
  "process_id":           string ≤36
  "process_instance_id":  string ≤36
  "step_id":              string ≤36
  "deal_id":              string ≤36
  "source":               string ≤100
  "category":             string ≤100
  "task_id":              string ≤36   (parent/sub-task)
  "created_by_user_id":   string ≤36
  "created_at":           string ≤50
  "requester_id":         string ≤36
  "department_id":        string ≤36
  "category_id":          string ≤36
  "amount":               string ≤50
  "decision_date":        string ≤50
  "tags":                 list[string]
}
```

Ответ 200: `{ "ok": true, "updated": N }`

### TaskRead (ответ GET/POST/PATCH)

```json
{
  "id": "uuid",
  "version": 1,
  "title": "Задача",
  "description": null,
  "status": "todo",
  "priority": "",
  "table_id": "uuid",
  "assignee_id": "uuid",
  "assignee": { "id": "uuid", "name": "Иван", "avatar": null },
  "created_by": { "id": "uuid", "name": "Менеджер", "avatar": null },
  "due_date": "2025-01-31",
  "tags": [],
  "comments_count": 2,
  "attachments_count": 1,
  "created_at": "2025-01-15T10:00:00Z",
  "updated_at": null,
  "entity_type": "task",
  "assignee_ids": [],
  "project_id": null,
  "start_date": null,
  "end_date": "2025-01-31",
  "is_archived": false,
  "comments": [...],
  "attachments": [...],
  "content_post_id": null,
  "process_id": null,
  "process_instance_id": null,
  "step_id": null,
  "deal_id": null,
  "source": null,
  "category": null,
  "task_id": null,
  "created_by_user_id": "uuid",
  "requester_id": null,
  "department_id": null,
  "category_id": null,
  "amount": null,
  "decision_date": null
}
```

Примечание: `updated_at` всегда `null` (в ORM нет отдельной колонки updated_at — сортировка по `updated_at` в sort маппируется на `created_at`).

---

## API-эндпоинты


| Метод  | Путь             | Описание                     | Право        |
| ------ | ---------------- | ---------------------------- | ------------ |
| GET    | /api/tasks       | Список задач (keyset cursor) | auth         |
| POST   | /api/tasks       | Создать задачу               | `tasks.edit` |
| GET    | /api/tasks/{id}  | Одна задача                  | auth         |
| PATCH  | /api/tasks/{id}  | Обновить поля                | `tasks.edit` |
| DELETE | /api/tasks/{id}  | Hard delete                  | `tasks.edit` |
| PUT    | /api/tasks/batch | Batch upsert ≤100            | `tasks.edit` |


---

## Фильтры и сортировка (GET /api/tasks)

```
?limit=50               # 1..500; default 50
&cursor=<token>         # Fernet-зашифрованный keyset cursor
&table_id=uuid          # фильтр по таблице
&status=todo            # точное совпадение
&priority=high          # точное совпадение
&assignee_id=uuid       # точное совпадение
&is_archived=false      # true|false; если опущено — default false
&due_before=2025-01-31  # end_date <= date (только не-NULL)
&due_after=2025-01-01   # end_date >= date (только не-NULL)
&search=текст           # ILIKE %текст% по title
&sort=created_at        # created_at|updated_at|due_date|priority|status|title
&order=desc             # asc|desc; можно через запятую для multi-sort
```

**Порядок сортировки**: по умолчанию `created_at DESC, id DESC`.
Значение `sort=updated_at` маппируется на `created_at` (в ORM нет отдельного updated_at).
Всегда добавляется вторичный ключ `id` для стабильной пагинации.

**Cursor**: Fernet-зашифрованный объект `{ r, sp, op, fh, vals }`. Fingerprint фильтров проверяется — при несовпадении (фильтры изменились) возвращается 400 `invalid_cursor`.

Ответ: `{ "items": [...], "total": N, "limit": N, "next_cursor": "..." | null }`

---

## Домейн-события


| Событие               | Когда эмитируется                                                                     |
| --------------------- | ------------------------------------------------------------------------------------- |
| `task.assigned`       | При создании задачи с `assignee_id` **ИЛИ** при смене `assignee_id` через PATCH/batch |
| `task.status.changed` | Только при PATCH если `status` изменился (сравнивается с before)                      |


Payload `task.assigned`:

```json
{
  "taskId": "uuid",
  "title": "Название",
  "assigneeId": "uuid",
  "priority": "high",
  "createdByUserId": "uuid"
}
```

Payload `task.status.changed`:

```json
{
  "taskId": "uuid",
  "title": "Название",
  "status": "done",
  "assigneeId": "uuid",
  "createdByUserId": "uuid"
}
```

**Важно**: `task.assigned` эмитируется при batch даже для НОВЫХ задач (if after_assignee is set).
`task.status.changed` эмитируется только если `existing_before` != None (т.е. не при создании).

---

## Связи с другими модулями


| Поле                                             | Связь                                                             |
| ------------------------------------------------ | ----------------------------------------------------------------- |
| `deal_id`                                        | CRM → задача прикреплена к сделке; показывается в карточке сделки |
| `process_id` + `process_instance_id` + `step_id` | BPM → задача создана как шаг процесса                             |
| `content_post_id`                                | Spaces → задача создана из контент-поста                          |
| `table_id`                                       | Spaces → задача живёт в конкретной таблице                        |
| `assignee_id`                                    | Auth → исполнитель (users.id)                                     |
| `requester_id` + `department_id` + `amount`      | Finance → entity_type="purchase_request"                          |


---

## Коды ошибок


| HTTP | Ключ             | Когда                                                       |
| ---- | ---------------- | ----------------------------------------------------------- |
| 404  | —                | Задача не найдена (GET/PATCH/DELETE)                        |
| 409  | `stale_version`  | Optimistic lock: If-Match или version не совпадает          |
| 422  | —                | Batch > 100; невалидное поле сортировки; нарушение Pydantic |
| 400  | `invalid_cursor` | Курсор невалиден или фильтры изменились                     |


---

## Edge Cases


| Ситуация                                | Поведение                                                                                     |
| --------------------------------------- | --------------------------------------------------------------------------------------------- |
| PATCH без version / If-Match            | Без optimistic lock; last-write-wins                                                          |
| PATCH с устаревшей version              | 409 `stale_version`; клиент перечитывает и повторяет                                          |
| Batch > 100 элементов                   | 422 с сообщением "Не более 100 задач за запрос"                                               |
| Batch с несуществующим id               | Задача создаётся (`new_task_shell`) с дефолтами                                               |
| Batch: comments/attachments             | Каждый элемент валидируется через TaskCommentRead/TaskAttachmentRead; невалидные пропускаются |
| GET is_archived не передан              | Возвращаются только `is_archived=false` задачи                                                |
| GET с cursor от другого набора фильтров | 400 invalid_cursor                                                                            |
| Поиск по `search`                       | ILIKE %q% по title; case-insensitive                                                          |
| DELETE задачи из BPM                    | Hard delete; процесс не откатывается                                                          |
| `assignee_ids` vs `assignee_id`         | Оба хранятся независимо; `assignee_id` = основной исполнитель                                 |
| `amount` = null                         | Хранится как NULL в БД (not empty string)                                                     |
| Сортировка по `updated_at`              | Идентична `created_at` (нет отдельного столбца)                                               |


