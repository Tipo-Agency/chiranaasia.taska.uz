# CRM — Сделки, Клиенты, Воронки, Диалоги

## Назначение

CRM — единый модуль продаж. Покрывает весь путь от первого контакта лида до закрытой сделки
и последующей коммуникации. Состоит из трёх тесно связанных поддоменов:

- **Deals** — центральная сущность; у каждой сделки есть стадия, воронка, клиент, сумма
- **Clients** — справочник контрагентов; к одному клиенту может быть несколько сделок
- **Funnels** — настраиваемые воронки со стадиями и источниками лидов (Telegram, Instagram, сайт)
- **Messages (Inbox)** — переписка с лидами привязанная к сделкам (в отдельном файле `messages.md`)

---

## Пользователи и права


| Роль                 | Права                | Что может                                           |
| -------------------- | -------------------- | --------------------------------------------------- |
| Менеджер по продажам | `crm.sales_funnel`   | Создавать сделки, редактировать, двигать по воронке |
| РОП / Руководитель   | `crm.deals.edit`     | Всё что выше + разблокировать won/lost + bulk PUT   |
| Администратор        | `system.full_access` | Полный доступ без ограничений                       |
| Сотрудник (просмотр) | auth only            | Просматривать список сделок и клиентов              |


**Разграничение:** `crm.sales_funnel` и `crm.deals.edit` — альтернативы для создания/редактирования сделок.
`crm.deals.edit` дополнительно разблокирует терминальные стадии (won/lost) и разрешает bulk PUT.

**Доступ к мессенджерам:** `crm.client_chats` ИЛИ `crm.sales_funnel` ИЛИ `system.full_access`

---

## Сущности и поля БД

### Deal (таблица `deals`)


| Колонка          | Тип БД        | Nullable | Дефолт    | Описание                               |
| ---------------- | ------------- | -------- | --------- | -------------------------------------- |
| `id`             | String(36)    | NO       | auto UUID | Первичный ключ                         |
| `version`        | Integer       | NO       | 1         | Optimistic locking                     |
| `title`          | String(500)   | NO       | —         | Название сделки                        |
| `stage`          | String(100)   | NO       | —         | Текущая стадия                         |
| `funnel_id`      | String(36)    | YES      | —         | Воронка                                |
| `client_id`      | String(36)    | YES      | —         | FK→clients (SET NULL)                  |
| `contact_id`     | String(36)    | YES      | —         | FK→crm_contacts (SET NULL)             |
| `assignee_id`    | String(36)    | YES      | —         | Ответственный (user id)                |
| `amount`         | Numeric(18,2) | NO       | 0         | Сумма                                  |
| `currency`       | String(10)    | NO       | 'UZS'     | Валюта                                 |
| `source`         | String(50)    | YES      | —         | Источник (site/telegram/instagram/...) |
| `source_chat_id` | String(255)   | YES      | —         | ID чата источника                      |
| `tags`           | ARRAY(Text)   | NO       | []        | Теги                                   |
| `custom_fields`  | JSONB         | NO       | {}        | Произвольные поля                      |
| `lost_reason`    | Text          | YES      | —         | Причина проигрыша                      |
| `is_archived`    | Boolean       | YES      | false     | Мягкое удаление                        |
| `contact_name`   | String(255)   | YES      | —         | Legacy: имя контакта                   |
| `created_at`     | String(50)    | NO       | —         | Дата создания (ISO 8601)               |
| `notes`          | Text          | YES      | —         | Заметки                                |
| `project_id`     | String(36)    | YES      | —         | Связанный проект                       |
| `comments`       | JSONB         | YES      | []        | Список комментариев                    |
| `recurring`      | Boolean       | YES      | false     | Повторяющаяся                          |
| `number`         | String(100)   | YES      | —         | Номер договора/сделки                  |
| `status`         | String(30)    | YES      | —         | Legacy статус (не путать со stage)     |
| `description`    | Text          | YES      | —         | Описание                               |
| `date`           | String(50)    | YES      | —         | Дата сделки                            |
| `due_date`       | String(50)    | YES      | —         | Срок                                   |
| `paid_amount`    | String(50)    | YES      | —         | Оплачено                               |
| `paid_date`      | String(50)    | YES      | —         | Дата оплаты                            |
| `start_date`     | String(50)    | YES      | —         | Дата начала                            |
| `end_date`       | String(50)    | YES      | —         | Дата окончания                         |
| `payment_day`    | String(10)    | YES      | —         | День оплаты                            |
| `updated_at`     | String(50)    | YES      | —         | Дата обновления                        |


