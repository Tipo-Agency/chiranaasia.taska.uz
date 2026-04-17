# Finance — Финансы

## Назначение

Finance покрывает весь финансовый цикл компании:

- **Заявки на оплату** — процесс согласования расходов (draft → paid)
- **Финансовое планирование (БДР)** — бюджет доходов и расходов по отделам и периодам
- **Дебиторская задолженность** — контроль входящих платежей от клиентов
- **Банковские выписки** — загрузка транзакций и автосверка с заявками
- **Отчёты о доходах** — фактические доходы по периодам
- **Сверка расходов** — сопоставление строк выписки с заявками

---

## Пользователи и права


| Роль                | Право                | Что может                                                                   |
| ------------------- | -------------------- | --------------------------------------------------------------------------- |
| Сотрудник           | `finance.finance`    | Создавать заявки, просматривать финансы                                     |
| Руководитель        | `finance.finance`    | То же + видеть заявки отдела                                                |
| Финансовый директор | `finance.approve`    | Одобрять/отклонять заявки; одобрять финпланы; редактировать прошлые периоды |
| Администратор       | `system.full_access` | Всё включая редактирование прошлых периодов                                 |


**Ключевые разграничения:**

- `finance.approve` обязателен для: approved/rejected/paid переходов; одобрения финпланов
- Прошлые периоды (прошлые годы/месяцы): только `system.full_access`

---

## 1. Заявки на оплату (Finance Requests)

### Таблица `finance_requests`


| Колонка            | Тип БД        | Nullable | Дефолт     | Описание                         |
| ------------------ | ------------- | -------- | ---------- | -------------------------------- |
| `id`               | String(36)    | NO       | auto UUID  | PK                               |
| `version`          | Integer       | NO       | 1          | Optimistic locking               |
| `title`            | String(500)   | NO       | —          | Назначение платежа               |
| `amount`           | Numeric(15,2) | NO       | —          | Сумма                            |
| `currency`         | String(10)    | NO       | 'UZS'      | Валюта                           |
| `category`         | String(100)   | YES      | —          | Категория расхода                |
| `counterparty`     | String(255)   | YES      | —          | Контрагент                       |
| `requested_by`     | String(36)    | YES      | —          | FK→users (SET NULL)              |
| `approved_by`      | String(36)    | YES      | —          | FK→users (SET NULL)              |
| `status`           | String(30)    | NO       | 'draft'    | Статус (state machine)           |
| `comment`          | Text          | YES      | —          | Комментарий (причина отклонения) |
| `payment_date`     | Date          | YES      | —          | Дата оплаты                      |
| `paid_at`          | DateTime(TZ)  | YES      | —          | Когда фактически оплачено        |
| `created_at`       | DateTime(TZ)  | NO       | func.now() | Создана                          |
| `updated_at`       | DateTime(TZ)  | YES      | —          | Обновлена                        |
| `is_archived`      | Boolean       | NO       | false      | Архив                            |
| `attachments`      | JSONB         | YES      | []         | Вложения (счета, акты)           |
| `counterparty_inn` | String(32)    | YES      | —          | ИНН контрагента                  |
| `invoice_number`   | String(100)   | YES      | —          | Номер счёта                      |
| `invoice_date`     | Date          | YES      | —          | Дата счёта                       |


**Индекс:** `idx_finance_requests_created_at_id` на (created_at, id) — для cursor pagination.

**Embedded в comment (legacy теги):**

```
[departmentId:UUID]     — отдел, встроен в текст комментария
[paymentDate:YYYY-MM-DD] — дата оплаты
```

Функции `extract_department_id(comment)` и `extract_payment_date_tag(comment)` парсят теги.
`strip_embedded_tags(comment)` возвращает чистый текст для отображения.

### Машина состояний

```
Создание: статус должен быть "draft" или "pending"
          "deferred" → нормализуется в "draft"
          неизвестный статус → "draft"

Переходы:
  draft    ──────────────────→ pending
  pending  ──→ approved             (требует finance.approve + проверку бюджета)
  pending  ──→ rejected             (требует finance.approve + обязателен comment)
  approved ──→ paid                 (требует finance.approve)
  rejected ──→ (терминальный)
  paid     ──→ (терминальный)
```

### Блокировка полей после перехода

```
После approve или paid заявка ЗАБЛОКИРОВАНА.
Можно изменять ТОЛЬКО:
  is_archived      (архивировать всегда можно)
  attachments      (добавлять документы после оплаты)
  counterparty_inn (для сверки с банком)
  invoice_number   (для сверки с банком)
  invoice_date     (для сверки с банком)
  status           (только если approved → paid)

Попытка изменить другое поле: HTTP 400 { "detail": "finance_request_locked" }
```

