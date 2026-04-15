# Индекс и статус документации

Единая точка входа: что описано, насколько это совпадает с кодом, и какие темы помечены как **[TARGET]** (цель, не обещание as-built).

При расхождении приоритет: **код и OpenAPI** для фактического поведения; **[ARCHITECTURE.md](./ARCHITECTURE.md) §13** для сводки [CURRENT] / [TARGET]; детали по областям — в таблице ниже.

---

## 1. Каноничные документы (`docs/`)


| Документ                               | Содержание                                                     | Статус                                                        |
| -------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------- |
| [README.md](./README.md)               | Обзор продукта, навигация, стек, быстрый старт                 | Актуален; P0 и планы — сверять с [SECURITY.md](./SECURITY.md) |
| [DOCUMENTATION.md](./DOCUMENTATION.md) | Этот файл: индекс и остаток                                    | Актуален                                                      |
| [ARCHITECTURE.md](./ARCHITECTURE.md)   | Слои, очереди, WS, воркеры, таксономия ошибок, §13 расхождения | **Основной** для as-built vs цель                             |
| [API.md](./API.md)                     | HTTP-контракт, авторизация, пагинация, enum                    | Актуален                                                      |
| [DATABASE.md](./DATABASE.md)           | Таблицы, типы, индексы, миграции                               | Актуален                                                      |
| [ENTITIES.md](./ENTITIES.md)           | Доменный смысл сущностей, инварианты                           | Актуален; `version` — см. §2 и [API.md](./API.md) optimistic locking                    |
| [QUEUES.md](./QUEUES.md)               | Имена Redis Streams, группы, воркеры, миграция имён, смоук     | Актуален; `queue_depth` в Prometheus — **сделано**            |
| [INTEGRATIONS.md](./INTEGRATIONS.md)   | Meta, Telegram, сайт, объекты, чеклист PR                      | Актуален                                                      |
| [OPERATIONS.md](./OPERATIONS.md)       | Compose, CI, бэкапы, runbook                                   | Актуален                                                      |
| [DECISIONS.md](./DECISIONS.md)         | ADR и решения                                                  | Актуален                                                      |
| [SECURITY.md](./SECURITY.md)           | Политика, P0, сводка статусов                                  | Актуален; XSS редактор / HttpOnly — **as-built**              |
| [FRONTEND.md](./FRONTEND.md)           | SPA, стейт, API-клиент                                         | Актуален                                                      |
| [MODULES.md](./MODULES.md)             | Продуктовые модули (архитектура, компоненты, приёмочные критерии) | Актуален                                                   |
| [modules/crm.md](./modules/crm.md)     | Бизнес-правила CRM: сделки, клиенты, воронки                   | Актуален                                                      |
| [modules/tasks.md](./modules/tasks.md) | Бизнес-правила Tasks                                           | Актуален                                                      |
| [modules/finance.md](./modules/finance.md) | Бизнес-правила Finance: заявки, планирование, БДР          | Актуален                                                      |
| [modules/hr.md](./modules/hr.md)       | Бизнес-правила HR: сотрудники, отделы, должности               | Актуален                                                      |
| [modules/bpm.md](./modules/bpm.md)     | Бизнес-правила BPM: процессы, шаги, экземпляры                 | Актуален                                                      |
| [modules/spaces.md](./modules/spaces.md) | Бизнес-правила Spaces: таблицы, контент, встречи             | Актуален                                                      |
| [modules/auth.md](./modules/auth.md)   | Бизнес-правила Auth: пользователи, роли, права                 | Актуален                                                      |
| [modules/notifications.md](./modules/notifications.md) | Бизнес-правила Notifications: каналы, WS, автоматизации | Актуален                              |
| [TESTING.md](./TESTING.md)             | Pytest, фронт, CI                                              | Актуален                                                      |


### Репозиторные гайды (не в `docs/`)


| Путь                                        | Назначение                           |
| ------------------------------------------- | ------------------------------------ |
| [apps/api/CLAUDE.md](../apps/api/CLAUDE.md) | Конвенции FastAPI-слоя, схемы, тесты |
| [apps/web/CLAUDE.md](../apps/web/CLAUDE.md) | Конвенции фронта, сборка, CI web     |


---

## 2. Закрыто в коде и отражено в документации