**Индекс:** нет дополнительных составных индексов (основной — PK).

### Client (таблица `clients`)


| Колонка        | Тип БД      | Nullable | Дефолт    | Описание                |
| -------------- | ----------- | -------- | --------- | ----------------------- |
| `id`           | String(36)  | NO       | auto UUID | Первичный ключ          |
| `version`      | Integer     | NO       | 1         | Optimistic locking      |
| `name`         | String(255) | NO       | —         | Имя/название клиента    |
| `phone`        | String(50)  | YES      | —         | Нормализованный телефон |
| `email`        | String(255) | YES      | —         | Email (lowercase)       |
| `telegram`     | String(100) | YES      | —         | Telegram handle         |
| `instagram`    | String(255) | YES      | —         | Instagram handle        |
| `company_name` | String(255) | YES      | —         | Название компании       |
| `notes`        | Text        | YES      | —         | Заметки                 |
| `tags`         | ARRAY(Text) | NO       | []        | Теги (уникальные)       |
| `is_archived`  | Boolean     | YES      | false     | Мягкое удаление         |


**Связи:** `deals` (1:N), `crm_contacts` (1:N)

### CrmContact (таблица `crm_contacts`)

Контакт — физическое лицо внутри компании-клиента. Создаётся автоматически при наличии
сигналов в сделке (телефон, Telegram, Instagram).


| Колонка       | Тип БД      | Nullable | Описание              |
| ------------- | ----------- | -------- | --------------------- |
| `id`          | String(36)  | NO       | PK                    |
| `version`     | Integer     | NO       | Optimistic locking    |
| `client_id`   | String(36)  | YES      | FK→clients (SET NULL) |
| `name`        | String(255) | NO       | ФИО контакта          |
| `phone`       | String(50)  | YES      | Телефон               |
| `email`       | String(255) | YES      | Email                 |
| `telegram`    | String(100) | YES      | Telegram              |
| `instagram`   | String(255) | YES      | Instagram             |
| `job_title`   | String(255) | YES      | Должность             |
| `notes`       | Text        | YES      | Заметки               |
| `tags`        | ARRAY(Text) | NO       | []                    |
| `is_archived` | Boolean     | YES      | false                 |


### SalesFunnel (таблица `sales_funnels`)


| Колонка                  | Тип БД      | Nullable | Дефолт    | Описание                                |
| ------------------------ | ----------- | -------- | --------- | --------------------------------------- |
| `id`                     | String(36)  | NO       | auto UUID | PK                                      |
| `name`                   | String(255) | NO       | —         | Название воронки                        |
| `color`                  | String(100) | YES      | —         | Цвет                                    |
| `owner_user_id`          | String(36)  | YES      | —         | Владелец / дефолтный исполнитель        |
| `stages`                 | JSONB       | YES      | []        | Список стадий                           |
| `sources`                | JSONB       | YES      | {}        | Источники лидов (зашифрованные секреты) |
| `notification_templates` | JSONB       | YES      | {}        | Шаблоны уведомлений                     |
| `created_at`             | String(50)  | YES      | —         | Дата создания                           |
| `updated_at`             | String(50)  | YES      | —         | Дата обновления                         |
| `is_archived`            | String(10)  | YES      | "false"   | ⚠️ Хранится как STRING, не boolean      |


---

## Детальные бизнес-правила

### Правила сделок

#### Стадии (Stage)

1. Стадии произвольные — определяются пользователем в воронке
2. **Три системных значения** с особым поведением: `new`, `won`, `lost`
3. Нормализация: стадии хранятся как есть (case-sensitive), при проверках — lowercase

#### Терминальные стадии (won/lost)

