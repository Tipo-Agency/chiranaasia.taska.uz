# Сущности системы

Все бизнес-объекты системы: что представляют, как хранятся, что значат поля, как связаны.

> SQL-схемы (типы, индексы, FK) — в [DATABASE.md](./DATABASE.md); фактические ревизии Alembic — `apps/api/alembic/versions/`.  
> Этот документ — про **доменный смысл**; при расхождении типа колонки с текстом ниже приоритет у **моделей и миграций** (as-built).

**Сопровождение:** при изменении моделей сверяйте §0.1 с `__tablename__` в `apps/api/app/models/`, §0 — с `domain/` и публикацией доменных событий; контракт HTTP — [API.md](./API.md), схема БД — [DATABASE.md](./DATABASE.md).

---

## 0. Глобальные доменные правила

Правила ниже действуют для всех сущностей, если в конкретном разделе не сказано иное.

### Optimistic locking (`version`) **[CURRENT]** (бэкенд) · **[TARGET]** (фронт / дока API)

Для **Task**, **Deal**, **Client**, **FinanceRequest**: колонка **`version`** (integer ≥ 1), увеличивается на **1** при каждом успешном UPDATE (SQLAlchemy `version_id_col` + миграция `048_entity_version_optimistic_locking`). Клиент **может** передать ожидаемую версию заголовком **`If-Match`** (число или `W/"n"`) или полем **`version`** в теле PATCH; при несовпадении с текущей строкой в БД — **409** с кодом `stale_version`. При параллельных правках без передачи версии конфликт по-прежнему даёт **409** на commit (`StaleDataError`). Ответы GET/PATCH отдают **`version`** в JSON (OpenAPI подтягивает из Pydantic). **[TARGET]:** фронт стабильно передаёт версию из ответа GET и обрабатывает 409 (см. [DOCUMENTATION.md](./DOCUMENTATION.md) §3).

### Soft delete и `is_archived`

- Сущности с `**is_archived`**: в продукте **не выполняется физическое удаление** ради «убрать из списка» — только архивация (и при необходимости отдельное логическое удаление через `deleted_at`, если появится в схеме).
- **Публичные списки и ленты по умолчанию:** фильтр `**is_archived = false`**. Просмотр архива — отдельный режим, отчёт или право администратора.

### Владение и доступ: RBAC + ownership

Для полей `**assignee_id`**, `**owner_id`**, `**created_by**`, `**requested_by**`, `**organizer_id**` и т.п.:

- **Чтение:** базово по правам модуля (`tasks.view`, `crm.deals.view`, …); где задумано — дополнительно «свои» записи (исполнитель, владелец, участник).
- **Изменение:** право на тип операции (`*.edit`, `*.approve`, …) **и** серверные правила владения (например менять может assignee, owner или роль с полным доступом к модулю).
- **Сервер — единственный источник правды;** UI не заменяет проверку.

### Временные метки

- `**created_at`:** обязателен, не изменяется после создания (см. [DATABASE.md](./DATABASE.md)).
- `**updated_at`:** обновляется при **каждом** значимом изменении строки (приложение или триггер).

### Лимиты и квоты (ориентиры)


| Область                                        | Лимит              |
| ---------------------------------------------- | ------------------ |
| вложения на одну **Task**                      | до **20**          |
| **tags** на сущность                           | до **20**          |
| длина **title** (если не оговорено в сущности) | **≤ 500** символов |


Итоговые числа — в Pydantic/OpenAPI и конфиге.

### Индексы

Поля, по которым часто фильтруют (`**status`**, `**assignee_id`**, `**created_at**`, `**is_archived**`, FK в списках), должны быть покрыты индексами — перечень в [DATABASE.md](./DATABASE.md) (включая partial index `WHERE is_archived = false` где уместно).

### Доменные события

Ключевые мутации порождают запись в `notification_events` и при доступном Redis — публикацию в stream доменных событий; hub уведомлений — см. [ARCHITECTURE.md](./ARCHITECTURE.md) §7, [QUEUES.md](./QUEUES.md), [DECISIONS.md](./DECISIONS.md) Часть III.

**[CURRENT] — где смотреть в коде:**

- `**emit_domain_event`** — явные продуктовые события: `api/routers/deals.py`, `services/tasks_api.py` (в т.ч. `task.status.changed`), `meetings.py`, `docs.py`, `integrations_site.py`, `services/telegram_leads.py`, `services/meta_instagram.py`, `api/routers/notification_events.py` (replay).
- `**log_entity_mutation`** — обёртка над `emit_domain_event` для аудита CRUD: finance, bpm, inventory, funnels, clients, employees и др.; инвентаризация: `rg "log_entity_mutation" apps/api/app/api/routers`.

Маршрутизация уведомлений по типу события — `app/services/notification_hub.py` (`_route_event`).

### Сквозные инварианты (только сервер)

- **Deal в `won`:** обязателен `**client_id`** (см. §4); смена стадии — `app/services/deal_stage_validation.py` и `**app/domain/deals.py`** (`check_deal_stage_transition`).
- **Task:** переходы `**status`** только по допустимому графу (§2); **[CURRENT]:** проверки в `app/services/tasks_api.py` (вынос в `domain/tasks` — при появлении через ADR).
- **FinanceRequest:** если политика заказчика запрещает самосогласование, переход в `**approved`** / `**paid`** при `**approved_by == requested_by`** отклоняется — `**app/domain/finance_requests.py`** (`check_finance_request_status_transition`), вызов из `app/services/finance_request_workflow.py`.

### 0.1 Карта таблиц PostgreSQL → разделы этого файла

Имя таблицы (`__tablename__` в SQLAlchemy) и где описан смысл. Системные и вспомогательные без отдельной бизнес-главы — в конце.