### Проверка бюджета при одобрении

```
Логика assert_budget_fund_allows_approval():
1. Парсим amount в Decimal
2. Ищем FinancialPlanning содержащие этот request_id
3. Если не в планировании → сразу разрешаем
4. Для каждого планирования:
   → bucket_id = planning.request_fund_ids[request_id] или finance_requests.category (legacy map)
   → если bucket_id не задан: HTTP 400 "finance_request_budget_category_required"
   → allocation = planning.fund_allocations[bucket_id]  (ключ = id из finance_categories)
   → used = сумма amount всех approved заявок в том же фонде (кроме текущей)
   → если used + amount > allocation + 0.01: HTTP 400 "finance_request_budget_insufficient"
   → tolerance 0.01 для ошибок округления
```

### Нормализация сумм

```
Входящий amount: Decimal | string | int | float
  → пустой / null → Decimal("0.00")
  → пробелы → strip
  → запятая → точка (1.234,56 → 1234.56)
  → round(2) → Decimal("1234.56")
```

### Decision date (для отчётности)

```python
if status == "paid" and paid_at:
    decision_date = paid_at
elif status in ("approved", "rejected") and updated_at:
    decision_date = updated_at
else:
    decision_date = None
```

### Требования к полям


| Поле               | Тип API         | Обяз.        | Ограничения               |
| ------------------ | --------------- | ------------ | ------------------------- |
| `title`            | string          | **да**       | 1-500 chars               |
| `amount`           | Decimal/str/int | **да**       | auto-normalize            |
| `currency`         | string          | нет          | default "UZS", ≤10        |
| `status`           | enum            | нет          | default "pending"         |
| `category`         | string          | нет          | ≤100                      |
| `category_id`      | string          | нет          | ≤100, alias categoryId    |
| `counterparty`     | string          | нет          | ≤255                      |
| `counterparty_inn` | string          | нет          | ≤32                       |
| `invoice_number`   | string          | нет          | ≤100                      |
| `invoice_date`     | date            | нет          | —                         |
| `requester_id`     | string          | нет          | ≤36, alias requesterId    |
| `requested_by`     | string          | нет          | ≤36, alias requestedBy    |
| `department_id`    | string          | нет          | ≤36, alias departmentId   |
| `comment`          | text            | при rejected | —                         |
| `approved_by`      | string          | нет          | ≤36, auto-set при approve |
| `payment_date`     | date            | нет          | alias paymentDate         |
| `attachments`      | list            | нет          | список файлов             |


### API-эндпоинты

```
GET  /api/finance/requests
  ?status=pending|draft|approved|rejected|paid
  ?category=...
  ?date=YYYY-MM-DD         (один день: created_at)
  ?dateFrom=YYYY-MM-DD
  ?dateTo=YYYY-MM-DD
  ?limit=50 (1-500)
  ?cursor=...

POST /api/finance/requests
  body: FinanceRequestCreate
  response 201: FinanceRequestRead

PATCH /api/finance/requests/{id}
  header: If-Match: "5" (опционально)
  body: FinanceRequestPatch (все опционально + version)
  → Переход статуса: только при наличии finance.approve
  response 200: FinanceRequestRead
```

---

## 2. Категории и Фонды

### Категории расходов (FinanceCategory)

Справочник типов расходов. Если в БД нет записей — возвращаются seed данные.

**Дефолтные категории (seed_data.py):**


| id  | Название       | Тип     | Значение | Цвет                          |
| --- | -------------- | ------- | -------- | ----------------------------- |
| fc1 | ФОТ (Зарплаты) | percent | 40       | bg-blue-100 text-blue-700     |
| fc2 | Налоги         | percent | 12       | bg-red-100 text-red-700       |
| fc3 | Реклама        | percent | 15       | bg-purple-100 text-purple-700 |
| fc4 | Аренда офиса   | fixed   | 5000000  | bg-orange-100 text-orange-700 |
| fc5 | Сервисы / Софт | fixed   | 1000000  | bg-green-100 text-green-700   |
| fc6 | Дивиденды      | percent | 10       | bg-yellow-100 text-yellow-700 |


**Типы:** `percent` — процент от бюджета, `fixed` — фиксированная сумма в UZS.

**API:**

```
GET /api/finance/categories        → list[FinanceCategoryRead]
PUT /api/finance/categories        → bulk upsert
  item: { id(≤100), name(≤500), type(def:"fixed",≤50), value(Any, опц.), color(≤200), order(≥0,def:0), isArchived(def:false) } — поле `value` не задаётся из настроек фондов (суммы в плане); в PUT обновляется только если ключ передан.
```