```
Сделка в won:
  → попытка перевести в любую другую стадию
  → проверяется наличие права crm.deals.edit (или system.full_access)
  → без права: HTTP 403 { "detail": "deal_stage_won_locked" }
  → с правом: переход разрешён

Сделка в lost:
  → попытка перевести в любую другую стадию  
  → HTTP 403 { "detail": "deal_stage_lost_locked" } без crm.deals.edit
```

#### Обязательные условия для won

```
Попытка перевести сделку в stage="won":
  → client_id обязателен
  → если client_id пустой или null: HTTP 400 { "detail": "won_requires_client_id" }
```

#### Обязательные условия для lost

```
Попытка перевести сделку в stage="lost":
  → lost_reason обязателен (непустая строка после strip)
  → если lost_reason пуст: HTTP 422 { "detail": "deal_lost_reason_required" }
```

#### Авто-назначение исполнителя

```
При создании сделки (POST /deals):
  → если assignee_id не указан
  → AND funnel_id указан
  → assignee_id = funnel.owner_user_id (если owner задан)
  → событие deal.assigned НЕ эмитируется при авто-назначении на создание (только при явном)
```

#### Авто-создание контакта (Contact Signals)

```
При создании/обновлении сделки:
  → сервис deal_contact_sync.maybe_ensure_contact_for_deal() срабатывает
  → ищет сигналы в deal.custom_fields:
     - phone: из custom_fields.phone или .contactPhone → нормализация (только цифры + ведущий +)
     - telegram: из custom_fields._legacy.telegram_username → strip @, lowercase, max 100
     - instagram: из custom_fields.instagram / .instagramUsername / .instagram_username → strip @, lowercase

  Если сигналы найдены И client_id задан:
    → ищет CrmContact в той же client_id с совпадением phone/tg/ig
    → если найден: обновляет недостающие каналы, сливает теги, привязывает deal.contact_id
    → если не найден: создаёт новый CrmContact, привязывает к клиенту, сливает теги из custom_fields.contact_tags
  
  Теги контакта: custom_fields.contact_tags, max 50 тегов, каждый max 200 символов
```

#### Оптимистичная блокировка (PATCH)

```
PATCH /deals/{id}
  → Клиент может передать версию двумя способами:
     1. Заголовок: If-Match: "5"
     2. Тело: { "version": 5, ... }
  → Сервер читает текущую версию из БД
  → Если версии не совпадают: HTTP 409 { "detail": "stale_version" } или "concurrent"
  → Если версия не передана: последний write wins (нет защиты)
```

#### Нормализация полей при записи

```
title:         strip(), max 500 chars; default "Новая сделка"
client_id:     strip(), max 36; пустая строка → null
contact_id:    strip(), max 36; пустая строка → null
contact_name:  max 255
amount:        convert to Decimal; invalid → Decimal("0")
currency:      default "UZS", max 10
stage:         default "new", max 100; не может быть пустой строкой
funnel_id:     max 36; пустая строка → null
source:        max 50
source_chat_id: max 255; алиас: telegram_chat_id
tags:          list[str], max 500 тегов, каждый max 500 chars, strip, убирать пустые
custom_fields: dict; telegram_username мёрджится в custom_fields._legacy.telegram_username
lost_reason:   max 10000 chars
notes:         без ограничений
project_id:    max 36
comments:      list[dict], только валидные dict-объекты
assignee_id:   max 36; пустая строка → null
created_by_user_id: max 36
```

#### Мягкое удаление

```
DELETE /deals/{id}:
  → is_archived = True
  → эмитируется deal.archived event
  → данные сохраняются в БД навсегда
  → в GET списке: по умолчанию is_archived фильтруется (null = только не архивированные)
```

### Правила клиентов

1. **Дублирование по id** — попытка создать клиента с существующим id → 409 Conflict
2. **Нормализация телефона** — `normalize_phone()`: убирает пробелы, скобки, тире; сохраняет ведущий `+`; max 50 chars
3. **Нормализация email** — lowercase, strip whitespace, max 255 chars
4. **Теги** — дедублицируются при сохранении (ARRAY(Text) unique values)
5. **Привязка контактов** — при удалении клиента (SET NULL FK) контакты остаются, `client_id` обнуляется
6. **Оптимистичная блокировка** — PATCH поддерживает `If-Match` и `version`

