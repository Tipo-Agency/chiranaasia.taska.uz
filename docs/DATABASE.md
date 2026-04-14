# База данных

PostgreSQL 16. ORM — SQLAlchemy 2 async. Миграции — Alembic.

---

## 1. Соглашения


| Правило | Как |
| ------- | --- |
| PK | `UUID` (`gen_random_uuid()`), тип `UUID` в PG |
| Временны́е метки | `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`; `updated_at` обновляется приложением (или триггером `BEFORE UPDATE`), не оставлять «тихий NULL» без политики |
| Даты | `DATE` (без времени) |
| Деньги / суммы | только **`NUMERIC(15,2)`**; **никогда** `FLOAT` / `DOUBLE PRECISION` для денег |
| Статусы / перечисления | **`VARCHAR(n)` + `CONSTRAINT chk_... CHECK (...)`**; **не использовать** нативный тип PostgreSQL `ENUM` (проще миграции и добавление значений) |
| Именование | индексы префикс **`idx_`**, ограничения проверки **`chk_`**, уникальные при необходимости **`uq_`** |
| FK | явные `FOREIGN KEY`; политика удаления — по смыслу (см. ниже) |
| Архивация vs удаление | **`is_archived`** — скрытие из обычного UI, сущность остаётся в отчётах/админке по правилам продукта; **`deleted_at`** — логическое удаление с сохранением истории и запретом «жёсткого» показа в UI |
| Мягкое удаление | `deleted_at TIMESTAMPTZ NULL` там, где нужна история |
| Частичные индексы | у таблиц с `is_archived` списки по умолчанию индексировать как **`WHERE is_archived = false`** (и аналогичные фильтры), чтобы не раздувать индекс |

**Политика `ON DELETE`:**

- **`CASCADE`** — зависимые дочерние сущности без самостоятельного смысла (комментарии, вложения, строки дочерних таблиц).
- **`SET NULL`** — необязательные бизнес-связи (`assignee_id`, `client_id`, `owner_id` и т.п.), чтобы не терять сущность при удалении связанного пользователя/клиента.

**JSONB:**

- У каждого JSONB-поля должен быть **контракт** (Pydantic / OpenAPI / внутренняя схема): допустимые ключи, типы, обязательность.
- **Валидация на уровне приложения** до записи; БД при необходимости усиливает CHECK или `jsonb_typeof`, но источник правды — приложение.
- JSONB **не заменяет связи**: ссылки на сущности — через **FK**, не через произвольные id внутри JSON.

**Идемпотентность / внешние события:**

- Для событий извне (вебхуки, провайдеры) — **`UNIQUE`** на стабильный внешний ключ (`external_msg_id`, пара `(channel, external_id)` и т.д.), см. `inbox_messages`.

**Медиа:**

- В БД храним **`media_id`** (внешний идентификатор), **`media_url`** как **временный signed URL** или URL прокси API, **не BYTEA** и не постоянные бинарники в строках таблиц; крупные файлы — **объектное хранилище** (S3-совместимое и т.п.).

**Полнотекст (опционально):**

- При необходимости поиска по `tasks.title`, `deals.title` — **`GIN`** на `to_tsvector` (локаль `simple` / `russian` по продукту). В схеме ниже пример для `clients.name` уже есть.

> **Текущая проблема (as-built в репозитории):** часть полей всё ещё `VARCHAR` для дат/UUID/сумм. Это технический долг; новые таблицы и новые колонки — сразу по правилам выше.

---

## 2. Схема таблиц