### Фонды (единый справочник)

Таблица `finance_categories`: и статьи плана/БДР, и «подушки» бюджета (`fund_allocations` / `fund_movements`), и поле `category` у заявки — один id.

**Пример дефолтных фондов (см. сиды):** `fund-1` … `fund-3` (операционный / закупки / резерв) плюс процентные статьи `fc1` … `fc6`.

---

## 3. Финансовое планирование

### Структура

```
БДР (Бюджет Доходов и Расходов)
  │
  ├── FinancePlanDocument (таблица financial_plan_documents)
  │     Плановый документ по отделу/периоду
  │     Хранит: income, expenses (dict), статус, week_breakdown
  │
  ├── FinancialPlanning (таблица financial_plannings)
  │     Исполнение плана: фактические данные
  │     Хранит: fund_allocations, request_ids, request_fund_ids
  │     При approved/conducted → блокирует IncomeReport
  │
  └── IncomeReport (таблица income_reports)
        Отчёт о фактических доходах
        data: JSONB {date: amount, ...}
        Блокируется planning при conducted/approved
```

### FinancialPlanDocument

**Таблица `financial_plan_documents`:**


| Колонка                      | Тип        | Описание                                    |
| ---------------------------- | ---------- | ------------------------------------------- |
| `id`                         | String(36) | PK                                          |
| `department_id`              | String(36) | Отдел                                       |
| `period`                     | String(10) | Формат YYYY-MM (якорный месяц)              |
| `income`                     | String(50) | Плановый доход                              |
| `expenses`                   | JSONB      | Расходы по категориям {category_id: amount} |
| `status`                     | String(30) | created → approved                          |
| `approved_by`                | String(36) | Кто одобрил                                 |
| `approved_at`                | String(50) | Когда одобрено                              |
| `plan_series_id`             | String(36) | Группа недельных сегментов                  |
| `period_start`, `period_end` | String(20) | YYYY-MM-DD                                  |
| `week_breakdown`             | JSONB      | Недельные срезы                             |


**Правило одобрения:**

```
При PUT /financial-plan-documents:
  → если любой item имеет status="approved" ИЛИ approvedBy/approvedAt set
  → требуется право finance.approve
  → иначе: HTTP 403
```

**Защита прошлых периодов:**

```
guard_finance_yyyy_mm_mutation():
  → парсит period как YYYY-MM
  → если период < текущего месяца:
     → требуется system.full_access
     → иначе: HTTP 403
```

**API:**

```
GET /api/financial-plan-documents    → list
PUT /api/financial-plan-documents    → bulk upsert
  item: { id(≤100), departmentId(≤100), period(≤50), income(Any),
          expenses(dict,def:{}), status(def:"created",≤50),
          createdAt/updatedAt(≤100), approvedBy/approvedAt(≤100),
          isArchived(def:false), periodStart/periodEnd(≤20),
          planSeriesId(≤36), periodLabel(≤120),
          weekBreakdown: list[{start,end(≤20), label(≤240), income, expenses(dict)}] }
```

### FinancialPlanning (Исполнение)

**Правила:**

```
При PUT /financial-plannings:
  → если item.status=="approved"/"conducted" ИЛИ approvedBy/approvedAt set:
     → требуется finance.approve
  → income_report_ids валидируются: отчёты блокируются при approved/conducted
  → plan_document_ids и planDocumentId мёрджатся (single + list → единый список)
```

**Ключевые поля планирования:**

- `fund_allocations`: `{fund_id: amount}` — распределение по фондам
- `request_fund_ids`: `{request_id: fund_id}` — к какому фонду относится заявка
- `request_ids`: `[request_id, ...]` — заявки в этом планировании
- `fund_movements`: список движений фондов
- `expense_distribution`: распределение расходов

### IncomeReport

**Блокировка:**

```
IncomeReport.locked_by_planning_id:
  → устанавливается когда FinancialPlanning → status="conducted"/"approved"
  → снимается когда Planning откатывается (только через Planning, не напрямую)
  → напрямую через PUT /income-reports поле locked_by_planning_id игнорируется (API защищает)
```

---

## 4. БДР (Бюджет Доходов и Расходов)

**Таблица `bdr`:** `UNIQUE(year)` — один документ на год.

```
GET /api/finance/bdr?year=2025
  → возвращает { rows: [...], totals: {...} }
  → year по умолчанию = текущий год
  → totals вычисляются сервером

PUT /api/finance/bdr
  body: { year: "2025", rows: [...] }
  → year обязателен, ровно 4 символа
  → rows sanitize через sanitize_bdr_rows()
  → защита прошлых лет: calendar_year_is_strictly_past(year) → требует system.full_access
```