- **Очереди:** контракт `queue.<домен>.v1`, воркеры в Compose, async hub, retention — [QUEUES.md](./QUEUES.md), [ARCHITECTURE.md](./ARCHITECTURE.md) §6.
- **Prometheus:** `queue_depth{queue_name}` на `/metrics` — [ARCHITECTURE.md](./ARCHITECTURE.md) §10.3, [QUEUES.md](./QUEUES.md) §«Наблюдаемость», реализация `apps/api/app/core/observability.py`.
- **HTTP / схемы:** основные роуты задач и сделок с `response_model` и Pydantic — [API.md](./API.md); новые внешние контракты — политика strict в [ARCHITECTURE.md](./ARCHITECTURE.md) §13.
- **БД:** схема — [DATABASE.md](./DATABASE.md); эпик выравнивания типов — закрыт (§13).
- **Безопасность (база):** HttpOnly cookie-сессия SPA, CSRF, rate limit, DOMPurify в редакторе документов — [SECURITY.md](./SECURITY.md).
- **CI web:** шаг `npm audit --audit-level=high` (не валит job при moderate/ниже у транзитивов) — [SECURITY.md](./SECURITY.md) сводка.
- **Optimistic locking (бэкенд):** миграция `048_entity_version_optimistic_locking`, колонка `version` и `version_id_col` у **Task**, **Client**, **Deal**, **FinanceRequest**; PATCH с опциональными **`If-Match`** и полем **`version`** в теле; **409** (`stale_version` / concurrent) через проверку и `StaleDataError` на commit. См. [ENTITIES.md](./ENTITIES.md) §0.
- **Optimistic locking (SPA):** поле `version` в типах и мапперах (`taskFromApi`, `clientFromApi`, `dealFromApi`, `purchaseRequestFromApi`); `version` в PATCH там, где одиночные обновления (архив задачи/клиента, заявки finance, восстановление клиента); тост при **409** в `apiClient.fetchJson`. Пакетные `PUT` (задачи/сделки) — без per-row `version` в текущей модели UI.
- **Prometheus:** на `/metrics` дополнительно gauge `inbox_messages_count`, `notification_deliveries_dead_count`, `dlq_unresolved_count` (обновление при scrape, см. `observability.py`); админ JSON `/admin/metrics/queues` без изменений.
- **Логи:** рекурсивное маскирование чувствительных ключей в structlog (JSON в prod/staging) — `observability.py`.
- **Meta webhook:** дедуп повторного тела (SHA256 + Redis `SET NX`, TTL 600 с) — `meta_webhook.py`.
- **CI API:** `ops/scripts/check_api_secrets.sh` (PEM / AKIA-паттерн в `apps/api/app`).

---

## 3. Остаток **[TARGET]** (осознанный бэклог)

Источник по архитектурным строкам — **[ARCHITECTURE.md §13](./ARCHITECTURE.md#13-расхождения-current-vs-target)**.


| Область            | Что остаётся                                                                                                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Сущности / API** | PATCH сделок/задач через bulk `PUT` без per-row `version`; при появлении одиночного PATCH сделок в UI — прокинуть `version`. Расширение `extra=forbid` на новые партнёрские POST — §13 [ARCHITECTURE](./ARCHITECTURE.md). |
| **Prometheus**     | Алертинг и дашборды по новым gauge — эксплуатация.                                                                                                                                               |
| **Безопасность**   | SIEM, полный secret scanning, circuit breaker, единые таймауты HTTP — [SECURITY.md](./SECURITY.md) / §13.                                                                                           |
| **Зависимости**    | Снижение транзитивных moderate (напр. обновления lockfile после `npm audit fix`) — по приоритету; критичные — без откладывания.                                                                                          |
| **Тесты**          | Покрытие `services/` и контрактов — §13.                                                                                                                                                         |
| **Lifespan**       | Дальнейший вынос из lifespan только не обязательного для старта API — §13.                                                                                                                       |
| **Фронт**          | Разбиение крупных хуков/видов, Zustand — [README.md](./README.md), [FRONTEND.md](./FRONTEND.md).                                                                                                 |


---

## 4. Бывшие «cursor tasks»

Папка `docs/cursor-tasks/` и заглушки `docs/CURSOR_TASKS*.md` удалены. Чеклисты и фазы поглощены каноничными файлами выше; новые задачи ведите в трекере / PR, нормы — в соответствующем `docs/*.md`.