### Правила воронок

1. **Шифрование секретов** — поля `botToken`, `webhookSecret`, `accessToken`, `apiKey` шифруются Fernet перед записью в `sources` JSONB
2. **Маскировка в ответах** — зашифрованные секреты заменяются на флаги `telegramBotTokenSet: true` и т.п.
3. **Мерж при PATCH** — если PATCH не содержит токена, существующий зашифрованный секрет сохраняется (функция `_merge_telegram_sources()`)
4. **Валидация стадий** — каждая стадия обязана иметь `id` и непустой `title` или `label`
5. **Позиции стадий** — поле `position` нормализуется и индексируется по порядку
6. **is_archived** — хранится как строка ("true"/"false"), не boolean — legacy

---

## Полные сценарии использования

### Сценарий 1: Лид из Telegram-бота

```
1. Клиент пишет в Telegram-бот воронки
2. Бот получает update, вызывает POST /integrations/telegram/webhook/{funnel_id}
3. Сервис process_telegram_update_dict() обрабатывает сообщение:
   → находит воронку по funnel_id
   → проверяет is_archived и enabled
   → если чат уже привязан к сделке: добавляет сообщение в InboxMessage
   → если нет: создаёт новую сделку с source="telegram", source_chat_id=chat_id
4. Менеджер видит новое сообщение во Входящих
5. Нажимает "Квалифицировать" → сделка появляется в воронке с stage="new"
6. Менеджер отвечает через POST /integrations/telegram/send { dealId, text }
7. Сообщение доставляется в Telegram, сохраняется как InboxMessage direction="out"
```

### Сценарий 2: Лид с сайта

```
1. Пользователь заполняет форму на сайте
2. Сайт делает POST /integrations/site/leads с X-Api-Key заголовком
3. Система:
   → валидирует API-ключ (SHA256 hash в SiteIntegrationKey)
   → проверяет что site.enabled=true в воронке
   → нормализует телефон и email
   → ищет дубликат: deals где source="site" AND funnel_id=X AND (phone=Y OR email=Z)
   → если дубликат: возвращает 200 { duplicate: true, dealId: "..." }
   → если новый: создаёт Deal с title (default "Заявка с сайта"), source="site"
     * stage = funnel.sources.site.defaultStageId или первая стадия воронки или "new"
     * assignee = funnel.sources.site.defaultAssigneeId или funnel.owner_user_id
     * notes = собирается из message + "Телефон: X" + "Email: Y" + utm параметры
     * custom_fields._site = { phone: normalized_phone, email: normalized_email }
   → если assignee назначен: эмитирует deal.assigned событие
4. Возвращает 201 { duplicate: false, dealId: "...", funnelId: "...", stage: "..." }
```

### Сценарий 3: Закрытие сделки

```
1. Менеджер переводит сделку в stage="won":
   → PATCH /deals/{id} { stage: "won" }
   → Сервер: проверяет client_id != null → 400 "won_requires_client_id" если нет клиента
   → Сервер: проверяет терминальный статус (если was "lost") → 403 "deal_stage_lost_locked"
   → deal.stage.changed событие → уведомление
2. Менеджер (или автоматизация) создаёт заявку на оплату в Finance
```

### Сценарий 4: Проигрыш сделки

```
1. Менеджер переводит в stage="lost":
   → PATCH /deals/{id} { stage: "lost", lost_reason: "Клиент ушёл к конкуренту" }
   → Сервер: lost_reason обязателен → 422 "deal_lost_reason_required" если пуст
   → Сделка блокируется от дальнейших переводов
2. РОП хочет "оживить" сделку:
   → PATCH /deals/{id} { stage: "new" } от пользователя с crm.deals.edit
   → Разблокировка, стадия меняется
```

### Сценарий 5: Параллельное редактирование

```
Менеджер A и менеджер B оба открыли сделку (version=5)
Менеджер A сохраняет: PATCH /deals/{id} { title: "Новое", version: 5 }
  → OK, version становится 6
Менеджер B сохраняет: PATCH /deals/{id} { amount: 100000, version: 5 }
  → 409 Conflict { detail: "stale_version" }
  → Frontend показывает предупреждение, перечитывает сделку (version=6)
  → Менеджер B повторяет с version: 6
```