Перед применением DDL в пустой базе:

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- Опционально для других crypto-хелперов (digest, crypt). В PostgreSQL 16 функция gen_random_uuid()
-- также доступна без расширения; EXTENSION оставляем для переносимости и будущих функций pgcrypto.
```

### `users`

```sql
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(255) NOT NULL,
    email         VARCHAR(255) UNIQUE,
    telegram      VARCHAR(100),
    avatar_url    VARCHAR(500),
    role          VARCHAR(50) NOT NULL DEFAULT 'employee',
    permissions   JSONB NOT NULL DEFAULT '[]',
    password_hash VARCHAR(255) NOT NULL,
    is_active     BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ
);
CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_role  ON users (role);
-- Поиск/фильтр по JSON-массиву прав (если права денормализованы на users; иначе — GIN на roles.permissions)
CREATE INDEX idx_users_permissions ON users USING GIN (permissions);
```

### `tasks`

```sql
CREATE TABLE tasks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title           VARCHAR(500) NOT NULL,
    description     TEXT,
    status          VARCHAR(50) NOT NULL DEFAULT 'todo',
    priority        VARCHAR(20),
    table_id        UUID REFERENCES tables(id) ON DELETE SET NULL,
    assignee_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    due_date        DATE,
    position        INTEGER,
    tags            JSONB NOT NULL DEFAULT '[]',
    is_archived     BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ,
    CONSTRAINT chk_task_status CHECK (status IN (
        'todo','in_progress','review','done','cancelled'
    )),
    CONSTRAINT chk_task_priority CHECK (priority IN (
        'low','medium','high','urgent'
    ) OR priority IS NULL)
);
CREATE INDEX idx_tasks_table_status ON tasks (table_id, status) WHERE is_archived = false;
CREATE INDEX idx_tasks_assignee     ON tasks (assignee_id) WHERE is_archived = false;
CREATE INDEX idx_tasks_created      ON tasks (created_at DESC);
```

### `task_comments`

```sql
CREATE TABLE task_comments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    author_id   UUID REFERENCES users(id) ON DELETE SET NULL,
    body        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ
);
CREATE INDEX idx_task_comments_task ON task_comments (task_id, created_at);
```

### `task_attachments`

```sql
CREATE TABLE task_attachments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    name        VARCHAR(255) NOT NULL,
    url         VARCHAR(1000) NOT NULL,
    size_bytes  BIGINT,
    mime_type   VARCHAR(100),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_task_attachments_task ON task_attachments (task_id);
