# Обзор HTTP API

Префикс REST API задаётся `**API_PREFIX**` (по умолчанию `**/api**`). В продакшене базовый URL обычно: `https://tipa.taska.uz/api`.

Детали полей и тел запросов — в роутерах `apps/api/app/routers/*.py` и моделях `apps/api/app/models/`. Сводка таблиц БД: [ENTITIES.md](./ENTITIES.md) (генерируется скриптом `apps/api/scripts/generate_entities_doc.py`). OpenAPI: `GET /openapi.json` при запущенном сервере.

## 1. Авторизация

- Клиент (`backend/api.ts`) при наличии токена в `sessionStorage` отправляет `**Authorization: Bearer <JWT>**`.
- `**POST /api/auth/login**` — получение токена.
- Админские эндпоинты `**/api/admin/***` требуют роль администратора.
- На отдельных data-роутах строгая проверка JWT может отличаться по историческим причинам — перед публикацией API наружу уточняйте политику доступа.

## 2. CORS

`CORSMiddleware`: список origin’ов из `**CORS_ORIGINS**` (строка через запятую). Для форм с внешних сайтов добавьте origin отправителя.

## 3. WebSocket (in-app уведомления)

- **URL:** `ws(s)://<host>/api/notifications/ws/{user_id}` (с тем же префиксом, что и HTTP).
- После создания in-app уведомления сервер может пушить JSON (тип вроде `notification.created`).
- **nginx** должен поддерживать **Upgrade** для WebSocket.

## 4. Вебхуки без префикса `/api`


| Метод    | Путь            | Назначение                                              |
| -------- | --------------- | ------------------------------------------------------- |
| GET/POST | `/webhook/meta` | Meta (Instagram/Messenger): верификация и приём событий |


## 5. REST-модули (префикс `/api`)


| Префикс                    | Файл                           | Кратко                                                                     |
| -------------------------- | ------------------------------ | -------------------------------------------------------------------------- |
| `/auth`                    | `auth.py`                      | Пользователи, JWT, логин                                                   |
| `/tasks`                   | `tasks.py`                     | Задачи                                                                     |
| `/projects`                | `projects.py`                  | Проекты                                                                    |
| `/tables`                  | `tables.py`                    | Таблицы страниц; публичный контент-план: `/public/content-plan/{table_id}` |
| `/activity`                | `activity.py`                  | Лента активности                                                           |
| `/messages`                | `messages.py`                  | Внутренние сообщения inbox/outbox                                          |
| `/statuses`, `/priorities` | `statuses.py`, `priorities.py` | Справочники                                                                |
| `/notification-prefs`      | `notification_prefs.py`        | Каналы уведомлений                                                         |
| `/notification-events`     | `notification_events.py`       | Доменные события                                                           |
| `/notifications`           | `notifications.py`             | Список, unread, read, WS, retention                                        |
| `/automation`              | `automation.py`                | Автоматизация                                                              |
| `/clients`                 | `clients.py`                   | Клиенты                                                                    |
| `/deals`                   | `deals.py`                     | Сделки CRM                                                                 |
| `/employees`               | `employees.py`                 | Сотрудники (карточки HR)                                                   |
| `/accounts-receivable`     | `accounts_receivable.py`       | Дебиторка                                                                  |
| `/docs`, `/folders`        | `docs.py`, `folders.py`        | Документы и папки                                                          |
| `/meetings`                | `meetings.py`                  | Встречи                                                                    |
| `/content-posts`           | `content_posts.py`             | Контент-план                                                               |
| `/shoot-plans`             | `shoot_plans.py`               | Планы съёмок                                                               |
| `/departments`             | `departments.py`               | Отделы                                                                     |
| `/finance`                 | `finance.py`                   | Финансы                                                                    |
| `/bpm`                     | `bpm.py`                       | Должности, процессы                                                        |
| `/inventory`               | `inventory.py`                 | Склад                                                                      |
| `/funnels`                 | `funnels.py`                   | Воронки                                                                    |
| `/weekly-plans`            | `weekly_plans.py`              | Недельные планы                                                            |
| `/integrations/meta`       | `integrations_meta.py`         | Meta (с JWT)                                                               |
| `/integrations/site`       | `integrations_site.py`         | Заявки с сайта, API-ключи                                                  |
| `/integrations/telegram`   | `integrations_telegram.py`     | Исходящие в Telegram лидам                                                 |
| `/admin`                   | `admin.py`                     | Админ-утилиты                                                              |
| `/system`                  | `system.py`                    | Системные логи                                                             |
| `/calendar-feed`           | `calendar_feed.py`             | Календарные фиды (при наличии)                                             |


## 6. Telegram лиды (server-side)

Входящие обрабатываются polling `getUpdates` по токену из настроек воронки (`funnel.sources.telegram`). Offset в БД (`telegram_integration_state`).

## 7. Интеграция: заявки с сайта

Рекомендуемый приём лида:

- `**POST /api/integrations/site/leads`**
- Заголовок `**X-Api-Key: <секрет>`** (ключ из настроек воронки)
- `**Content-Type: application/json**`

Подробности полей — в `integrations_site.py` и документации воронки в приложении.

## 8. Связанные документы

- [ENTITIES.md](./ENTITIES.md) — таблицы и поля БД (автогенерация из моделей).
- [ARCHITECTURE.md](./ARCHITECTURE.md) — события, уведомления, realtime.
- [OPERATIONS.md](./OPERATIONS.md) — порты и переменные окружения.