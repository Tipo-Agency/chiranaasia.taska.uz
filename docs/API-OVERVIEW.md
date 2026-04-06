# Обзор API (tipa.taska.uz)

Префикс REST API задаётся переменной **`API_PREFIX`** (по умолчанию **`/api`**). Полный базовый URL в проде обычно: `https://tipa.taska.uz/api`.

Ниже — маршруты по модулям; детали полей смотрите в роутерах `apps/api/app/routers/*.py` и моделях `apps/api/app/models/`.

## Авторизация

- Клиент фронта (`apiClient.ts`) при наличии токена в `sessionStorage` шлёт **`Authorization: Bearer <JWT>`**.
- **Строгая проверка JWT на всех data-роутерах в коде не везде включена** — отдельные ручки открыты для совместимости/исторических причин. **Админские** эндпоинты (`/api/admin/*`) требуют роль администратора (`get_current_user_admin`).
- Логин: **`POST /api/auth/login`** (см. `auth.py`).

Уточняйте перед публикацией наружу: какие ручки считать публичными и нужна ли отдельная защита (API key) для интеграций.

## CORS

`CORSMiddleware`: список origin’ов из **`CORS_ORIGINS`** (строка через запятую, без лишних пробелов). Для форм с внешних сайтов добавьте origin сайта-отправителя.

## WebSocket (in-app уведомления)

- **URL:** `ws(s)://<host>/api/notifications/ws/{user_id}` (с тем же префиксом, что и HTTP).
- Назначение: сервер пушит JSON с типом `notification.created` после создания in-app уведомления.
- Прокси (nginx) должен поддерживать **Upgrade** для WebSocket; иначе клиент отключит WS после ошибки.

## Вебхуки без префикса `/api`

| Метод | Путь | Назначение |
|--------|------|------------|
| GET/POST | `/webhook/meta` | Meta (Instagram/Messenger): верификация и приём событий |

## REST-модули (префикс `/api`)

| Префикс | Файл роутера | Кратко |
|---------|----------------|--------|
| `/auth` | `auth.py` | Пользователи, логин, JWT |
| `/tasks` | `tasks.py` | Задачи |
| `/projects` | `projects.py` | Проекты |
| `/tables` | `tables.py` | Таблицы, публичный контент-план: `/public/content-plan/{table_id}` |
| `/activity` | `activity.py` | Лента активности |
| `/messages` | `messages.py` | Внутренние сообщения inbox/outbox |
| `/statuses`, `/priorities` | `statuses.py`, `priorities.py` | Справочники |
| `/notification-prefs` | `notification_prefs.py` | Настройки каналов уведомлений |
| `/notification-events` | `notification_events.py` | Публикация/просмотр доменных событий |
| `/notifications` | `notifications.py` | Список уведомлений, unread count, read, WS, ручные `deliveries/run`, `retention/run` |
| `/automation` | `automation.py` | Автоматизация |
| `/clients` | `clients.py` | Клиенты |
| `/deals` | `deals.py` | Сделки (CRM): GET/PUT/POST/PATCH/DELETE |
| `/employees` | `employees.py` | Сотрудники |
| `/accounts-receivable` | `accounts_receivable.py` | Дебиторка |
| `/docs`, `/folders` | `docs.py`, `folders.py` | Документы и папки |
| `/meetings` | `meetings.py` | Встречи |
| `/content-posts` | `content_posts.py` | Контент-план |
| `/departments` | `departments.py` | Отделы |
| `/finance` | `finance.py` | Финансы |
| `/bpm` | `bpm.py` | Процессы |
| `/inventory` | `inventory.py` | Склад |
| `/funnels` | `funnels.py` | Воронки |
| `/weekly-plans` | `weekly_plans.py` | Недельные планы |
| `/integrations/meta` | `integrations_meta.py` | Интеграции Meta (с JWT) |
| `/integrations/site` | `integrations_site.py` | Интеграция «Сайт»: API-ключи и приём лидов |
| `/admin` | `admin.py` | БД, health, Redis monitor, тесты, бот — **только админ** |
| `/system` | `system.py` | Системные логи и служебное |

## Telegram лиды (server-side)

Входящие сообщения Telegram для лидов обрабатываются **на сервере** через polling `getUpdates` по токену из настроек воронки:

- `funnel.sources.telegram.enabled = true`
- `funnel.sources.telegram.botToken` задан

Offset хранится в БД (`telegram_integration_state`), при создании сделки эмитится `deal.assigned`, поэтому уведомления приходят сразу.

## Интеграции: заявки с сайта как сделки

Типичный приём лида с внешнего сайта:

- **Рекомендуемый endpoint:** **`POST /api/integrations/site/leads`**
- **Auth:** заголовок **`X-Api-Key: <секрет>`** (ключ генерируется в настройках воронки)
- **`Content-Type: application/json`**

Пример тела:

```json
{
  "title": "Заявка с сайта",
  "name": "Иван",
  "phone": "+998...",
  "email": "mail@example.com",
  "message": "Хочу консультацию",
  "utm": { "source": "google", "medium": "cpc", "campaign": "spring" },
  "metadata": { "page": "/pricing" }
}
```

Сервер сам определяет `funnelId`, `stage`, `assigneeId` по настройкам воронки (и создаёт уведомление назначенному сотруднику).

Перед продом согласуйте необходимость **секрета/API key** на этой ручке — в текущей реализации она может быть без авторизации.

## Сервисные эндпоинты

- **`GET /health`** — health + проверка БД (без `/api`).

## Клиент на фронте

Единая обёртка: `apps/web/services/apiClient.ts` + агрегатор `apps/web/backend/api.ts`.

## Дальнейшая детализация

Полноценная OpenAPI-схема в репозитории не поддерживается как единый артефакт; при необходимости её можно генерировать из FastAPI (`openapi.json`) на запущенном сервере или добавить в CI.