```

### `tables` (страницы/пространства)

```sql
CREATE TABLE tables (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title       VARCHAR(255) NOT NULL,
    type        VARCHAR(50) NOT NULL DEFAULT 'tasks',
    project_id  UUID REFERENCES projects(id) ON DELETE CASCADE,
    config      JSONB NOT NULL DEFAULT '{}',
    position    INTEGER,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_table_type CHECK (type IN (
        'tasks','backlog','functionality','content-plan',
        'meetings','docs','aggregate'
    ))
);
```

### `projects`

```sql
CREATE TABLE projects (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title       VARCHAR(255) NOT NULL,
    description TEXT,
    owner_id    UUID REFERENCES users(id) ON DELETE SET NULL,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `deals`

```sql
CREATE TABLE deals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title           VARCHAR(500) NOT NULL,
    stage           VARCHAR(50) NOT NULL DEFAULT 'new',
    funnel_id       UUID REFERENCES funnels(id) ON DELETE SET NULL,
    client_id       UUID REFERENCES clients(id) ON DELETE SET NULL,
    assignee_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    amount          NUMERIC(15,2),
    currency        VARCHAR(10) DEFAULT 'UZS',
    source          VARCHAR(50),          -- 'telegram','instagram','site','manual'
    source_chat_id  VARCHAR(100),         -- внешний ID чата
    tags            JSONB NOT NULL DEFAULT '[]',
    custom_fields   JSONB NOT NULL DEFAULT '{}',
    is_archived     BOOLEAN NOT NULL DEFAULT false,
    lost_reason     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ,
    CONSTRAINT chk_deal_stage CHECK (stage IN (
        'new','contacted','negotiation','proposal','won','lost'
    ))
);
CREATE INDEX idx_deals_funnel_stage ON deals (funnel_id, stage) WHERE is_archived = false;
CREATE INDEX idx_deals_client       ON deals (client_id);
CREATE INDEX idx_deals_assignee     ON deals (assignee_id);
CREATE INDEX idx_deals_created      ON deals (created_at DESC);
-- Дедуп и выборки по внешнему чату (Instagram thread, Telegram chat и т.д.)
CREATE INDEX idx_deals_source_chat ON deals (source, source_chat_id)
    WHERE source_chat_id IS NOT NULL;
```

### `clients`

```sql
CREATE TABLE clients (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    contact_person  VARCHAR(255),
    phone           VARCHAR(50),
    email           VARCHAR(255),
    telegram        VARCHAR(100),
    instagram       VARCHAR(255),
    company_name    VARCHAR(255),
    company_info    TEXT,
    notes           TEXT,
    tags            JSONB NOT NULL DEFAULT '[]',
    is_archived     BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ
);
CREATE INDEX idx_clients_name  ON clients USING gin(to_tsvector('russian', name));
CREATE INDEX idx_clients_phone ON clients (phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_clients_email ON clients (email) WHERE email IS NOT NULL;
```

### `funnels`

```sql
CREATE TABLE funnels (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title       VARCHAR(255) NOT NULL,
    stages      JSONB NOT NULL DEFAULT '[]',  -- [{id, title, color, position}]
    sources     JSONB NOT NULL DEFAULT '{}',  -- {telegram: {token}, instagram: {...}}
    is_archived BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `inbox_messages` (диалоги CRM)

```sql
CREATE TABLE inbox_messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id         UUID REFERENCES deals(id) ON DELETE CASCADE,
    funnel_id       UUID REFERENCES funnels(id) ON DELETE SET NULL,
    direction       VARCHAR(10) NOT NULL,     -- 'in' | 'out'
    channel         VARCHAR(20) NOT NULL,     -- 'telegram' | 'instagram' | 'site' | 'internal'
    sender_id       VARCHAR(255),             -- внешний id отправителя
    sender_name     VARCHAR(255),
    body            TEXT,
    media_type      VARCHAR(50),
    media_url       VARCHAR(1000),
    media_id        VARCHAR(255),             -- внешний ID для получения через MTProto
    external_msg_id VARCHAR(255),             -- для дедупликации
    is_read         BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_messages_deal    ON inbox_messages (deal_id, created_at DESC);
-- Стабильная cursor-пагинация: порядок должен совпадать с ORDER BY created_at DESC, id DESC (см. docs/API.md §4.2)
CREATE INDEX idx_messages_cursor ON inbox_messages (deal_id, created_at DESC, id DESC);
CREATE INDEX idx_messages_funnel  ON inbox_messages (funnel_id, created_at DESC);
CREATE INDEX idx_messages_unread  ON inbox_messages (funnel_id, is_read) WHERE is_read = false;
CREATE UNIQUE INDEX idx_messages_dedup ON inbox_messages (channel, external_msg_id)
    WHERE external_msg_id IS NOT NULL;
```

### `notifications`

```sql
CREATE TABLE notifications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type        VARCHAR(100) NOT NULL,
    title       VARCHAR(500),
    body        TEXT,
    entity_type VARCHAR(50),
    entity_id   UUID,
    is_read     BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifs_user_unread ON notifications (user_id, is_read)
    WHERE is_read = false;
CREATE INDEX idx_notifs_user_date   ON notifications (user_id, created_at DESC);
```

### `notification_deliveries`

```sql
CREATE TABLE notification_deliveries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID REFERENCES notifications(id) ON DELETE CASCADE,
    channel         VARCHAR(20) NOT NULL,   -- 'telegram' | 'email' | 'push'
    recipient       VARCHAR(255) NOT NULL,  -- telegram chat_id / email
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
    attempts        INTEGER NOT NULL DEFAULT 0,
    last_error      TEXT,
    next_retry_at   TIMESTAMPTZ,
    sent_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_delivery_status CHECK (status IN (
        'pending','sending','sent','failed','dead'
    ))
);
CREATE INDEX idx_deliveries_pending ON notification_deliveries (status, next_retry_at)
    WHERE status IN ('pending', 'failed');
