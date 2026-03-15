# Архитектура monorepo tipa.taska.uz

## 1. Верхнеуровневая схема

**Monorepo**, разделённый по приложениям:

```
apps/
  web/   – Vite + React (SPA)
  api/   – FastAPI + PostgreSQL (JSON API)
  bot/   – Telegram bot (python-telegram-bot)

ops/
  nginx/   – nginx конфиги
  scripts/ – деплой/утилиты

docs/      – документация, ТЗ, миграции
```

### 1.1. Текущий источник данных

- **Единственный источник правды по данным**: `apps/api` + PostgreSQL.
- Firestore/Firebase в этом репозитории считаем **legacy** (используются только как источник для миграции, см. `docs/MIGRATION_FROM_FIRESTORE_TO_POSTGRES.md`).

### 1.2. Слои

```
┌────────────────────────────────────────────────────────────┐
│                    PRESENTATION (apps/web)                │
│  React + Vite, Tailwind, компоненты, страницы, хуки       │
└────────────────────────────────────────────────────────────┘
                            │  HTTP (fetch / apiClient)
┌────────────────────────────────────────────────────────────┐
│                    API (apps/api)                         │
│  FastAPI, роутеры, Pydantic-схемы, бизнес-правила         │
└────────────────────────────────────────────────────────────┘
                            │  async SQLAlchemy
┌────────────────────────────────────────────────────────────┐
│                    DATA (PostgreSQL)                      │
│  Alembic миграции, нормализованные таблицы + JSONB        │
└────────────────────────────────────────────────────────────┘
                            │
┌────────────────────────────────────────────────────────────┐
│                    INTEGRATIONS (apps/bot)                │
│  Telegram-бот, уведомления, интеграции                    │
└────────────────────────────────────────────────────────────┘
```

## 2. Архитектура фронтенда (`apps/web`)

### 2.1. Основные директории

```
apps/web/
  components/   – UI и feature-компоненты
  hooks/        – бизнес-логика фронта (use*Logic)
  services/     – apiClient, telegramService и т.п.
  utils/        – dateUtils, crudUtils и т.д.
  constants/    – константы и справочники
  seed/         – mockData и сиды для демо
  App.tsx       – корневой компонент
  index.tsx     – вход в приложение
```

**Принцип**:  
- `components` – максимально “тупые” и переиспользуемые.  
- `hooks` – знают про доменную модель (tasks, deals и т.п.).  
- `services` – знают только про HTTP/интеграции, но не про UI.

### 2.2. Связь с backend

- Весь доступ к API идёт через `services/apiClient.ts`.
- URL backend’а задаётся через конфиг/окружение, в dev режиме – прокси Vite (`/api` → `localhost:8000`).

## 3. Архитектура backend (`apps/api`)

### 3.1. Основные элементы

- `app/main.py` – точка входа FastAPI.
- `app/models/*` – SQLAlchemy модели.
- `app/routers/*` – роутеры по модулям (tasks, crm, finance, inventory, bpm и т.д.).
- `app/database.py` – engine, session, Base.
- `alembic/` – миграции, **актуальная схема БД**.

Backend отвечает за:
- валидацию и нормализацию входных данных,
- маппинг legacy-модели (из Firestore/TS типов) в Postgres,
- бизнес-правила (архив/soft-delete, связи задач с процессами, CRM и т.д.).

### 3.2. Стабильный контракт

Фронт общается с backend’ом через REST JSON API, пути документированы в Swagger (`/docs`).  
Модель данных фронта синхронизируется с backend’ом через:
- Alembic миграции,
- Pydantic-схемы (постепенно),
- `types.ts` в `apps/web` (типизация интерфейса).

## 4. Telegram-бот (`apps/bot`)

- Работает поверх API backend’а (`apps/api`), не напрямую с БД.
- Использует очереди/шедулер для уведомлений и фоновых задач.
- Конфигурация и деплой описаны в `docs/tz/telegram-bot/*` и `ops/scripts/deploy.sh`.

## 5. Документация

- Архитектура высокого уровня: этот файл.
- Детальная архитектура модулей/БД: `docs/tz/**/*`, `docs/tz/database/DATABASE_SCHEMA.md`.
- Миграция с Firestore: `docs/MIGRATION_FROM_FIRESTORE_TO_POSTGRES.md`.

Исторические документы про Firebase/старый backend оставлены в `docs/` и `docs/tz/` **как legacy**, но актуальная прод-архитектура описана здесь и в `apps/api/README.md`.
