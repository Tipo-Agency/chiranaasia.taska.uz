# Архитектура фронтенда (apps/web)

SPA на **Vite 6**, **React 19**, **TypeScript**, стили **Tailwind CSS 3**. Сборка статическая; в проде **nginx** отдаёт `dist/`, API на том же хосте по префиксу `/api`.

## 1. Точки входа


| Файл                       | Роль                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------- |
| `index.html`               | Корень HTML                                                                                 |
| `main.tsx`                 | `createRoot`, провайдеры (`NotificationCenterProvider`, `AppToolbarProvider`), рендер `App` |
| `App.tsx`                  | Shell: сайдбар, шапка `AppHeader`, плавающий чат, роутер `AppRouter`, модалки задач и т.д.  |
| `components/AppRouter.tsx` | **Центральный роутер** по `currentView` (строковый идентификатор экрана)                    |


## 2. Состояние и данные

### 2.1 `useAppLogic` (`frontend/hooks/useAppLogic.ts`)

Композиция **слайсов** (задачи, CRM, контент, финансы, BPM, инвентарь, настройки и др.). Наружу отдаёт:

- данные (tasks, deals, tables, …);
- экшены (`saveTask`, `saveDeal`, `setCurrentView`, …);
- флаги UI (модалки, активная таблица).

**Навигация:** `currentView` хранится в `useSettingsLogic` — строковый union (`home`, `tasks`, `sales-funnel`, `table`, …). Синхронизация с URL при необходимости через `history.pushState` / `popstate` (см. код в `useAppLogic`).

### 2.2 Ленивая загрузка данных

`useEffect` по `currentView` и `activeTableId` подгружает нужные срезы через `api.`* (например `loadCRMData`, `loadFinanceData`). Это снижает нагрузку при первом входе.

### 2.3 API-клиент

`backend/api.ts` и связанные модули — обёртки над `fetch` с базой `VITE_API_URL` / относительные пути, заголовок `Authorization: Bearer` из `sessionStorage`.

### 2.4 Контексты


| Контекст                    | Назначение                                                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `NotificationCenterContext` | Непрочитанные уведомления, WebSocket-подключение                                                                    |
| `AppToolbarContext`         | Слоты **ведущего** контента и **правого блока** в шапке (`setLeading`, `setModule`) — табы CRM, фильтры, кнопки «+» |


## 3. Роутинг: `currentView` → экран

`AppRouter` выбирает корневой компонент по `currentView`. Ниже — **основные** значения и что рендерится (файлы в `components/` если не указано иначе).


| `currentView`        | Экран / модуль                                                                                                                                                          |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `home`               | `pages/WorkdeskView` — рабочий стол (дашборд, вложенные вкладки: календарь, документы … через слоты)                                                                    |
| `tasks`              | `pages/TasksPage`                                                                                                                                                       |
| `spaces`             | `SpacesTabsView` — выбор типа пространства и страниц                                                                                                                    |
| `table`              | `modules/SpaceModule` — контент активной **таблицы** (`TableCollection`): задачи, канбан, гант, беклог, контент-план, календарь, документы и т.д. по `activeTable.type` |
| `sales-funnel`       | `modules/CRMHubModule` — воронка, диалоги, клиенты, отказы                                                                                                              |
| `finance`            | `modules/FinanceModule`                                                                                                                                                 |
| `employees`          | `modules/HRModule` (`view="employees"`)                                                                                                                                 |
| `business-processes` | `modules/HRModule` (`view="business-processes"`)                                                                                                                        |
| `production`         | `ProductionView`                                                                                                                                                        |
| `inventory`          | `InventoryView`                                                                                                                                                         |
| `settings`           | `SettingsView` (ленивая загрузка)                                                                                                                                       |
| `chat`               | Полноэкранный чат: `MiniMessenger` + `ClientChatsPage` в `PageLayout`                                                                                                   |
| `inbox`              | `pages/InboxPage`                                                                                                                                                       |
| `search`             | `TableView` в режиме агрегатора (глобальный поиск задач)                                                                                                                |
| `doc-editor`         | `DocEditor` при наличии `activeDoc`                                                                                                                                     |


