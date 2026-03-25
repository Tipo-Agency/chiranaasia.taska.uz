# База данных (PostgreSQL)

## Источник правды

- **Модели:** `apps/api/app/models/*.py` — имена таблиц в `__tablename__`.
- **Миграции:** `apps/api/alembic/versions/` — последовательность отражена в именах файлов (`001_…` … `007_…`).

При изменении схемы: правка модели → новая миграция Alembic → деплой (миграции выполняются при старте API).

## Сводная таблица

Группировка по файлам моделей. Колонки детально смотрите в соответствующем классе SQLAlchemy.

### Пользователи и доступ

| Таблица | Модель | Назначение |
|---------|--------|------------|
| `users` | `User` | Учётные записи, роли, архивация |

### Задачи и проекты

| Таблица | Модель | Назначение |
|---------|--------|------------|
| `projects` | `Project` | Проекты |
| `tasks` | `Task` | Задачи |

### Настройки и справочники (таблицы Kanban и т.д.)

| Таблица | Модель | Назначение |
|---------|--------|------------|
| `tables` | `TableCollection` | Коллекции/«таблицы» (контент-план, бэклог, …) |
| `statuses` | `StatusOption` | Статусы |
| `priorities` | `PriorityOption` | Приоритеты |
| `activity` | `ActivityLog` | Лента активности |
| `inbox_messages` | `InboxMessage` | Входящие сообщения |

### Уведомления и автоматизация

| Таблица | Модель | Назначение |
|---------|--------|------------|
| `notification_prefs` | `NotificationPreferences` | Настройки уведомлений (в т.ч. Telegram group id и служебные поля) |
| `automation_rules` | `AutomationRule` | Правила автоматизации |
| `notification_events` | `NotificationEvent` | Канонический журнал доменных событий для шины уведомлений |
| `notifications` | `Notification` | Уведомления для центра уведомлений пользователя |
| `notification_deliveries` | `NotificationDelivery` | Статусы доставки по каналам (in-app/chat/telegram/email) |

### CRM

| Таблица | Модель | Назначение |
|---------|--------|------------|
| `clients` | `Client` | Клиенты |
| `deals` | `Deal` | Сделки |
| `employee_infos` | `EmployeeInfo` | Карточки сотрудников |
| `accounts_receivable` | `AccountsReceivable` | Дебиторка |
| `sales_funnels` | `SalesFunnel` | Воронки продаж |

### Контент и документы

| Таблица | Модель | Назначение |
|---------|--------|------------|
| `docs` | `Doc` | Документы |
| `folders` | `Folder` | Папки |
| `meetings` | `Meeting` | Встречи |
| `content_posts` | `ContentPost` | Посты контент-плана (даты, формат, статус, привязка к `table_id`) |

### Финансы

| Таблица | Модель | Назначение |
|---------|--------|------------|
| `departments` | `Department` | Подразделения (в т.ч. `is_archived`) |
| `finance_categories` | `FinanceCategory` | Категории |
| `funds` | `Fund` | Фонды |
| `finance_plan` | `FinancePlan` | Фин. план (legacy-имя таблицы) |
| `purchase_requests` | `PurchaseRequest` | Заявки на закупку |
| `financial_plan_documents` | `FinancialPlanDocument` | Документы финпланирования |
| `financial_plannings` | `FinancialPlanning` | Планирование |
| `bank_statements` | `BankStatement` | Банковские выписки |
| `bank_statement_lines` | `BankStatementLine` | Строки выписок |
| `income_reports` | `IncomeReport` | Справки о доходах |
| `bdr` | `Bdr` | БДР: один документ на год, строки и суммы по месяцам в **JSONB** (`rows`) |

### BPM и склад

| Таблица | Модель | Назначение |
|---------|--------|------------|
| `org_positions` | `OrgPosition` | Должности |
| `business_processes` | `BusinessProcess` | Бизнес-процессы |
| `warehouses` | `Warehouse` | Склады |
| `inventory_items` | `InventoryItem` | Номенклатура |
| `stock_movements` | `StockMovement` | Движения |
| `inventory_revisions` | `InventoryRevision` | Ревизии |

### Документы «недельные планы» и протоколы

| Таблица | Модель | Назначение |
|---------|--------|------------|
| `weekly_plans` | `WeeklyPlan` | Недельные планы сотрудников |
| `protocols` | `Protocol` | Протоколы (агрегация по участникам) |

### Система

| Таблица | Модель | Назначение |
|---------|--------|------------|
| `system_logs` | `SystemLog` | Логи приложения |

## JSONB и кастомные структуры

- **`bdr.rows`** — массив объектов строк БДР (доход/расход, суммы по ключам `YYYY-MM`).
- Другие модели могут хранить структурированные поля в JSON/JSONB — смотрите определение колонки в модели.

## Связи

Связи задаются через `ForeignKey` и отношения SQLAlchemy в тех же файлах моделей. ER-диаграмма в документации не хранится — при необходимости строится из моделей или pgAdmin.