**Финансовый план (FinancePlan):**

```
GET /api/finance/plan     → одна строка FinancePlanRow | null
PUT /api/finance/plan
  body: list[{ id(≤36), period(def:"month",≤20), salesPlan, currentIncome }]
```

---

## 5. Банковские выписки

**Таблица `bank_statements`** + `**bank_statement_lines**`:

```
BankStatement:
  id, name(≤255), period(YYYY-MM), created_at

BankStatementLine:
  id, statement_id(FK→statements), line_date(YYYY-MM-DD),
  description(≤500), amount(string), line_type("in"|"out")
```

**Семантика PUT:**

```
PUT /api/finance/bank-statements:
  → для каждого statement: ЗАМЕНЯЕТ все существующие lines новыми
  → старые lines → DELETE, новые → INSERT
  → после сохранения: auto_match_fp_expenses_to_paid() — автосверка
    (сопоставляет строки с оплаченными заявками по сумме/дате/контрагенту)

DELETE /api/finance/bank-statements/{id}:
  → CASCADE: удаляет statement + все его lines
```

---

## 6. Сверка расходов (Expense Reconciliation)

**Таблица `finance_reconciliation_groups`:**

```
{
  id:             PK
  line_ids:       JSONB [string] — строки выписки
  request_id:     string — заявка
  manual_resolved: bool — вручную закрыто
}
```

**Семантика:**

```
PUT /api/finance/expense-reconciliation-groups:
  → ПОЛНАЯ ЗАМЕНА: DELETE все существующие, INSERT новые
  → Используется когда пользователь сохраняет сверку целиком
```

---

## 7. Дебиторская задолженность (AR)

**Таблица `accounts_receivable`:**

Контроль платежей от клиентов по сделкам.

```
Поля: id, client_id, deal_id, amount, currency("UZS"), due_date,
      status(произвольная строка), description, paid_amount, paid_date,
      created_at, updated_at, is_archived(false)

API:
GET /api/accounts-receivable    → list[AccountsReceivableRead]
PUT /api/accounts-receivable    → bulk upsert
```

---

## Коды ошибок Finance


| HTTP | Ключ                                        | Когда                                                            |
| ---- | ------------------------------------------- | ---------------------------------------------------------------- |
| 400  | `finance_request_invalid_status`            | Неизвестный статус                                               |
| 400  | `finance_request_invalid_initial_status`    | Создание не с draft/pending                                      |
| 400  | `finance_request_invalid_status_transition` | Запрещённый переход                                              |
| 400  | `finance_request_locked`                    | Изменение locked-полей у approved/paid                           |
| 400  | `finance_request_budget_category_required`  | Нет фонда (category) у заявки в планировании                     |
| 400  | `finance_request_budget_insufficient`       | Лимит фонда в бюджете превышен                                   |
| 403  | —                                           | finance.approve требуется для одобрения/отклонения               |
| 403  | —                                           | system.full_access требуется для редактирования прошлых периодов |
| 409  | `stale_version`                             | Optimistic lock conflict                                         |


---

## Домейн-события


| Событие                            | Когда                   |
| ---------------------------------- | ----------------------- |
| `finance_request.created`          | POST /finance/requests  |
| `finance_request.updated`          | PATCH (не статус)       |
| `finance_request.status.changed`   | PATCH (статус меняется) |
| `finance_category.created/updated` | PUT /finance/categories |


---

## Связи с другими модулями


| Модуль            | Как связан                                                           |
| ----------------- | -------------------------------------------------------------------- |
| **HR**            | requester_id = User/Employee; department_id = Department             |
| **CRM**           | AccountsReceivable.deal_id → сделка; AR.client_id → клиент           |
| **Tasks**         | Задача может нести amount, requester_id, category_id (задача-заявка) |
| **Notifications** | purchase_request.created, purchase_request.status_changed            |


---

## Edge Cases


| Ситуация                                  | Поведение                                                               |
| ----------------------------------------- | ----------------------------------------------------------------------- |
| Одобрить заявку вне планирования          | OK, бюджет не проверяется                                               |
| Одобрить без фонда (category) в планировании | 400 finance_request_budget_category_required                         |
| Бюджет фонда превышен на 0.005 UZS        | OK (tolerance 0.01)                                                     |
| Повторная загрузка выписки                | Все старые строки удаляются, записываются новые; сверка пересчитывается |
| Заблокированный IncomeReport              | Редактировать только через отвязку от Planning                          |
| БДР за прошлый год без system.full_access | 403                                                                     |
| Заявка paid → попытка изменить title      | 400 finance_request_locked                                              |
| Заявка paid → добавить вложение           | OK (attachments разрешены)                                              |