| Таблица                                                                                                                                                                                  | Раздел / назначение                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `users`, `roles`, `refresh_tokens`                                                                                                                                                       | §1 User; токены — сессия                                     |
| `tasks`, `projects`                                                                                                                                                                      | §2 Task; §3 Table / Project                                  |
| `tables`, `statuses`, `priorities`, `activity`                                                                                                                                           | §3 (доски, справочники, лента активности)                    |
| `clients`, `deals`                                                                                                                                                                       | §5 Client; §4 Deal                                           |
| `sales_funnels`                                                                                                                                                                          | §6 Funnel                                                    |
| `inbox_messages`                                                                                                                                                                         | §7 InboxMessage                                              |
| `notification_prefs`, `notification_events`, `notifications`, `notification_deliveries`, `notifications_archive`, `automation_rules`                                                     | §8 Notification; `notifications_archive` — архив прочитанных |
| `dead_letter_queue`                                                                                                                                                                      | DLQ — [ARCHITECTURE.md](./ARCHITECTURE.md) §6.4, админка     |
| `employee_infos`                                                                                                                                                                         | §9 Employee                                                  |
| `departments`, `org_positions`                                                                                                                                                           | §10                                                          |
| `business_processes`, `bp_instances`, `business_process_steps`, `business_process_step_branches`                                                                                         | §11                                                          |
| `finance_requests`, `finance_plan`, `finance_categories`, `funds`, `financial_plan_documents`, `financial_plannings`, `bank_statements`, `bank_statement_lines`, `income_reports`, `bdr` | §12–§14                                                      |
| `accounts_receivable`                                                                                                                                                                    | §13                                                          |
| `docs`, `folders`, `meetings`, `shoot_plans`, `content_posts`                                                                                                                            | §15–§17                                                      |
| `audit_logs`                                                                                                                                                                             | §18 AuditLog                                                 |
| `weekly_plans`, `protocols`                                                                                                                                                              | домен планов/протоколов (см. API и модули)                   |
| `warehouses`, `inventory_items`, `stock_movements`, `inventory_revisions`                                                                                                                | склад/остатки (см. роутеры inventory)                        |
| `site_integration_keys`, `telegram_integration_state`, `mtproto_sessions`                                                                                                                | интеграции — [INTEGRATIONS.md](./INTEGRATIONS.md)            |
| `system_logs`                                                                                                                                                                            | техлоги, не доменная сущность UI                             |


---

## Оглавление