```

### `notification_events` (доменные события)

```sql
CREATE TABLE notification_events (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type                VARCHAR(100) NOT NULL,
    payload             JSONB NOT NULL DEFAULT '{}',
    triggered_by        UUID REFERENCES users(id) ON DELETE SET NULL,
    published_to_stream BOOLEAN NOT NULL DEFAULT false,
    stream_id           VARCHAR(255),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_nevents_type    ON notification_events (type, created_at DESC);
CREATE INDEX idx_nevents_created ON notification_events (created_at DESC);
```

### `audit_log`

```sql
CREATE TABLE audit_log (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type  VARCHAR(50) NOT NULL,
    entity_id    UUID NOT NULL,
    action       VARCHAR(20) NOT NULL,   -- 'create' | 'update' | 'delete'
    changed_by   UUID REFERENCES users(id) ON DELETE SET NULL,
    changed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    old_values   JSONB,
    new_values   JSONB,
    request_id   VARCHAR(36),
    CONSTRAINT chk_audit_action CHECK (action IN ('create','update','delete'))
);
CREATE INDEX idx_audit_entity ON audit_log (entity_type, entity_id);
CREATE INDEX idx_audit_user   ON audit_log (changed_by, changed_at DESC);
CREATE INDEX idx_audit_date   ON audit_log (changed_at DESC);
```

### `employees`

```sql
CREATE TABLE employees (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    department_id   UUID REFERENCES departments(id) ON DELETE SET NULL,
    position_id     UUID REFERENCES positions(id) ON DELETE SET NULL,
    full_name       VARCHAR(255) NOT NULL,
    phone           VARCHAR(50),
    email           VARCHAR(255),
    hire_date       DATE,
    birth_date      DATE,
    avatar_url      VARCHAR(500),
    status          VARCHAR(30) NOT NULL DEFAULT 'active',
    is_archived     BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_employees_dept ON employees (department_id) WHERE is_archived = false;
CREATE INDEX idx_employees_user ON employees (user_id);
```

### `departments`

```sql
CREATE TABLE departments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title       VARCHAR(255) NOT NULL,
    parent_id   UUID REFERENCES departments(id) ON DELETE SET NULL,
    head_id     UUID REFERENCES employees(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `positions`

```sql
CREATE TABLE positions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title       VARCHAR(255) NOT NULL,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `business_processes`

```sql
CREATE TABLE business_processes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title       VARCHAR(255) NOT NULL,
    description TEXT,
    version     INTEGER NOT NULL DEFAULT 1,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ
);
```

### `bp_steps`

```sql
CREATE TABLE bp_steps (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bp_id       UUID NOT NULL REFERENCES business_processes(id) ON DELETE CASCADE,
    title       VARCHAR(255) NOT NULL,
    description TEXT,
    position    INTEGER NOT NULL,
    role        VARCHAR(100),
    config      JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX idx_bp_steps_bp ON bp_steps (bp_id, position);
```

### `bp_instances`

```sql
CREATE TABLE bp_instances (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bp_id           UUID NOT NULL REFERENCES business_processes(id) ON DELETE CASCADE,
    started_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    current_step_id UUID REFERENCES bp_steps(id) ON DELETE SET NULL,
    status          VARCHAR(30) NOT NULL DEFAULT 'active',
    context         JSONB NOT NULL DEFAULT '{}',
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at    TIMESTAMPTZ,
    CONSTRAINT chk_bpi_status CHECK (status IN ('active','completed','cancelled'))
);
CREATE INDEX idx_bpi_bp     ON bp_instances (bp_id, status);
CREATE INDEX idx_bpi_status ON bp_instances (status) WHERE status = 'active';
```

### `finance_requests` (заявки на оплату)

```sql
CREATE TABLE finance_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title           VARCHAR(500) NOT NULL,
    amount          NUMERIC(15,2) NOT NULL,
    currency        VARCHAR(10) NOT NULL DEFAULT 'UZS',
    category        VARCHAR(100),
    counterparty    VARCHAR(255),
    requested_by    UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_by     UUID REFERENCES users(id) ON DELETE SET NULL,
    status          VARCHAR(30) NOT NULL DEFAULT 'draft',
    comment         TEXT,
    payment_date    DATE,
    paid_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ,
    CONSTRAINT chk_freq_status CHECK (status IN (
        'draft','pending','approved','rejected','paid'
    ))
);
CREATE INDEX idx_freq_status   ON finance_requests (status);
CREATE INDEX idx_freq_requester ON finance_requests (requested_by, created_at DESC);
```

### `accounts_receivable` (дебиторка)

```sql
CREATE TABLE accounts_receivable (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id   UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    deal_id     UUID REFERENCES deals(id) ON DELETE SET NULL,
    amount      NUMERIC(15,2) NOT NULL,
    currency    VARCHAR(10) NOT NULL DEFAULT 'UZS',
    due_date    DATE NOT NULL,
    paid_amount NUMERIC(15,2),
    paid_date   DATE,
    status      VARCHAR(30) NOT NULL DEFAULT 'pending',
    description TEXT,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_ar_status CHECK (status IN ('pending','partial','paid','overdue'))
);
CREATE INDEX idx_ar_client ON accounts_receivable (client_id);
CREATE INDEX idx_ar_status ON accounts_receivable (status) WHERE is_archived = false;
CREATE INDEX idx_ar_due    ON accounts_receivable (due_date) WHERE status != 'paid';
```

### `bdr` (бюджет доходов/расходов)

```sql
CREATE TABLE bdr (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    year       INTEGER NOT NULL,
    rows       JSONB NOT NULL DEFAULT '[]',
    updated_at TIMESTAMPTZ,
    UNIQUE (year)
);
```

### `bank_statements`

```sql
CREATE TABLE bank_statements (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(255),
    period     VARCHAR(20),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `bank_statement_lines`

```sql
CREATE TABLE bank_statement_lines (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    statement_id UUID NOT NULL REFERENCES bank_statements(id) ON DELETE CASCADE,
    line_date    DATE NOT NULL,
    description  VARCHAR(500),
    amount       NUMERIC(15,2) NOT NULL,
    line_type    VARCHAR(10) NOT NULL,
    matched_req  UUID REFERENCES finance_requests(id) ON DELETE SET NULL,
    CONSTRAINT chk_bsl_line_type CHECK (line_type IN ('debit', 'credit'))
);
CREATE INDEX idx_bsl_statement ON bank_statement_lines (statement_id, line_date);
```

> **Согласование с API:** в текущем коде приложения для движения денег иногда используются значения `'in' | 'out'`. Перед введением `chk_bsl_line_type` в проде выровнять домен (миграция данных) или ослабить CHECK под фактический контракт.


### `content_posts`

```sql
CREATE TABLE content_posts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_id    UUID REFERENCES tables(id) ON DELETE CASCADE,
    title       VARCHAR(500),
    body        TEXT,
    platform    VARCHAR(50),        -- 'instagram','telegram','tiktok'...
    status      VARCHAR(30) NOT NULL DEFAULT 'draft',
    scheduled_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
    tags        JSONB NOT NULL DEFAULT '[]',
    media_urls  JSONB NOT NULL DEFAULT '[]',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_cpost_status CHECK (status IN (
        'draft','ready','scheduled','published','cancelled'
    ))
);
CREATE INDEX idx_cposts_table   ON content_posts (table_id, status);
CREATE INDEX idx_cposts_sched   ON content_posts (scheduled_at) WHERE status = 'scheduled';
```

### `docs` (документы)

```sql
CREATE TABLE docs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title       VARCHAR(500) NOT NULL,
    content     TEXT,               -- sanitized HTML
    folder_id   UUID REFERENCES folders(id) ON DELETE SET NULL,
    owner_id    UUID REFERENCES users(id) ON DELETE SET NULL,
    is_public   BOOLEAN NOT NULL DEFAULT false,
    public_slug VARCHAR(100) UNIQUE,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ
);
CREATE INDEX idx_docs_folder ON docs (folder_id) WHERE is_archived = false;
```

### `folders`

```sql
CREATE TABLE folders (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title       VARCHAR(255) NOT NULL,
    parent_id   UUID REFERENCES folders(id) ON DELETE SET NULL,
    owner_id    UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `meetings`

```sql
CREATE TABLE meetings (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title       VARCHAR(500) NOT NULL,
    description TEXT,
    starts_at   TIMESTAMPTZ NOT NULL,
    ends_at     TIMESTAMPTZ,
    location    VARCHAR(255),
    organizer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    attendees   JSONB NOT NULL DEFAULT '[]',  -- [{user_id, name, status}]
    deal_id     UUID REFERENCES deals(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_meetings_starts ON meetings (starts_at);
CREATE INDEX idx_meetings_organizer ON meetings (organizer_id);
```

### `automation_rules`

```sql
CREATE TABLE automation_rules (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title     VARCHAR(255),
    rule      JSONB NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `dead_letter_queue`

```sql
CREATE TABLE dead_letter_queue (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    queue_name    VARCHAR(100) NOT NULL,
    message       JSONB NOT NULL,
    error         TEXT,
    attempts      INTEGER NOT NULL,
    failed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    next_retry_at TIMESTAMPTZ,           -- плановый повтор; NULL = только ручной requeue
    resolved      BOOLEAN NOT NULL DEFAULT false,
    resolved_at   TIMESTAMPTZ,
    resolved_by   UUID REFERENCES users(id) ON DELETE SET NULL,
    requeued_at   TIMESTAMPTZ            -- когда отправили обратно в рабочую очередь (опционально)
);
CREATE INDEX idx_dlq_unresolved ON dead_letter_queue (queue_name, failed_at)
    WHERE resolved = false;
CREATE INDEX idx_dlq_retry ON dead_letter_queue (queue_name, next_retry_at)
    WHERE resolved = false AND next_retry_at IS NOT NULL;
```

Повторная постановка (**requeue**): сброс `resolved`, перенос payload в исходный stream / очередь версии `.v1`, аудит в логах.

### `system_logs`

```sql
CREATE TABLE system_logs (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    level      VARCHAR(20) NOT NULL,   -- 'info','warning','error','critical'
    message    TEXT NOT NULL,
    context    JSONB,
    user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_syslogs_level ON system_logs (level, created_at DESC);
```

---

## 3. Retention и архивация данных

| Данные | Политика | Как |
| ------ | -------- | --- |
| **Уведомления** (`notifications`, связанные доставки) | **90 дней** активной жизни в «горячем» виде | После срока — удаление или перенос в архивную таблицу / партицию; выполняет **cron / worker** (аналог текущего retention по уведомлениям), интервал и точная схема — в конфиге |
| **Аудит** (`audit_log`) | **6–12 месяцев** в основной БД | Старые строки — удаление по расписанию или вынос в **cold storage** (отдельная БД, S3 Parquet, и т.д.) по требованиям комплаенса |

Индексы по `created_at` / партиционирование по месяцу облегчают батч-удаление без долгих блокировок.

---

## 4. Индексы (сводная таблица)

Критические индексы, которые **должны существовать** в продакшене:

```sql
-- Задачи
idx_tasks_table_status  — (table_id, status) WHERE is_archived = false
idx_tasks_assignee      — (assignee_id) WHERE is_archived = false
idx_tasks_created       — (created_at DESC)
-- опционально: GIN(to_tsvector(...)) по title — при полнотексте

-- Пользователи (если permissions JSONB на users)
idx_users_permissions   — GIN (permissions)

-- CRM
idx_deals_funnel_stage  — (funnel_id, stage) WHERE is_archived = false
idx_deals_client        — (client_id)
idx_deals_source_chat   — (source, source_chat_id) WHERE source_chat_id IS NOT NULL
idx_messages_deal       — (deal_id, created_at DESC)
idx_messages_cursor     — (deal_id, created_at DESC, id DESC)  -- cursor feed
idx_messages_unread     — (funnel_id, is_read) WHERE is_read = false
idx_messages_dedup      — UNIQUE (channel, external_msg_id)

-- Уведомления
idx_notifs_user_unread  — (user_id, is_read) WHERE is_read = false
idx_deliveries_pending  — (status, next_retry_at) WHERE status IN (...)

-- DLQ
idx_dlq_retry           — (queue_name, next_retry_at) WHERE resolved = false AND next_retry_at IS NOT NULL

-- Аудит
idx_audit_entity        — (entity_type, entity_id)
idx_audit_date          — (changed_at DESC)

-- Финансы
idx_ar_due              — (due_date) WHERE status != 'paid'
idx_freq_status         — (status)
```

---

## 5. Миграции

```bash
# Создать новую миграцию
cd apps/api
alembic revision --autogenerate -m "add audit_log table"

# Применить
alembic upgrade head

# Откат одного шага
alembic downgrade -1

# Статус
alembic current
alembic history --verbose
```

**Правила:**

- Каждая миграция должна иметь осмысленный `downgrade` (не пустой `pass`, если откат реалистичен).
- **Смена типа колонки** — только через **новую колонку + перенос данных + переключение** в отдельных шагах/деплоях; не «ALTER TYPE» вслепую на больших таблицах.
- **Деструктивные действия** (`DROP`, переименование, удаление enum-значения) — **отдельный деплой/PR** после того как приложение перестало зависеть от старого; не совмещать в одной ревизии с добавлением новой колонки без стратегии.
- В одной миграции избегать связки **drop/rename**, ломающей одновременно старый и новый код.
- Расширения (`CREATE EXTENSION`) — отдельные ревизии при необходимости отката.

---

## 6. Технический долг по типам (план миграции)

### Этап 1 — новые таблицы (сразу правильно)

Все новые таблицы создаются с UUID, TIMESTAMPTZ, NUMERIC — без исключений.

### Этап 2 — критические таблицы (следующие спринты)

Приоритет: `tasks`, `deals`, `clients`, `notifications`, `users`

```sql
-- Пример миграции tasks.id VARCHAR → UUID
-- Шаг 1: добавить колонку
ALTER TABLE tasks ADD COLUMN id_new UUID DEFAULT gen_random_uuid();
-- Шаг 2: заполнить
UPDATE tasks SET id_new = id::uuid WHERE id ~ '^[0-9a-f-]{36}$';
-- Шаг 3: FK update + переименование (в следующем деплое)
```

### Этап 3 — остальные таблицы

`finance_requests`, `employees`, `meetings`, `content_posts`, `docs`

---

## 7. Эксплуатация (краткий runbook)

| Тема | Действие |
| ---- | -------- |
| Лимит длительности запроса приложения | Переменная **`DATABASE_STATEMENT_TIMEOUT_MS`** (мс) в окружении API/воркеров; см. [OPERATIONS.md](./OPERATIONS.md) §6.1 |
| Миграции без обрыва | Alembic не использует пул `app/db/session.py` — таймаут приложения миграции не режет |
| Медленные запросы | `pg_stat_statements`, `EXPLAIN (ANALYZE, BUFFERS)` на копии; индексы — разделы этого файла про индексы и миграции |
| Рост и чистка | Размер таблиц, `autovacuum`, bloat — по метрикам; тяжёлые `CREATE INDEX` — `CONCURRENTLY` в окне обслуживания при необходимости |