# BPM — Бизнес-процессы

## Назначение

BPM-модуль позволяет описать бизнес-процессы компании как **шаблоны шагов** и запускать
**экземпляры** этих процессов для конкретных сделок, задач или других объектов.

Шаблоны (BusinessProcess + Steps) ведутся на фронтенде и синхронизируются через bulk PUT.
Экземпляры (BpInstance) — живые запуски процесса с текущим шагом и контекстом.

---

## Сущности и поля БД

### BusinessProcess (таблица `business_processes`)

| Колонка | Тип БД | Nullable | Дефолт | Описание |
|---------|--------|----------|--------|----------|
| `id` | String(36) | NO | auto UUID | PK |
| `version` | String(10) | YES | "1" | Версия шаблона (строка!) |
| `title` | String(255) | NO | — | Название процесса |
| `description` | String(500) | YES | — | Описание |
| `is_archived` | String(10) | YES | "false" | `"true"` или `"false"` (строка, не Boolean!) |
| `created_at` | String(50) | YES | — | ISO дата создания |
| `updated_at` | String(50) | YES | — | ISO дата обновления |

**Важно**: `is_archived` хранится как строка `"true"`/`"false"` (legacy JSON-совместимость).
В API возвращается как `bool` (преобразование: `str == "true"`).

### BusinessProcessStep (таблица `business_process_steps`)

| Колонка | Тип БД | Nullable | Дефолт | Описание |
|---------|--------|----------|--------|----------|
| `id` | String(36) | NO | auto UUID | PK |
| `bp_id` | String(36) | NO | — | FK→business_processes.id CASCADE |
| `position` | Integer | NO | 0 | Порядковый номер шага |
| `role` | String(50) | NO | "user" | Тип исполнителя: `user` или `position` |
| `assignee_id` | String(36) | YES | — | user.id или org_position.id |
| `title` | String(255) | NO | — | Название шага |
| `description` | String(500) | YES | — | Описание |
| `step_type` | String(20) | NO | "normal" | Тип шага: `normal`, `variant`, ... |
| `next_step_id` | String(36) | YES | — | Следующий шаг (если нет веток) |

### BusinessProcessStepBranch (таблица `business_process_step_branches`)

| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | String(36) | PK |
| `step_id` | String(36) | FK→business_process_steps.id CASCADE |
| `label` | String(255) | Метка ветки (например: "Одобрить") |
| `next_step_id` | String(36) | Куда перейти при выборе ветки (NOT NULL) |

Ветки без `next_step_id` не создаются (пропускаются).

### BpInstance (таблица `bp_instances`)

| Колонка | Тип БД | Nullable | Дефолт | Описание |
|---------|--------|----------|--------|----------|
| `id` | String(36) | NO | auto UUID | PK |
| `bp_id` | String(36) | NO | — | FK→business_processes.id CASCADE |
| `current_step_id` | String(36) | YES | — | Текущий шаг (NULL = завершён или не начат) |
| `status` | String(30) | NO | — | Состояние: `active`, `paused`, `completed` |
| `context` | JSONB | NO | {} | Контекст выполнения (см. ниже) |

### OrgPosition (таблица `org_positions`)

| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | String(36) | PK |
| `title` | String(255) | Название должности |
| `department_id` | String(36) | Отдел |
| `manager_position_id` | String(36) | Должность менеджера |
| `holder_user_id` | String(36) | Текущий держатель (user.id) |
| `order_val` | String(10) | Порядок (хранится строкой; числа возвращаются как int) |
| `is_archived` | Boolean | Архив |
| `task_assignee_mode` | String(20) | `round_robin` (default) |
| `last_task_assignee_user_id` | String(36) | Последний получивший задачу (round-robin state) |

---

## Контекст экземпляра (context JSONB)

Поддерживаемые ключи в контексте (остальные игнорируются при слиянии):

