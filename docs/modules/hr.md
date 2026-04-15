# HR — Сотрудники и Оргструктура

## Назначение

HR-модуль управляет организационной структурой: **сотрудники** (`EmployeeInfo`),
**отделы** (`Department`), **должности** (`OrgPosition`).

Является справочником для всех модулей: задачи назначаются через `user_id`,
заявки привязываются к сотруднику и отделу, BPM-шаги назначаются на должности.

---

## Сущности и поля БД

### EmployeeInfo (таблица `employee_infos`)

| Колонка | Тип БД | Nullable | Дефолт | Описание |
|---------|--------|----------|--------|----------|
| `id` | String(36) | NO | auto UUID | PK |
| `user_id` | String(36) | YES | — | FK→users.id ON DELETE SET NULL |
| `department_id` | String(36) | YES | — | Отдел |
| `org_position_id` | String(36) | YES | — | Должность |
| `full_name` | String(255) | NO | '' | ФИО сотрудника |
| `status` | String(50) | NO | 'active' | Статус занятости |
| `position` | String(255) | YES | — | Legacy alias для full_name (зеркалируется) |
| `hire_date` | String(50) | YES | — | Дата принятия (строка, не валидируется) |
| `birth_date` | String(50) | YES | — | Дата рождения (строка, не валидируется) |
| `is_archived` | Boolean | YES | false | Архив |

**Индексы:**
- `idx_employee_infos_dept_archived_fullname_id` — composite on (`department_id`, `is_archived`, `full_name`, `id`)

**Примечания:**
- `ORM`: `EmployeeInfo` определён в `models/client.py` (не в отдельном файле)
- `position` всегда зеркалирует `full_name` при записи (legacy совместимость)
- `user_id` может быть NULL — сотрудник как справочная запись без аккаунта

### Department (таблица `departments`)

| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | String(36) | PK |
| `name` | String(255) | Название отдела |
| `parent_id` | String(36) | FK→departments.id; для иерархии |
| `is_archived` | Boolean | Архив |

**Правила иерархии:**
- Проверка цикла выполняется до 256 уровней вложенности
- `parent_id == id` (самоссылка) → 400
- Цикл A→B→C→A → 400 при установке parent_id

### OrgPosition (таблица `org_positions`) — часть BPM-модуля

| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | String(36) | PK |
| `title` | String(255) | Название должности |
| `department_id` | String(36) | Отдел |
| `manager_position_id` | String(36) | Должность руководителя |
| `holder_user_id` | String(36) | Текущий держатель (user_id) |
| `order_val` | String(10) | Порядок отображения (хранится как строка) |
| `is_archived` | Boolean | Архив |
| `task_assignee_mode` | String(20) | Режим назначения: `round_robin` (default) |
| `last_task_assignee_user_id` | String(36) | Последний получивший задачу (для round-robin) |

---

## Бизнес-правила

### Сотрудники

1. **ФИО не может быть пустым** — если передано пустое/null `fullName`, подставляется `"Сотрудник"`
2. **Статус по умолчанию** — `"active"` если не передан или пустой
3. **DELETE = мягкое удаление** — `DELETE /employees/{id}` устанавливает `is_archived=true` (HTTP 204)
4. **По умолчанию без архива** — `GET /employees` возвращает только `is_archived=false` (параметр `includeArchived=false`)
5. **position зеркалирует fullName** — при любом обновлении `full_name` также записывается в `position` (legacy)
6. **positionId и orgPositionId** — алиасы в API и bulk; при наличии обоих `positionId` приоритетнее
7. **Bulk PUT без удалений** — `PUT /employees` — только upsert; деактивация = `isArchived: true`; hard delete не предусмотрен
8. **hireDate/birthDate** — принимаются как строки любого формата; хранятся без валидации
9. **Один сотрудник = один пользователь** — `user_id` UNIQUE не гарантируется на уровне БД, но рекомендуется
10. **Поиск при search JOIN** — поиск по `fullName`/`status` + LEFT JOIN users по `name`/`login`; без search — JOIN не применяется

### OrgPosition (должности)

1. **taskAssigneeMode = round_robin** — при назначении задачи через BPM-шаг (`assigneeType="position"`) выбирается `holderUserId`, после чего `lastTaskAssigneeUserId` обновляется
2. **order_val** — хранится как строка; числовая часть возвращается как int в API если `str.isdigit()`
3. **Управляется через BPM API** — `PUT /api/bpm/positions` (не через /employees/positions)

---

## API-эндпоинты

### Сотрудники

| Метод | Путь | Описание | Право |
|-------|------|----------|-------|
| GET | /api/employees | Список (cursor pag.) | auth |
| GET | /api/employees/{id} | Один сотрудник | auth |
| POST | /api/employees | Создать | `org.employees.edit` |
| PATCH | /api/employees/{id} | Обновить поля | `org.employees.edit` |
| DELETE | /api/employees/{id} | Архивировать (204) | `org.employees.edit` |
| PUT | /api/employees | Bulk sync | `org.employees.edit` |

### Отделы

| Метод | Путь | Описание | Право |
|-------|------|----------|-------|
| GET | /api/departments | Все отделы | auth |
| PUT | /api/departments | Bulk upsert | auth |

### Должности (OrgPositions) — в BPM-модуле

| Метод | Путь | Описание |
|-------|------|----------|
| GET | /api/bpm/positions | Все должности |
| PUT | /api/bpm/positions | Bulk sync |

---

## Запросы и ответы