---

## API-контракт

### GET /api/deals

```
Query params:
  limit        int     1-500, default 50
  cursor       string  Fernet-encrypted keyset cursor (opaque)
  funnel_id    string  exact match
  stage        string  exact match
  assignee_id  string  exact match
  client_id    string  exact match
  source       string  exact match
  is_archived  bool    null = exclude archived, true = only archived
  search       string  ILIKE по title, client.name, client.company_name, client.notes
  sort         string  created_at|updated_at|amount|stage|title (default: created_at)
  order        string  asc|desc (default: desc)

Response 200:
{
  "items": [DealRead, ...],
  "total": 142,
  "limit": 50,
  "next_cursor": "<encrypted>" | null
}

Фингерпринт фильтров: funnel_id+stage+assignee_id+client_id+source+is_archived+search
Смена фильтров при активном cursor → 400 { "detail": "invalid_cursor" }
```

### POST /api/deals

```
Body (DealCreate):
{
  "id":                string ≤36, optional (auto-UUID если отсутствует или невалидный UUID)
  "title":             string 1-500, optional (default "Новая сделка")
  "stage":             string ≤100, optional (default "new")
  "client_id":         string ≤36, optional
  "contact_id":        string ≤36, optional
  "contact_name":      string ≤255, optional
  "amount":            Decimal|string|int|float, optional (default 0)
  "currency":          string ≤10, optional (default "UZS")
  "funnel_id":         string ≤36, optional
  "assignee_id":       string ≤36, optional
  "source":            string ≤50, optional
  "source_chat_id":    string ≤255, optional
  "tags":              list[string], optional (max 500 тегов)
  "custom_fields":     dict, optional
  "lost_reason":       string ≤10000, optional (обязателен при stage=lost)
  "notes":             text, optional
  "project_id":        string ≤36, optional
  "comments":          list[dict], optional
  "created_by_user_id": string ≤36, optional
}

Response 201: DealRead

Права: crm.deals.edit OR crm.sales_funnel
```

### PATCH /api/deals/{deal_id}

```
Headers:
  If-Match: "5"  (опционально, версия для optimistic lock)

Body (DealUpdate — все поля опциональны):
  Все поля из DealCreate плюс:
  "version":    int ≥1 (альтернатива If-Match)
  "is_archived": bool
  "recurring":  bool
  "number":     string ≤100
  "description": text
  "date", "due_date", "start_date", "end_date": string ≤50
  "paid_amount": string ≤50
  "paid_date":  string ≤50
  "payment_day": string ≤10
  "updated_at": string ≤50
  "updated_by_user_id": string ≤36

Response 200: DealRead
Права: crm.deals.edit OR crm.sales_funnel
```

### PUT /api/deals (Bulk upsert)

```
Body: list[DealBulkItem]  (extra="forbid")
  Поля в camelCase:
  id, title, stage, clientId, contactId, contactName, amount, currency,
  funnelId, assigneeId, source, sourceChatId, telegramChatId (alias для sourceChatId),
  tags, customFields, lostReason, notes, projectId, comments,
  isArchived, recurring, number, description, date, dueDate,
  paidAmount, paidDate, startDate, endDate, paymentDay,
  createdAt, updatedAt, createdByUserId, updatedByUserId

Response 200: { "ok": true }
Права: crm.deals.edit (только эта роль, не crm.sales_funnel!)
```

### DELETE /api/deals/{deal_id}

```
Response 200: { "ok": true }
Поведение: is_archived = True (мягкое удаление)
Права: crm.deals.edit OR crm.sales_funnel
```

### GET /api/clients, POST, PATCH, PUT аналогично

```
GET /api/clients:
  ?search=... (ILIKE по name, email, phone, company_name)
  ?is_archived=false
  ?sort=name|company_name|id
  ?order=asc|desc
  Права: auth only

POST /api/clients: body=ClientCreate, права: auth only
PATCH /api/clients/{id}: body=ClientUpdate (partial), поддерживает If-Match/version
PUT /api/clients: bulk, body=list[ClientBulkItem]
```