| Ключ | Тип | Описание |
|------|-----|----------|
| `processVersion` | int | Версия шаблона при запуске |
| `startedAt` | string | ISO дата запуска |
| `completedAt` | any | ISO дата завершения |
| `taskIds` | list[string] | Задачи созданные в рамках этого экземпляра |
| `dealId` | string | Привязанная сделка |
| `dynamicSteps` | any | Дополнительные динамические шаги |
| `pendingBranchSelection` | any | Ожидает выбора ветки |
| `completedStepIds` | any | Список пройденных шагов |
| `branchHistory` | any | История выборов веток |

Дефолты при создании нового контекста: `taskIds = []`, `processVersion = 1`.

---

## Бизнес-правила

### PUT /bpm/processes — синхронизация шаблонов

1. **Полная замена шагов** — при каждом PUT все старые `BusinessProcessStep` и их ветки УДАЛЯЮТСЯ (DELETE WHERE bp_id), затем вставляются новые. Порядок = `item.order`.
2. **Синхронизация экземпляров** — каждый экземпляр из payload сравнивается с БД:
   - Новый id → создаётся
   - Существующий, status != completed → обновляется (merge context)
   - Отсутствует в payload → удаляется **ЕСЛИ status != completed**
3. **Защита завершённых экземпляров** — экземпляр со `status=completed` никогда не изменяется и не удаляется синхронизацией. Если payload пытается изменить completed (другой `currentStepId`, `status` или контекст) → **409** `"Экземпляр процесса завершён; изменение данных запрещено"`
4. **Слияние контекста** — payload не заменяет контекст полностью; только известные ключи (`_INSTANCE_CONTEXT_KEYS`) сливаются поверх существующих
5. **is_archived** — хранится как строка `"true"`/`"false"` при записи через PUT

### Идентификаторы шагов

- `id` шага опционален в payload; если не передан → генерируется auto UUID
- id усекается до 36 символов

### OrgPosition — round-robin

При назначении задачи через BPM-шаг с `role="position"`:
- Берётся `holder_user_id` текущей позиции
- `last_task_assignee_user_id` обновляется (отслеживает очередь)
- Реальная логика round-robin реализуется на клиенте/сервисном слое

---

## Состояния экземпляра

```
Создание → active
    │
    │ (advance через PUT)
    ▼
  active (currentStepId = следующий шаг)
    │
    │ (нет следующего шага)
    ▼
 completed  ← ╗ НЕИЗМЕНЯЕМ после этого состояния
              ╚══ payload с изменёнными данными → 409
```

| Статус | Описание | Можно менять через PUT? |
|--------|----------|------------------------|
| `active` | Процесс идёт | Да |
| `paused` | Приостановлен | Да |
| `completed` | Завершён | **Нет — 409 при попытке** |

---

## API-эндпоинты

### Процессы

| Метод | Путь | Описание | Право |
|-------|------|----------|-------|
| GET | /api/bpm/processes | Все процессы со шагами и экземплярами | auth |
| PUT | /api/bpm/processes | Bulk sync шаблонов | auth |

### Должности

| Метод | Путь | Описание | Право |
|-------|------|----------|-------|
| GET | /api/bpm/positions | Все должности | auth |
| PUT | /api/bpm/positions | Bulk sync должностей | auth |

---

## Запросы и ответы

### GET /api/bpm/processes — BusinessProcessRead