### GET /api/employees — фильтры

```
?limit=50                   # 1..500; default 50
&cursor=<token>             # keyset cursor
&search=текст               # ILIKE по fullName + LEFT JOIN users (name, login)
&departmentId=uuid          # фильтр по отделу
&status=active              # фильтр по статусу
&positionId=uuid            # фильтр по должности (org_position_id)
&userId=uuid                # фильтр по привязанному пользователю
&includeArchived=false      # default false; true включает архивных
&sort=fullName              # fullName|status|id|hireDate|departmentId
&order=asc                  # asc|desc; default asc
```

Сортировка: первичный ключ + secondary `id` (стабильная пагинация).

### EmployeeRead (ответ)

```json
{
  "id": "uuid",
  "userId": "uuid | null",
  "departmentId": "uuid | null",
  "positionId": "uuid | null",
  "orgPositionId": "uuid | null",
  "fullName": "Иван Иванов",
  "status": "active",
  "isArchived": false,
  "hireDate": "2023-01-15",
  "birthDate": "1990-05-20"
}
```

### POST /api/employees — EmployeeCreate

```json
{
  "id": "uuid (опционально; если не передан — auto UUID)",
  "userId": "uuid | null",
  "departmentId": "uuid | null",
  "positionId": "uuid | null",
  "orgPositionId": "uuid | null",
  "fullName": "Иван Иванов",
  "status": "active",
  "hireDate": "2023-01-15",
  "birthDate": "1990-05-20",
  "isArchived": false
}
```

Если `id` передан и уже существует → 409.
Если `fullName` пустой/null → подставляется `"Сотрудник"`.

### PATCH /api/employees/{id} — EmployeeUpdate

Все поля опциональны (только передаваемые поля обновляются):

```json
{
  "userId": "uuid | null",
  "departmentId": "uuid | null",
  "positionId": "uuid | null",
  "orgPositionId": "uuid | null",
  "fullName": "Новое ФИО",
  "status": "dismissed",
  "hireDate": "2023-01-15",
  "birthDate": null,
  "isArchived": true
}
```

### PUT /api/employees — EmployeeBulkItem[] (`extra="forbid"`)

```json
[
  {
    "id": "uuid (обязателен)",
    "userId": "uuid | null",
    "departmentId": "uuid | null",
    "positionId": "uuid | null",
    "orgPositionId": "uuid | null",
    "fullName": "Иван Иванов",
    "position": "Менеджер (legacy)",
    "status": "active",
    "hireDate": "2023-01-15",
    "birthDate": "1990-05-20",
    "isArchived": false
  }
]
```

Ответ: `{ "ok": true }`

Логика на каждый элемент:
1. Найти по `id`
2. Если не найден → создать с дефолтами (`fullName="Сотрудник"` если пустой, `status="active"` если пустой)
3. Если найден → обновить только переданные (model_fields_set) поля
4. Зеркалировать `full_name` → `position`

### PUT /api/bpm/positions — OrgPositionItem[] (`extra="forbid"`)

```json
[
  {
    "id": "uuid (обязателен)",
    "title": "Менеджер по продажам",
    "departmentId": "uuid | null",
    "managerPositionId": "uuid | null",
    "holderUserId": "uuid | null",
    "order": 1,
    "isArchived": false,
    "taskAssigneeMode": "round_robin",
    "lastTaskAssigneeUserId": "uuid | null"
  }
]
```

---

## Домейн-события

| Событие | Когда |
|---------|-------|
| `employee.created` | POST или bulk PUT создаёт нового сотрудника |
| `employee.updated` | PATCH или bulk PUT обновляет существующего |
| `employee.archived` | DELETE (soft-delete) |
| `bpm.position.created` | PUT /bpm/positions создаёт новую должность |
| `bpm.position.updated` | PUT /bpm/positions обновляет должность |

---

## Коды ошибок

| HTTP | Когда |
|------|-------|
| 404 | Сотрудник не найден (GET/PATCH/DELETE) |
| 409 | POST с id который уже существует |
| 400 | Цикл в иерархии отделов; самоссылка parentId |
| 422 | Нарушение Pydantic; extra="forbid" в bulk |

---

## Связи с другими модулями

| Связь | Описание |
|-------|----------|
| Auth | `Employee.user_id` ↔ `User.id`; пользователь может не иметь записи сотрудника |
| Finance | `requester_id` в заявках = `User.id`; `department_id` — отдел заявителя |
| BPM | Шаги процессов назначаются на `OrgPosition.id`; `holder_user_id` получает задачи |
| Tasks | `assignee_id` в задаче = `User.id` (не Employee.id); ФИО берётся из User.name |
| Notifications | Уведомления адресуются по `User.id`; UI показывает ФИО из Employee |

---

## Edge Cases

| Ситуация | Поведение |
|----------|-----------|
| POST с дублирующимся id | 409 |
| Bulk PUT: id пустой или отсутствует | Элемент пропускается (continue) |
| DELETE несуществующего | 404 |
| fullName = "" или null | Подставляется "Сотрудник" |
| status = "" или null | Подставляется "active" |
| hireDate = "" | Сохраняется как NULL |
| Сотрудник без user_id | Справочная запись; не может войти в систему |
| includeArchived=true | Возвращает всех включая is_archived=true |
| Bulk PUT isArchived=false для архивного | Разархивирует сотрудника |
| positionId и orgPositionId оба переданы | positionId имеет приоритет |
| Поиск без search параметра | JOIN на users не применяется (производительность) |