Значения вроде `meetings`, `docs`, `clients`, `analytics`, `admin` участвуют в **загрузке данных** и навигации из других мест; если для них нет отдельной ветки в `AppRouter`, срабатывает **fallback** на рабочий стол (`home`). Часть сценариев ведёт на `table` с системной страницей или на вкладки `WorkdeskView` / `crmHubTab`.

**Точка расширения:** добавить новый экран → union в `useSettingsLogic` → ветка в `AppRouter` → пункт в `Sidebar` / `AppHeader`.

## 4. Зоны продукта (логические)

### 4.1 Рабочий стол (`home`)

`WorkdeskView`: сводки, задачи, сделки, переходы в CRM/задачи; встроенные слоты для календаря и документов (`MeetingsModule`, `DocumentsModule` в lazy-обёртках).

### 4.2 CRM (`sales-funnel`)

`CRMHubModule`: табы **Воронка** (`SalesFunnelView` / `CRMModule`), **Диалоги** (`ClientChatsPage`), **Клиенты** (`CRMModule` view clients), **Отказы**. Верхняя панель с табами через `AppToolbarContext.setLeading`.

### 4.3 Пространства (`spaces` → `table`)

`SpaceModule` переключает представление по `activeTable.type`:

- `tasks` — таблица, канбан, гант (`TableView`, `KanbanBoard`, `GanttView`);
- `backlog` — `BacklogView`;
- `functionality` — `FunctionalityView`;
- `content-plan` — `ContentPlanView`;
- `meetings` — `MeetingsView`;
- `docs` — `DocumentsView`;
- агрегатор задач и др.

### 4.4 Финансы, HR, производство, склад

Отдельные модули-обёртки или страницы (см. таблицу роутинга выше).

### 4.5 Настройки

`SettingsView` — крупные подразделы (пользователи, статусы, воронки, автоматизация, архив, логи системы и т.д.).

## 5. Компонентный слой

### 5.1 UI-кит (`components/ui/`)

Переиспользуемые примитивы: `Button`, `Input`, `Card`, `Tabs`, `PageLayout`, `Container`, `ModulePageShell`, `ModulePageHeader`, `ModuleSegmentedControl`, `ModuleCreateDropdown`, `ModuleSelectDropdown`, `ModuleFilterIconButton`, `StandardModal`, `DateInput`, `Toast`, …

**Паттерн модулей:** `ModulePageShell` + отступы `MODULE_PAGE_GUTTER`; действия в шапке приложения через `useAppToolbar` (`setModule`).

### 5.2 Фичи (`components/features/`)

- `chat/` — `MiniMessenger`, плавающая кнопка чата;
- `tasks/` — списки, карточки, фильтры;
- `home/` — блоки дашборда;
- `deals/`, `processes/` — сущности CRM/BPM.

### 5.3 Страницы (`components/pages/`)

Крупные экраны: `WorkdeskView`, `TasksPage`, `ClientChatsPage`, `InboxPage`, `LoginPage`, `ClientsPage`.

### 5.4 Модули (`components/modules/`)

`SpaceModule`, `CRMHubModule`, `CRMModule`, `FinanceModule`, `HRModule`, `MeetingsModule`, `DocumentsModule` — склейка данных и дочерних view.

## 6. Права доступа

`utils/permissions.ts`, функция `hasPermission(user, key)`. Ключи вида `core.home`, `crm.sales_funnel`, `finance.finance`, `org.bpm`, … — используются в `Sidebar`, `AppHeader` и модулях для показа разделов.

## 7. События между частями UI

Используются `window.dispatchEvent` / `addEventListener` с `CustomEvent` для слабой связанности, например:

- `openDealFromChat`, `openMeetingFromChat`, `openCreateTaskModal`, `openCreateMeetingModal`, `contentPlanSync`.

## 8. Стили и тема

- Tailwind + класс `dark` на `document.documentElement` (см. `useSettingsLogic`).
- Дизайн-система: акцентный бренд-цвет `#3337AD`, нейтральные серые фоны в тёмной теме (`#191919`, `#252525`).

## 9. Типы и контракт API

- Общие типы: `apps/web/types.ts`.
- При необходимости — `npm run types:api` из корня (генерация из OpenAPI бэкенда в `types/api.d.ts`).

## 10. Сборка и качество

```bash
npm run lint      # ESLint
npm run typecheck # tsc
npm run build     # production bundle
```