```json
[
  {
    "id": "uuid",
    "version": 1,
    "title": "Согласование договора",
    "description": null,
    "isArchived": false,
    "createdAt": "2025-01-01T00:00:00Z",
    "updatedAt": "2025-01-10T00:00:00Z",
    "steps": [
      {
        "id": "uuid",
        "title": "Проверка юристом",
        "description": null,
        "assigneeType": "user",
        "assigneeId": "user-uuid",
        "order": 0,
        "stepType": "normal",
        "nextStepId": "step2-uuid",
        "branches": []
      },
      {
        "id": "step2-uuid",
        "title": "Решение руководителя",
        "assigneeType": "user",
        "assigneeId": "manager-uuid",
        "order": 1,
        "stepType": "variant",
        "nextStepId": null,
        "branches": [
          { "id": "br1", "label": "Одобрить", "nextStepId": "step3-uuid" },
          { "id": "br2", "label": "Отклонить", "nextStepId": "step4-uuid" }
        ]
      }
    ],
    "instances": [
      {
        "id": "inst-uuid",
        "processId": "uuid",
        "currentStepId": "step2-uuid",
        "status": "active",
        "processVersion": 1,
        "startedAt": "2025-01-15T09:00:00Z",
        "taskIds": ["task-uuid"],
        "completedAt": null,
        "dealId": "deal-uuid",
        "completedStepIds": ["step1-uuid"],
        "branchHistory": null,
        "pendingBranchSelection": null,
        "dynamicSteps": null
      }
    ]
  }
]
```

### PUT /api/bpm/processes — BusinessProcessBulkItem[] (`extra="forbid"`)

```json
[
  {
    "id": "uuid (обязателен)",
    "version": 2,
    "title": "Согласование договора",
    "description": null,
    "isArchived": false,
    "createdAt": "2025-01-01T00:00:00Z",
    "updatedAt": "2025-01-10T00:00:00Z",
    "steps": [
      {
        "id": "uuid (опционально)",
        "title": "Проверка",
        "description": null,
        "assigneeType": "user",
        "assigneeId": "uuid",
        "order": 0,
        "stepType": "normal",
        "nextStepId": null,
        "branches": []
      }
    ],
    "instances": [
      {
        "id": "uuid",
        "currentStepId": "step-uuid",
        "status": "active",
        "processVersion": 1,
        "startedAt": "2025-01-15T09:00:00Z",
        "taskIds": ["task-uuid"],
        "dealId": "deal-uuid"
      }
    ]
  }
]
```

Ответ: `{ "ok": true }`

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

Ответ: `{ "ok": true }`

---

## Домейн-события

| Событие | Когда |
|---------|-------|
| `bpm.process.created` | PUT создаёт новый процесс |
| `bpm.process.updated` | PUT обновляет существующий процесс |
| `bpm.position.created` | PUT создаёт новую должность |
| `bpm.position.updated` | PUT обновляет существующую должность |

---

## Коды ошибок

| HTTP | Ключ | Когда |
|------|------|-------|
| 409 | — | Payload пытается изменить completed экземпляр |
| 422 | — | extra="forbid" нарушено; Pydantic ошибки |

---

## Связи с другими модулями

| Связь | Описание |
|-------|----------|
| HR | `OrgPosition` содержит `holder_user_id`; шаги назначаются на позиции или пользователей |
| Tasks | `BpInstance.context.taskIds` — список задач созданных в процессе; Task имеет `process_id`, `process_instance_id`, `step_id` |
| CRM | `BpInstance.context.dealId` — процесс запущен для сделки |
| Notifications | События при смене шага, завершении процесса |

---

## Edge Cases

| Ситуация | Поведение |
|----------|-----------|
| PUT processes с completed экземпляром без изменений | OK; completed экземпляр сохраняется |
| PUT processes с completed экземпляром + другой status/step | 409 |
| PUT processes: экземпляр отсутствует в payload, status=active | Удаляется |
| PUT processes: экземпляр отсутствует, status=completed | НЕ удаляется (защита) |
| Шаг без id в payload | Генерируется auto UUID |
| Шаг с branches: branch.nextStepId пустой | Ветка НЕ создаётся (пропускается) |
| GET processes: шаги отсортированы | По (position ASC, id ASC) |
| GET processes: экземпляры отсортированы | По (context.startedAt ASC, id ASC) |
| is_archived = true на процессе | Возвращается как bool true; хранится как строка "true" |
| version | Строка в БД, int в API; "abc" → 1 в API (fallback) |