1. [Глобальные доменные правила](#0-глобальные-доменные-правила)
2. [User — Пользователь](#1-user--пользователь)
3. [Task — Задача](#2-task--задача)
4. [Table / Project — Пространства](#3-table--project--пространства)
5. [Deal — Сделка](#4-deal--сделка)
6. [Client — Клиент](#5-client--клиент)
7. [Funnel — Воронка](#6-funnel--воронка)
8. [InboxMessage — Сообщение диалога](#7-inboxmessage--сообщение-диалога)
9. [Notification — Уведомление](#8-notification--уведомление)
10. [Employee — Сотрудник](#9-employee--сотрудник)
11. [Department / Position — Оргструктура](#10-department--position--оргструктура)
12. [BusinessProcess / BPInstance — Бизнес-процессы](#11-businessprocess--bpinstance--бизнес-процессы)
13. [FinanceRequest — Заявка на оплату](#12-financerequest--заявка-на-оплату)
14. [AccountsReceivable — Дебиторка](#13-accountsreceivable--дебиторка)
15. [BDR — Бюджет доходов/расходов](#14-bdr--бюджет-доходоврасходов)
16. [ContentPost — Контент-план](#15-contentpost--контент-план)
17. [Doc / Folder — Документы](#16-doc--folder--документы)
18. [Meeting — Встреча](#17-meeting--встреча)
19. [AuditLog — Аудит-лог](#18-auditlog--аудит-лог)
20. [Связи между сущностями](#19-связи-между-сущностями)

---

## 1. User — Пользователь

**Что это:** аккаунт человека, который работает в системе. Не путать с `Employee` — сотрудник может не иметь аккаунта, и наоборот.


| Поле            | Тип      | Обязательно | Описание                                     |
| --------------- | -------- | ----------- | -------------------------------------------- |
| `id`            | UUID     | да          | Первичный ключ                               |
| `name`          | string   | да          | Отображаемое имя                             |
| `email`         | string   | нет         | Уникальный, используется для входа           |
| `telegram`      | string   | нет         | Username или chat_id для уведомлений         |
| `avatar_url`    | string   | нет         | URL аватара                                  |
| `role`          | UserRole | да          | Базовая роль: `admin`, `manager`, …          |
| `permissions`   | string[] | да          | Гранулярные права (дополняют роль)           |
| `password_hash` | string   | да          | bcrypt, не передаётся в API                  |
| `is_active`     | boolean  | да          | Деактивированный пользователь не может войти |


**Бизнес-правила:**

- Удаление пользователя запрещено — только деактивация (`is_active = false`)
- Деактивированный пользователь исключается из дропдаунов assignee
- `admin` роль имеет все права независимо от поля `permissions`
- Email уникален в системе, не может быть у двух пользователей

**API:**

- Пароль никогда не возвращается в ответах
- `permissions` — полный список, включая унаследованные от роли
- При логине возвращается JWT с `sub=id`, `role`, `permissions`

---

## 2. Task — Задача

**Что это:** единица работы. Может жить в конкретной таблице проекта или быть «глобальной» (без table_id).


| Поле          | Тип          | Обязательно | Описание                                       |
| ------------- | ------------ | ----------- | ---------------------------------------------- |
| `id`          | UUID         | да          |                                                |
| `title`       | string       | да          | 1–500 символов                                 |
| `description` | text         | нет         | Произвольный текст или HTML                    |
| `status`      | TaskStatus   | да          | См. статусы ниже                               |
| `priority`    | TaskPriority | нет         | `low`, `medium`, `high`, …                     |
| `table_id`    | UUID → Table | нет         | К какому пространству относится                |
| `assignee_id` | UUID → User  | нет         | Исполнитель                                    |
| `created_by`  | UUID → User  | нет         | Кто создал                                     |
| `due_date`    | date         | нет         | Дедлайн (без времени)                          |
| `position`    | integer      | нет         | Порядок в канбан-колонке                       |
| `tags`        | string[]     | да          | Массив тегов (макс. 20, см. §0)                |
| `is_archived` | boolean      | да          | Архивированные не показываются по умолчанию    |
| `version`     | integer      | да*         | Optimistic locking, см. §0 (*целевой контракт) |


**Статусы (`TaskStatus`):**

```
todo → in_progress → review → done
                           ↓
                        cancelled

Переходы:
  todo → in_progress, cancelled
  in_progress → review, done, cancelled, todo (возврат)
  review → done, in_progress (возврат), cancelled
  done → in_progress (переоткрыть)
  cancelled → todo (разархивировать)
```

**Связанные сущности:**

- `task_comments` — комментарии (отдельная таблица)
- `task_attachments` — вложения (отдельная таблица)

**Вычисляемые поля (read model / API, не обязательно отдельные колонки в БД):**

- `**is_overdue`:** `due_date < today` (в TZ пользователя или UTC — зафиксировать в API) **и** `status ≠ done` (и не `cancelled`, если так решено продуктом).
- `**is_completed`:** `status = done`.

**Бизнес-правила:**

- Смена статуса → запись в `audit_log`
- Архивация вместо удаления (`is_archived = true`); списки по умолчанию — §0
- **Инвариант канбана:** `**status` и `position` обновляются согласованно** (один запрос / одна транзакция), особенно при drag-and-drop; не обновлять `position` без актуального `status` колонки и наоборот
- Вложения на задачу — не более **20** (§0)
- Переходы `**status`** валидируются **только на сервере** по графу выше

---

## 3. Table / Project — Пространства

**Что это:** иерархия организации задач. `Project` → `Table` → `Task`.

### Project (Проект)


| Поле          | Тип         | Описание         |
| ------------- | ----------- | ---------------- |
| `id`          | UUID        |                  |
| `title`       | string      | Название проекта |
| `description` | text        | Описание         |
| `owner_id`    | UUID → User | Владелец         |
| `is_archived` | boolean     |                  |


### Table (Таблица / Страница)


| Поле         | Тип            | Описание                               |
| ------------ | -------------- | -------------------------------------- |
| `id`         | UUID           |                                        |
| `title`      | string         | Название страницы                      |
| `type`       | TableType      | Тип (определяет UI)                    |
| `project_id` | UUID → Project | К какому проекту                       |
| `config`     | JSONB          | Настройки отображения (колонки, цвета) |
| `position`   | integer        | Порядок в сайдбаре                     |


**Типы таблиц (`TableType`):**


| Тип             | UI                      | Контент                       |
| --------------- | ----------------------- | ----------------------------- |
| `tasks`         | Таблица + Канбан + Гант | Task                          |
| `backlog`       | Список приоритетов      | Task (с оценками)             |
| `functionality` | Список фич              | Task (с описанием)            |
| `content-plan`  | Таблица по датам        | ContentPost                   |
| `meetings`      | Календарь               | Meeting                       |
| `docs`          | Дерево документов       | Doc                           |
| `aggregate`     | Агрегатор задач         | Task (из нескольких проектов) |


---

## 4. Deal — Сделка

**Что это:** потенциальная или состоявшаяся продажа. Центральная сущность CRM.


| Поле                     | Тип           | Обязательно | Описание                                                                                                                 |
| ------------------------ | ------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------ |
| `id`                     | UUID          | да          |                                                                                                                          |
| `title`                  | string        | да          | Название сделки                                                                                                          |
| `stage`                  | DealStage     | да          | Текущая стадия                                                                                                           |
| `funnel_id`              | UUID → Funnel | нет         | К какой воронке                                                                                                          |
| `client_id`              | UUID → Client | нет         | Привязанный клиент                                                                                                       |
| `assignee_id`            | UUID → User   | нет         | Ответственный менеджер                                                                                                   |
| `amount`                 | decimal       | нет         | Сумма сделки; **≥ 0** (CHECK в БД / Pydantic)                                                                            |
| `currency`               | string        | да          | **Whitelist** ISO 4217 (напр. `UZS`, `USD`); значение по умолчанию `UZS`                                                 |
| `closed_at`              | timestamptz   | нет         | Заполняется при первом переходе в `**won`** или `**lost`**; не сбрасывается при админских исключениях без явного правила |
| `version`                | integer       | да*         | Optimistic locking, см. §0 (*целевой контракт)                                                                           |
| `source`                 | DealSource    | нет         | Откуда пришёл лид                                                                                                        |
| `source_chat_id`         | string        | нет         | ID чата в Telegram/Instagram                                                                                             |
| `tags`                   | string[]      | да          |                                                                                                                          |
| `custom_fields`          | JSONB         | да          | Дополнительные поля воронки                                                                                              |
| `funnel_version`         | integer       | нет         | Значение `**Funnel.version`** на момент создания сделки (или согласованное правило обновления)                           |
| `funnel_stages_snapshot` | JSONB         | нет         | Снимок стадий воронки (id, title, order, color…) для истории; изменения живой воронки его не перезаписывают              |
| `lost_reason`            | text          | нет         | Обязательно при переводе в `lost`                                                                                        |
| `is_archived`            | boolean       | да          |                                                                                                                          |


**Стадии (`DealStage`):**

```
new → contacted → negotiation → proposal → won
                                         ↓
                                        lost

Переходы — свободные (кроме):
  won → нельзя вернуть в активную стадию (только admin может)
  lost → нельзя вернуть в активную стадию (только admin может)
  
При переводе в lost: поле lost_reason обязательно
```

**Источники (`DealSource`):**


| Значение    | Откуда                          |
| ----------- | ------------------------------- |
| `telegram`  | Входящее из Telegram            |
| `instagram` | Входящее из Instagram/Messenger |
| `site`      | Форма на сайте                  |
| `manual`    | Создан вручную                  |


**Бизнес-правила:**

- **Переходы стадий** проверяются **только на сервере** по правилам выше и правам RBAC; клиент не может «разрешить» недопустимый переход.
- Каждое изменение стадии — в `audit_log`
- Входящие сообщения (`inbox_messages`) привязаны к сделке через `deal_id`
- `custom_fields` — JSONB, схема определяется настройками воронки
- Сделку без клиента нельзя перевести в `won` (валидация на сервере)
- Списки сделок по умолчанию — `**is_archived = false`** (§0)

---

## 5. Client — Клиент

**Что это:** физическое или юридическое лицо, с которым ведётся работа.


| Поле             | Тип      | Обязательно | Описание                                                                                 |
| ---------------- | -------- | ----------- | ---------------------------------------------------------------------------------------- |
| `id`             | UUID     | да          |                                                                                          |
| `name`           | string   | да          | Имя или название компании                                                                |
| `contact_person` | string   | нет         | Контактное лицо (если юр.лицо)                                                           |
| `phone`          | string   | нет         | **E.164** (например `+998901234567`); хранение и сравнение только в нормализованном виде |
| `email`          | string   | нет         | Нормализация: trim, lower для сравнения дедупа                                           |
| `version`        | integer  | да*         | Optimistic locking, см. §0 (*целевой контракт)                                           |
| `telegram`       | string   | нет         | Username или chat_id                                                                     |
| `instagram`      | string   | нет         | Username                                                                                 |
| `company_name`   | string   | нет         |                                                                                          |
| `company_info`   | text     | нет         | Произвольная информация о компании                                                       |
| `notes`          | text     | нет         | Заметки                                                                                  |
| `tags`           | string[] | да          |                                                                                          |
| `is_archived`    | boolean  | да          |                                                                                          |


**Бизнес-правила:**

- Клиент с активными сделками (`stage ≠ won/lost`) — нельзя архивировать без подтверждения
- **Дедупликация (soft-unique):** жёсткий UNIQUE по `phone`/`email` во всей таблице обычно **не ставим** — лиды могут дублироваться. Вместо этого: нормализованный поиск, ручное/авто **слияние** дублей, при импорте — подсказки «похожий клиент». При необходимости — частичный UNIQUE для `email WHERE email IS NOT NULL` на уровне продукта (осознанное решение + ADR).
- Поиск по phone/email — по нормализованным значениям; индексы см. [DATABASE.md](./DATABASE.md)
- Один клиент может быть привязан к нескольким сделкам
- Списки по умолчанию — `**is_archived = false`** (§0)

---

## 6. Funnel — Воронка

**Что это:** конфигурация процесса продаж: стадии, источники лидов, настройки.


| Поле          | Тип     | Описание                                                                                                                                                     |
| ------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`          | UUID    |                                                                                                                                                              |
| `title`       | string  | Название воронки                                                                                                                                             |
| `version`     | integer | Инкремент при изменении `**stages`** / структуры воронки; сделки хранят ссылку на версию в `**Deal.funnel_version`** + снимок в `**funnel_stages_snapshot`** |
| `stages`      | JSONB   | Список стадий: `[{id, title, color, position}]`                                                                                                              |
| `sources`     | JSONB   | Настройки источников (токены, ключи)                                                                                                                         |
| `is_archived` | boolean |                                                                                                                                                              |


**Структура `sources`:**

```json
{
  "telegram": {
    "token_encrypted": "...",   // зашифрованный Fernet
    "chat_id": "...",
    "enabled": true
  },
  "instagram": {
    "page_id": "...",
    "enabled": true
  },
  "site": {
    "api_key_encrypted": "...", // зашифрованный
    "enabled": true
  }
}
```

**Бизнес-правила:**

- Токены в `sources` — ВСЕГДА зашифрованы в БД, никогда не возвращаются в API
- Стадии из `stages` — могут отличаться от enum `DealStage` (это пользовательские метки)
- Одна воронка = один Telegram-бот токен = один polling цикл
- При **создании Deal** фиксируются `**funnel_version`** и при необходимости `**funnel_stages_snapshot`** на сделке (§4), чтобы последующее редактирование воронки не ломало отображение истории

---

## 7. InboxMessage — Сообщение диалога

**Что это:** входящее или исходящее сообщение в диалоге с лидом. Хранит переписку из Telegram, Instagram, сайта.


| Поле              | Тип           | Обязательно | Описание                                                                                                                          |
| ----------------- | ------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `id`              | UUID          | да          |                                                                                                                                   |
| `deal_id`         | UUID → Deal   | нет         | К какой сделке                                                                                                                    |
| `funnel_id`       | UUID → Funnel | нет         | Через какую воронку                                                                                                               |
| `direction`       | string        | да          | `in` или `out`                                                                                                                    |
| `delivery_status` | string        | нет         | Для `**out`**: `pending` → `sent` / `failed`; для `**in`** обычно `null`                                                          |
| `channel`         | MsgChannel    | да          | Канал коммуникации                                                                                                                |
| `sender_id`       | string        | нет         | Внешний ID отправителя                                                                                                            |
| `sender_name`     | string        | нет         | Имя отправителя                                                                                                                   |
| `body`            | text          | нет         | Текст; лимит в API **4096** символов (ориентир); в БД допускается TEXT большей длины только если провайдер отдаёт длинные подписи |
| `media_type`      | string        | нет         | Например `photo`, `document`, `video`                                                                                             |
| `media_url`       | string        | нет         | URL медиа (через API-прокси / signed URL)                                                                                         |
| `media_id`        | string        | нет         | Внешний ID для скачивания через MTProto                                                                                           |
| `external_msg_id` | string        | нет         | ID в Telegram/Instagram (дедуп)                                                                                                   |
| `is_read`         | boolean       | да          | Прочитано менеджером                                                                                                              |


**Каналы (`MsgChannel`):** `telegram`, `instagram`, `site`, `internal`

**Порядок выборки (лента, cursor):** строго `**ORDER BY created_at DESC, id DESC`** — совпадает с контрактом cursor в [API.md](./API.md) §4.2 и индексом в [DATABASE.md](./DATABASE.md).

**Бизнес-правила:**

- `(channel, external_msg_id)` — UNIQUE (дедупликация при повторных вебхуках)
- `media_url` никогда не содержит «вечную» прямую ссылку на Telegram/Instagram — только прокси API или signed URL (см. [DATABASE.md](./DATABASE.md))
- `body` может быть null при медиа без подписи
- Входящее `direction=in` → счётчик непрочитанных в воронке увеличивается
- Исходящие (`out`): переводы `**delivery_status`** ведутся при отправке во внешний канал

---

## 8. Notification — Уведомление

**Что это:** in-app уведомление для пользователя системы (не для лида).


| Поле          | Тип         | Описание                                              |
| ------------- | ----------- | ----------------------------------------------------- |
| `id`          | UUID        |                                                       |
| `user_id`     | UUID → User | Получатель                                            |
| `type`        | string      | Тип события: `task.assigned`, `deal.stage_changed`, … |
| `title`       | string      | Заголовок                                             |
| `body`        | text        | Текст                                                 |
| `entity_type` | string      | Тип сущности: `task`, `deal`, `message`, …            |
| `entity_id`   | UUID        | ID связанной сущности (для перехода)                  |
| `is_read`     | boolean     |                                                       |
| `created_at`  | timestamptz | Время создания записи                                 |


**Дедупликация:** не создавать повторное уведомление с тем же смыслом в коротком окне (ориентир **15 минут**): ключ вида `(user_id, type, entity_type, entity_id)` или хэш payload — точное правило и TTL в сервисе уведомлений / Redis. Цель — убрать шторм при множественных событиях.

**TTL / retention:** старые записи (**например старше 90 дней**) архивируются или удаляются воркером — согласовано с [DATABASE.md](./DATABASE.md) и операционной политикой.

**Типы уведомлений:**


| Тип                       | Триггер                           |
| ------------------------- | --------------------------------- |
| `task.assigned`           | Задача назначена на пользователя  |
| `task.commented`          | Комментарий к задаче пользователя |
| `task.due_soon`           | Дедлайн через 24ч                 |
| `deal.stage_changed`      | Стадия сделки изменена            |
| `deal.message_received`   | Входящее сообщение по сделке      |
| `message.received`        | Входящее во внутренний чат        |
| `finance.approval_needed` | Заявка ожидает согласования       |
| `bp.step_assigned`        | Следующий шаг БП назначен         |


### NotificationDelivery — Доставка


| Поле              | Тип                 | Описание                                                                |
| ----------------- | ------------------- | ----------------------------------------------------------------------- |
| `id`              | UUID                |                                                                         |
| `notification_id` | UUID → Notification |                                                                         |
| `channel`         | string              | `telegram`, `email` (in-app и internal chat не хранятся в этой таблице) |
| `recipient`       | string              | chat_id / email (фиксируется при создании записи)                       |
| `status`          | string              | см. state machine ниже                                                  |
| `attempts`        | integer             | Число неудачных попыток отправки (макс. **5**, затем `dead`)            |
| `last_error`      | text                | Последняя ошибка                                                        |
| `next_retry_at`   | timestamptz         | Следующая попытка при статусе `retry`                                   |
| `sent_at`         | timestamptz         | Успешная доставка                                                       |


**Индексы:** `status`, `next_retry_at` (и при необходимости составные под выборки воркера).

**State machine доставки:** `pending | retry` (с наступившим `next_retry_at` или без отложенной даты) → `sending` → при успехе `sent`; при ошибке отправки `sending → retry` (выставляется `next_retry_at`, backoff) → снова в очередь → `sending` → … либо после **5** неудачных попыток `→ dead` (DLQ). Ошибки конфигурации (`нет токена бота`, `нет SMTP`, пустой `recipient`, уведомление удалено) — сразу `dead` без ретраев.

**Retry policy:** при ошибке отправки `attempts += 1`, `next_retry_at = now + backoff`. Не более `**MAX_ATTEMPTS = 5`** неудачных попыток; после **5-й** ошибки — только `dead`.


| Значение `attempts` после ошибки | Пауза до следующей попытки |
| -------------------------------- | -------------------------- |
| 1                                | 1 мин                      |
| 2                                | 5 мин                      |
| 3                                | 15 мин                     |
| 4                                | 1 час                      |
| 5                                | — (статус `dead`)          |


---

## 9. Employee — Сотрудник

**Что это:** карточка сотрудника компании. Может быть привязана к `User` (если у сотрудника есть аккаунт), но не обязательно.


| Поле            | Тип               | Описание                    |
| --------------- | ----------------- | --------------------------- |
| `id`            | UUID              |                             |
| `user_id`       | UUID → User       | Если есть аккаунт в системе |
| `department_id` | UUID → Department |                             |
| `position_id`   | UUID → Position   |                             |
| `full_name`     | string            |                             |
| `phone`         | string            |                             |
| `email`         | string            |                             |
| `hire_date`     | date              | Дата приёма                 |
| `birth_date`    | date              |                             |
| `avatar_url`    | string            |                             |
| `status`        | string            | `active`, `dismissed`, …    |
| `is_archived`   | boolean           | Уволенные сотрудники        |


**Бизнес-правила:**

- Архивированные сотрудники не отображаются в списках и не предлагаются в assignee
- `user_id` — необязательная связь: подрядчик может быть сотрудником без аккаунта
- При увольнении: status = `dismissed`, is_archived = true, user.is_active = false (если есть аккаунт)
- **Согласованность с `User`:** если `**user_id` задан**, поля `**email`** / `**phone`** на сотруднике должны **совпадать** с соответствующими полями пользователя (или обновляться единым сценарием при смене профиля). Расхождение при сохранении — **409 Conflict** / валидация, а не «тихий» дрейф данных.

---

## 10. Department / Position — Оргструктура

### Department (Отдел)


| Поле        | Тип               | Описание             |
| ----------- | ----------------- | -------------------- |
| `id`        | UUID              |                      |
| `title`     | string            |                      |
| `parent_id` | UUID → Department | Для иерархии отделов |
| `head_id`   | UUID → Employee   | Руководитель         |


Структура — дерево. `parent_id = null` — корневой отдел.

**Инварианты иерархии:** `**parent_id ≠ id`**; при сохранении проверять отсутствие **циклов** в графе (обход вверх по `parent_id` до `null`). Циклы и самоссылка — отклоняются на сервере.

### Position (Должность)


| Поле            | Тип               | Описание                  |
| --------------- | ----------------- | ------------------------- |
| `id`            | UUID              |                           |
| `title`         | string            |                           |
| `department_id` | UUID → Department | К какому отделу относится |


---

## 11. BusinessProcess / BPInstance — Бизнес-процессы

### BusinessProcess (Шаблон процесса)

**Что это:** регламент — последовательность шагов с ролями и описаниями.


| Поле          | Тип     | Описание                                |
| ------------- | ------- | --------------------------------------- |
| `id`          | UUID    |                                         |
| `title`       | string  | Название регламента                     |
| `description` | text    |                                         |
| `version`     | integer | Версия (инкрементируется при изменении) |
| `is_archived` | boolean |                                         |


### BPStep (Шаг процесса)


| Поле          | Тип                    | Описание                      |
| ------------- | ---------------------- | ----------------------------- |
| `id`          | UUID                   |                               |
| `bp_id`       | UUID → BusinessProcess |                               |
| `title`       | string                 | Название шага                 |
| `description` | text                   | Что нужно сделать             |
| `position`    | integer                | Порядок (1, 2, 3...)          |
| `role`        | string                 | Кто выполняет (название роли) |
| `config`      | JSONB                  | Дополнительные параметры шага |


### BPInstance (Запущенный экземпляр)


| Поле              | Тип                    | Описание                                                                                                        |
| ----------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------- |
| `id`              | UUID                   |                                                                                                                 |
| `bp_id`           | UUID → BusinessProcess | По какому шаблону                                                                                               |
| `bp_version`      | integer                | `**BusinessProcess.version`** на момент **старта** экземпляра; правки шаблона не меняют это число задним числом |
| `started_by`      | UUID → User            |                                                                                                                 |
| `current_step_id` | UUID → BPStep          | Текущий шаг                                                                                                     |
| `status`          | BPIStatus              | `active`, `completed`, `cancelled`, …                                                                           |
| `context`         | JSONB                  | Данные процесса (заполняются при выполнении шагов)                                                              |
| `started_at`      | timestamptz            |                                                                                                                 |
| `completed_at`    | timestamptz            |                                                                                                                 |


**Бизнес-правила:**

- Изменение шаблона (`bp_steps`) не ломает активные экземпляры: они привязаны к `**bp_version`** и конкретным `**BPStep.id`**
- Переход к следующему шагу — только вперёд (нет возврата, только отмена)
- Completed/cancelled экземпляры — иммутабельны
- **Аудит переходов:** каждый переход шага фиксируется в `**audit_log`** (и при необходимости с общим `**action_id`**, §18) либо в отдельной таблице истории шагов — одна точка правды на команду

---

## 12. FinanceRequest — Заявка на оплату

**Что это:** запрос на выплату денег: контрагенту, сотруднику, подрядчику.


| Поле           | Тип           | Описание                                       |
| -------------- | ------------- | ---------------------------------------------- |
| `id`           | UUID          |                                                |
| `title`        | string        | Назначение платежа                             |
| `amount`       | decimal       | Сумма; **всегда > 0**                          |
| `currency`     | string        | Whitelist ISO 4217; по умолчанию `UZS`         |
| `version`      | integer       | Optimistic locking, см. §0 (*целевой контракт) |
| `category`     | string        | Категория расхода                              |
| `counterparty` | string        | Кому платим                                    |
| `requested_by` | UUID → User   |                                                |
| `approved_by`  | UUID → User   | Кто согласовал                                 |
| `status`       | FinanceStatus | State machine                                  |
| `comment`      | text          | Комментарий при отклонении                     |
| `payment_date` | date          | Планируемая дата оплаты                        |
| `paid_at`      | timestamptz   | Фактическая дата оплаты                        |
| `created_at`   | timestamptz   | Создание записи (серверное время)              |
| `updated_at`   | timestamptz   | Последнее обновление (приложение)              |
| `is_archived`  | boolean       | Архив в списках                                |


**Хранение в БД (as-built):** таблица `finance_requests` — `amount` как `**NUMERIC(15,2)`**, `created_at` / `paid_at` / `updated_at` как `**TIMESTAMPTZ`** (где nullable — по схеме); статусы ограничены `**chk_finance_requests_status**` в миграции. Индексы для списков и keyset: `idx_finance_requests_status`, `idx_finance_requests_requested_by`, `idx_finance_requests_created_at_id` — см. [DATABASE.md](./DATABASE.md).

**State machine:**

```
draft → pending → approved → paid
              ↓
           rejected

Переходы:
  draft → pending (отправить на согласование, права: finance.create)
  pending → approved (права: finance.approve)
  pending → rejected (права: finance.approve, comment обязателен)
  approved → paid (права: finance.approve)
  rejected → draft (можно отредактировать и переотправить)
```

**Бизнес-правила:**

- После перехода в `**paid`** — **никаких** мутаций полей заявки (терминальный статус); раньше редактирование ограничено статусами `draft` / `pending` / `rejected` по правилам продукта
- В статусах `**approved`** / `**paid`** не допускается менять сумму, контрагента и прочие бизнес-поля
- При отклонении — `comment` обязателен
- Все переходы логируются в `audit_log`
- Самосогласование: см. §0 (если включено в продукте)

---

## 13. AccountsReceivable — Дебиторка

**Что это:** деньги, которые должны нам (клиент не заплатил за выполненную работу).


| Поле          | Тип           | Описание                                |
| ------------- | ------------- | --------------------------------------- |
| `id`          | UUID          |                                         |
| `client_id`   | UUID → Client |                                         |
| `deal_id`     | UUID → Deal   |                                         |
| `amount`      | decimal       | Сумма долга                             |
| `currency`    | string        |                                         |
| `due_date`    | date          | Когда должны оплатить                   |
| `paid_amount` | decimal       | Сколько уже оплачено                    |
| `paid_date`   | date          |                                         |
| `status`      | ARStatus      | `pending`, `partial`, `paid`, `overdue` |
| `description` | text          |                                         |


**Инвариант сумм:** `**paid_amount ≤ amount`** на уровне БД (CHECK) и API.

**Статус `status`:** не должен расходиться с фактом оплат. Предпочтительно: `**status` вычисляется** при чтении из `amount` / `paid_amount` / `due_date`, либо обновляется **только** в той же транзакции, что и проводки оплаты (одна точка обновления — сервис оплат / доменный метод).

**Правила классификации (логика):**

- `paid_amount = 0`, `due_date > today` → `pending`
- `paid_amount > 0`, `paid_amount < amount` → `partial`
- `paid_amount = amount` → `paid`
- `due_date < today`, не полностью оплачено → `overdue` (пересчёт фоновым воркером или при read)

---

## 14. BDR — Бюджет доходов/расходов

**Что это:** плановые и фактические показатели по статьям бюджета за год.


| Поле   | Тип     | Описание       |
| ------ | ------- | -------------- |
| `id`   | UUID    |                |
| `year` | integer | Год (UNIQUE)   |
| `rows` | JSONB   | Строки бюджета |


**Структура `rows`:**

```json
[
  {
    "id": "uuid",
    "title": "Выручка от услуг",
    "type": "income",
    "values": {
      "2026-01": { "plan": 5000000, "fact": 4800000 },
      "2026-02": { "plan": 5500000, "fact": null }
    }
  }
]
```

**Бизнес-правила:**

- Один документ BDR на год
- `**rows`:** структура валидируется **Pydantic-моделью** (или JSON Schema) на запись; произвольный JSON без схемы не принимается
- `fact` — вносится по итогам месяца, может быть null (план без факта)
- Итоги пересчитываются на сервере при каждом запросе (не хранятся)
- Права: просмотр — `finance.view`, изменение — `finance.approve`

---

## 15. ContentPost — Контент-план

**Что это:** единица контента: пост, рилс, статья — запланированная к публикации.


| Поле           | Тип           | Описание                                                                                                            |
| -------------- | ------------- | ------------------------------------------------------------------------------------------------------------------- |
| `id`           | UUID          |                                                                                                                     |
| `table_id`     | UUID → Table  | К какой таблице типа `content-plan`                                                                                 |
| `title`        | string        | Тема/заголовок                                                                                                      |
| `body`         | text          | Текст поста                                                                                                         |
| `platform`     | string        | Whitelist: `instagram`, `telegram`, `tiktok`, `facebook`, `linkedin`, `other` (расширять только через API-контракт) |
| `status`       | ContentStatus |                                                                                                                     |
| `scheduled_at` | timestamptz   | Когда публиковать                                                                                                   |
| `published_at` | timestamptz   | Когда опубликовано                                                                                                  |
| `assignee_id`  | UUID → User   | Ответственный                                                                                                       |
| `tags`         | string[]      |                                                                                                                     |
| `media_urls`   | string[]      | Ссылки на медиа                                                                                                     |


**Статусы:** `draft → ready → scheduled → published / cancelled`

**После `published`:** изменение `**body`**, `**title`**, `**platform**`, медиа — **запрещено** без отдельного механизма (новая версия поста / новая запись). Исправление опечаток только по политике админа, зафиксированной в продукте.

**Публичный доступ:** если таблица помечена `is_public = true`, контент-план виден по публичной ссылке без авторизации (только `scheduled` и `published` посты).

---

## 16. Doc / Folder — Документы

### Folder (Папка)


| Поле        | Тип           | Описание             |
| ----------- | ------------- | -------------------- |
| `id`        | UUID          |                      |
| `title`     | string        |                      |
| `parent_id` | UUID → Folder | Вложенность (дерево) |
| `owner_id`  | UUID → User   |                      |


### Doc (Документ)


| Поле          | Тип           | Описание                                                                                                                                                            |
| ------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`          | UUID          |                                                                                                                                                                     |
| `title`       | string        |                                                                                                                                                                     |
| `content`     | text          | Sanitized HTML; **лимит размера ~1 MiB** на уровне API/БД (защита от злоупотребления)                                                                               |
| `version`     | integer       | Номер версии тела документа; при значимом изменении `**content`** инкремент (история — отдельная таблица `doc_revisions` или снимки в `audit_log`, решение команды) |
| `folder_id`   | UUID → Folder |                                                                                                                                                                     |
| `owner_id`    | UUID → User   |                                                                                                                                                                     |
| `is_public`   | boolean       |                                                                                                                                                                     |
| `public_slug` | string        | UNIQUE, URL для публичного доступа                                                                                                                                  |
| `is_archived` | boolean       |                                                                                                                                                                     |


**Бизнес-правила:**

- `content` ВСЕГДА проходит через DOMPurify перед сохранением и перед рендером
- `public_slug` генерируется автоматически при установке `is_public = true`
- Публичный документ доступен без авторизации по `/docs/{public_slug}`

---

## 17. Meeting — Встреча

**Что это:** запланированная встреча, звонок, событие в календаре.


| Поле           | Тип         | Описание                                            |
| -------------- | ----------- | --------------------------------------------------- |
| `id`           | UUID        |                                                     |
| `title`        | string      |                                                     |
| `description`  | text        |                                                     |
| `starts_at`    | timestamptz | Начало; **UTC**, тип TIMESTAMPTZ                    |
| `ends_at`      | timestamptz | Конец; **UTC**; инвариант `**ends_at ≥ starts_at`** |
| `location`     | string      | Адрес или ссылка на звонок                          |
| `organizer_id` | UUID → User |                                                     |
| `attendees`    | JSONB       | `[{user_id, name, status}]`                         |
| `deal_id`      | UUID → Deal | Если встреча по сделке                              |


**Статус участника:** `invited`, `accepted`, `declined`

**Время:** все моменты хранятся в **UTC** (`TIMESTAMPTZ`); отображение в TZ пользователя — на клиенте.

---

## 18. AuditLog — Аудит-лог

**Что это:** неизменяемая история всех значимых изменений в системе.


| Поле          | Тип         | Описание                                                                                  |
| ------------- | ----------- | ----------------------------------------------------------------------------------------- |
| `id`          | UUID        |                                                                                           |
| `action_id`   | UUID        | Опционально: общий id одной логической операции (несколько строк audit для одной мутации) |
| `entity_type` | string      | Тип сущности: `deal`, `task`, `user`, …                                                   |
| `entity_id`   | UUID        | ID изменённой сущности                                                                    |
| `action`      | string      | `create`, `update`, `delete`, …                                                           |
| `changed_by`  | UUID → User | Кто изменил; `**null` = действие системы** (воркер, миграция, cron)                       |
| `changed_at`  | timestamptz |                                                                                           |
| `old_values`  | JSONB       | Значения до изменения (**без PII/секретов**, см. ниже)                                    |
| `new_values`  | JSONB       | Значения после (**без PII/секретов**)                                                     |
| `request_id`  | string      | Корреляция с логами                                                                       |


**Бизнес-правила:**

- Записи в audit_log НИКОГДА не удаляются и не изменяются
- Только `INSERT` — нет `UPDATE`, нет `DELETE`
- **Чувствительные данные:** в `**old_values` / `new_values` не пишутся** пароли, токены, полные номера карт, секреты интеграций; при необходимости — только маска / факт изменения поля
- Retention: хранить минимум 2 года (подстроить под комплаенс и [DATABASE.md](./DATABASE.md))
- Доступ: только пользователи с `admin.logs`

---

## 19. Связи между сущностями

```
Project
  └── Table (1:N)
        └── Task (1:N)
              ├── task_comments (1:N)
              └── task_attachments (1:N)

Funnel
  ├── Deal (1:N)
  │     ├── Client (N:1)
  │     ├── InboxMessage (1:N)
  │     └── AccountsReceivable (1:N)
  └── InboxMessage (1:N, прямая связь для входящих без сделки)

User
  ├── Task.assignee_id (1:N)
  ├── Deal.assignee_id (1:N)
  ├── Notification (1:N)
  └── Employee.user_id (1:1, опционально)

Employee
  ├── Department (N:1)
  └── Position (N:1)

Department
  └── Department.parent_id (дерево)

BusinessProcess
  └── BPStep (1:N, ordered)
        └── BPInstance (N:1 через bp_id)

FinanceRequest → User (requested_by, approved_by)
BDR — нет FK (standalone, один на год)
AuditLog → любая сущность (полиморфная ссылка через entity_type + entity_id)
```

### Владение и подотчётность

У сущностей с жизненным циклом в бизнес-процессе задаётся **явный владелец или ответственный** (`owner_id`, `assignee_id`, `created_by`, `requested_by`, `organizer_id` и т.д.) — для RBAC, уведомлений и аудита. Справочники (`Funnel`, `Department`, …) могут не иметь «владельца» в смысле исполнителя; это норма. Детали доступа — §0 и OpenAPI.

### Какие сущности существуют независимо


| Сущность | Зависит от   | Примечание            |
| -------- | ------------ | --------------------- |
| User     | —            | Корневая сущность     |
| Client   | —            | Может быть без сделки |
| Funnel   | —            | Конфигурация          |
| Project  | User (owner) |                       |
| BDR      | —            | Standalone            |


### Каскадное удаление (при архивации)

```
Deal архивирован → InboxMessage остаётся (история)
Client архивирован → Deals остаются
Table архивирована → Tasks остаются
BusinessProcess архивирован → BPInstances остаются (история)
User деактивирован → Tasks/Deals остаются (assignee = null)
```

