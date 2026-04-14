# tipa.taska.uz — Документация

> Версия 1.0 · апрель 2026  
> Единый источник правды для команды разработки.  
> При конфликте с кодом — этот документ описывает **цель**, код описывает **факт**.

---

## Что это за продукт

**tipa.taska.uz** — корпоративный рабочий стол для команд 10–200 человек. Объединяет трекер задач, CRM с диалогами из Telegram/Instagram, финансы, HR, внутренний чат и интеграции с мессенджерами в одном веб-приложении.

---

## Навигация


| Документ                             | Для кого           | Что внутри                                                                                |
| ------------------------------------ | ------------------ | ----------------------------------------------------------------------------------------- |
| [DOCUMENTATION.md](./DOCUMENTATION.md) | Tech Lead, все    | Индекс всех doc-файлов, статус и остаток [TARGET]                                        |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Tech Lead, Backend | Принципы, слои, схемы, состояние очередей, WebSocket, расхождения текущего с целевым      |
| [DATABASE.md](./DATABASE.md)         | Backend            | Схема всех таблиц с типами, индексы, миграции, технический долг по типам                  |
| [API.md](./API.md)                   | Backend, Frontend  | Все эндпоинты, авторизация, схемы запросов/ответов, пагинация, enum-значения, права       |
| [FRONTEND.md](./FRONTEND.md)         | Frontend           | Структура SPA, роутинг, стейт (Zustand), API-клиент, типизация, Error Boundaries          |
| [ENTITIES.md](./ENTITIES.md)         | Backend, аналитика | Доменные сущности, поля, инварианты; SQL — в [DATABASE.md](./DATABASE.md)                 |
| [MODULES.md](./MODULES.md)           | Вся команда        | Каждый продуктовый модуль: что делает, компоненты, требования, приёмочные критерии        |
| [SECURITY.md](./SECURITY.md)         | Backend, DevOps    | Сводка «сделано / цель / отклонено», CSP+HSTS, JWT+refresh, CSRF+Origin, Redis lockout, env-переменные |
| [INTEGRATIONS.md](./INTEGRATIONS.md) | Backend            | Meta, Telegram Bot, MTProto, сайт, объектное хранилище — протоколы, безопасность, примеры |
| [TESTING.md](./TESTING.md)           | Вся команда        | Стратегия, покрытие, конфигурация pytest/Vitest/Playwright, примеры тестов                |
| [OPERATIONS.md](./OPERATIONS.md)     | DevOps, Backend    | Docker Compose, nginx, CI/CD, миграции, бэкапы, мониторинг, troubleshooting, runbook      |
| [DECISIONS.md](./DECISIONS.md)       | Вся команда        | ADR: почему приняты ключевые решения + фреймворк velocity vs architecture                 |


---

## Стек

```
Frontend:   React 19 · TypeScript · Vite 6 · TailwindCSS 3
Backend:    FastAPI · SQLAlchemy 2 async · Alembic · Uvicorn · slowapi (rate limit)
Database:   PostgreSQL 16
Cache/MQ:   Redis 7 (Streams)
Bot:        python-telegram-bot (отдельный процесс)
Proxy:      nginx (prod) / Vite proxy (dev)
Deploy:     Docker Compose + GitHub Actions
```

---

## Быстрый старт

```bash
# 1. Инфраструктура
docker-compose up -d

# 2. Frontend
npm install && npm run dev:web
# → http://localhost:3000

# 3. Проверка
curl http://localhost:8003/health
```

---

## Карта репозитория

```
tipa.taska.uz/
├── apps/
│   ├── web/                  # React SPA
│   │   ├── components/       # UI, модули, страницы, фичи
│   │   ├── frontend/hooks/   # useAppLogic и слайсы (→ мигрируем на stores/)
│   │   ├── stores/           # Zustand stores (цель)
│   │   ├── services/apiClient.ts  # HTTP-клиент к FastAPI (cookies + CSRF, refresh)
│   │   ├── backend/api.ts    # Обёртка/совместимость со старым API
│   │   └── types/            # Общие TypeScript-типы
│   ├── api/
│   │   ├── app/
│   │   │   ├── main.py           # FastAPI entry
│   │   │   ├── core/             # config, auth, permissions, mappers, …
│   │   │   ├── db/               # session, Base
│   │   │   ├── api/routers/      # HTTP-слой (тонкий)
│   │   │   ├── services/         # use-cases
│   │   │   ├── models/           # SQLAlchemy ORM
│   │   │   ├── schemas/          # Pydantic
│   │   │   └── middleware/
│   │   └── workers/          # Фоновые воркеры (отдельные сервисы в compose)
│   ├── bot/                  # Telegram-бот команды
├── ops/nginx/                # nginx конфиг
├── docs/                     # ← эта документация
└── docker-compose.yml
```

---

## Критические проблемы (P0)

Актуальный перечень и сводка «сделано / цель» — в **[SECURITY.md](./SECURITY.md)** (в т.ч. таблица в начале документа).

Кратко для деплоя: сильный `SECRET_KEY` (≥32, не placeholder), валидные `DATABASE_URL` / `REDIS_URL`, проверка [OPERATIONS.md](./OPERATIONS.md). Редактор документов и cookie-сессия описаны в SECURITY как **сделанные** в as-built; оставшийся техдолг (PII в логах, replay webhooks, и т.д.) помечен там же **[TARGET]**.


---

## Состояние архитектуры

Некоторые решения приняты «по-быстрому». Полное описание расхождений — в [ARCHITECTURE.md §13](./ARCHITECTURE.md#13-расхождения-current-vs-target).

**Что планируется:**


| Приоритет | Задача                                              |
| --------- | --------------------------------------------------- |
| P0        | Секреты и конфиг на проде, оставшиеся P0 из [SECURITY.md](./SECURITY.md) |
| P1        | Расширять строгие Pydantic-тела на новые публичные/партнёрские контракты ([ARCHITECTURE.md](./ARCHITECTURE.md) §13) |
| P1        | Новые индексы БД по мере медленных запросов — [DATABASE.md](./DATABASE.md) |
| P2        | Дальше выносить из `lifespan` только то, что не обязано стартовать с API ([ARCHITECTURE.md](./ARCHITECTURE.md) §13) |
| P2        | Разбивка крупных компонентов (FinanceView, BPMView) |
| P3        | Zustand stores, Тесты, TypeScript strict mode       |


