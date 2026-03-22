# Разработка: фронтенд (`apps/web`)

## Стек

- **React 18**, **TypeScript**, **Vite**
- Стили: **Tailwind CSS** через **PostCSS** (`tailwind.config.js`, `index.css` с `@tailwind`)
- Состояние: кастомные хуки, главный **`useAppLogic`** и слайсы (`frontend/hooks/slices/`)

## Сборка и запуск

| Команда | Действие |
|---------|----------|
| `npm run dev:web` | Dev-сервер (порт 3000) |
| `npm run build:web` | Продакшен-билд → `apps/web/dist` |
| `npm run preview:web` | Превью билда |

## API

Централизованный клиент: **`apps/web/services/apiClient.ts`**.

- Базовый путь: относительный **`/api`** (в проде тот же хост, nginx проксирует на backend).
- JWT: токен сохраняется после логина и подставляется в заголовок `Authorization`.

Типы доменных сущностей: **`apps/web/types.ts`**.

## Авторизация

- **`LoginView`** — вход по логину и паролю.
- Без JWT доступен только публичный маршрут контент-плана (см. `App.tsx`).

## Навигация и URL

- Состояние: `currentView`, `activeTableId`, `activeSpaceTab`, вкладка настроек.
- Синхронизация с адресной строкой: **`utils/urlSync.ts`** + эффекты в **`useAppLogic`** (`history.pushState`, восстановление при загрузке, `popstate`).
- Примеры путей: `/` — рабочий стол, `/tasks`, `/finance`, `/table/:tableId`, `/spaces?space=content-plan`, `/settings?tab=users`.
- Публично (без JWT): **`/content-plan/:tableId`**.

## Уведомления (тосты)

- Один канал: **`showNotification`** в **`useAppLogic`** (дедупликация повторов, таймаут 4 с, сброс при смене раздела).
- UI тоста: **`App.tsx`** (верх страницы).

## Структура папок (кратко)

| Путь | Назначение |
|------|------------|
| `components/` | Экраны, модули, таблицы, модалки |
| `components/modules/` | Обёртки CRM, Finance, HR, Documents, … |
| `frontend/hooks/` | Логика загрузки данных и действий |
| `services/` | HTTP и вспомогательные сервисы |
| `utils/` | Утилиты (парсеры и т.д.) |

## Добавление экрана или сущности

См. **`docs/development/ADD_ENTITY.md`**: типы → API → хук → компонент → пункт меню при необходимости.