---

## Коды ошибок CRM


| Код HTTP | Ключ ошибки                 | Когда                                                    |
| -------- | --------------------------- | -------------------------------------------------------- |
| 400      | `won_requires_client_id`    | Перевод в won без client_id                              |
| 400      | `client_not_found`          | client_id не существует в БД                             |
| 400      | `contact_client_mismatch`   | contact_id принадлежит другому клиенту                   |
| 403      | `deal_stage_won_locked`     | Попытка изменить стадию сделки в won без crm.deals.edit  |
| 403      | `deal_stage_lost_locked`    | Попытка изменить стадию сделки в lost без crm.deals.edit |
| 404      | `contact_not_found`         | contact_id не существует                                 |
| 409      | `stale_version`             | Версия в запросе != версии в БД                          |
| 409      | Conflict                    | Дубликат client id при POST /clients                     |
| 422      | `deal_lost_reason_required` | Перевод в lost без lost_reason                           |
| 400      | `invalid_cursor`            | Смена фильтров при активном cursor                       |


---

## Домейн-события (Redis Streams)


| Событие                 | Когда эмитируется                       | Payload                           |
| ----------------------- | --------------------------------------- | --------------------------------- |
| `deal.created`          | POST /deals, PUT bulk (новая)           | title, stage                      |
| `deal.updated`          | PUT bulk (существующая)                 | title, stage                      |
| `deal.stage.changed`    | PATCH/POST при смене stage              | from_stage, to_stage, lost_reason |
| `deal.assigned`         | Назначение/переназначение assignee      | dealId, title, assigneeId, funnel |
| `deal.patched`          | PATCH                                   | список изменённых полей           |
| `deal.archived`         | DELETE                                  | —                                 |
| `client.created`        | POST /clients, PUT bulk (новый)         | name, is_archived                 |
| `client.updated`        | PATCH /clients, PUT bulk (существующий) | name, is_archived                 |
| `sales_funnel.created`  | POST /funnels, PUT bulk (новая)         | name                              |
| `sales_funnel.updated`  | PUT bulk (существующая)                 | name                              |
| `sales_funnel.patched`  | PATCH /funnels                          | список изменений                  |
| `sales_funnel.archived` | DELETE /funnels                         | —                                 |


---

## Связи с другими модулями


| Модуль            | Как связан                                                         |
| ----------------- | ------------------------------------------------------------------ |
| **Finance**       | Stage=won → создаётся Finance Request (через UI или автоматизацию) |
| **Tasks**         | Task.deal_id → задача привязана к сделке; видна в карточке сделки  |
| **Meetings**      | Meeting.deal_id → встреча привязана к сделке                       |
| **BPM**           | BpInstance.context.dealId → процесс запущен для сделки             |
| **Messages**      | InboxMessage.deal_id → переписка лида привязана к сделке           |
| **Notifications** | deal.created, deal.stage.changed → уведомления ответственному      |
| **AR**            | AccountsReceivable.deal_id → дебиторка по сделке                   |


---

## Edge Cases


| Ситуация                               | Поведение системы                                                                                      |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Воронка удалена, сделки в ней остаются | Сделки сохраняются с `funnel_id`; воронка не CASCADE-удаляет                                           |
| Клиент удалён, сделки в нём            | FK SET NULL: `client_id` = null, сделка сохраняется                                                    |
| Контакт удалён                         | FK SET NULL: `contact_id` = null                                                                       |
| Bulk PUT с id не существующей сделки   | Создаётся (upsert)                                                                                     |
| Bulk PUT с id существующей сделки      | Обновляется                                                                                            |
| POST с невалидным UUID в id            | Игнорируется, генерируется новый UUID                                                                  |
| POST без title                         | title = "Новая сделка"                                                                                 |
| PATCH won → same won                   | No-op переход разрешён (from_stage == to_stage)                                                        |
| Два одновременных PATCH без version    | Последний write wins (race condition)                                                                  |
| S3 media в comments                    | GET /deals/{id}/media/signed?key=... возвращает presigned URL; key должен существовать в deal.comments |


