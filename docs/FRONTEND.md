# Архитектура фронтенда

SPA на **Vite 6**, **React 19**, **TypeScript**, стили **TailwindCSS 3**.  
Сборка статическая; в проде nginx отдаёт `dist/`.

Разделы **§2–§4** и часть правил помечены как **[CURRENT]** (как в коде сейчас) vs **[TARGET]** (целевой контракт) — по аналогии с [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## 1. Структура директорий

```
apps/web/
├── index.html
├── main.tsx                  # createRoot, глобальные провайдеры
├── App.tsx                   # Shell: sidebar, header, router, модалки
├── components/
│   ├── AppRouter.tsx         # Центральный роутинг по currentView
│   ├── AppHeader.tsx         # Верхняя панель + слоты toolbar
│   ├── Sidebar.tsx           # Навигация
│   ├── ui/                   # Переиспользуемые примитивы
│   ├── modules/              # Сборки экранов (Module = данные + view)
│   ├── pages/                # Полноэкранные страницы
│   ├── features/             # Доменные блоки
│   └── settings/             # Вкладки настроек
├── frontend/
│   └── hooks/
│       ├── useAppLogic.ts    # Фасад-композитор (мигрируем на stores)
│       ├── useTaskLogic.ts   # Слайс задач
│       ├── useCRMLogic.ts    # Слайс CRM
│       ├── useFinanceLogic.ts
│       └── ...
├── backend/
│   └── api.ts                # fetch-обёртка, auth, error handling
├── stores/                   # (цель) Zustand stores
│   ├── authStore.ts
│   ├── tasksStore.ts
│   ├── crmStore.ts
│   ├── uiStore.ts
│   └── notificationsStore.ts
├── types/
│   ├── entities.ts           # Task, Deal, Client, User...
│   ├── enums.ts              # TaskStatus, DealStage...
│   ├── api.ts                # Request/Response типы
│   └── ui.ts                 # ViewType, ModalState...
└── utils/
    ├── permissions.ts        # hasPermission()
    ├── events.ts             # типизированные CustomEvent
    └── format.ts             # форматирование дат, денег
```

---

## 2. Роутинг

### [CURRENT] (as-built в репозитории)

Роутинг в основном завязан на строковый `**currentView**` в стейте. URL может обновляться через `**history.pushState**` для шаринга — без полной двунаправленной синхронизации это **риск**: прямой заход по ссылке, **Back/Forward (`popstate`)** и обновление страницы могут не восстановить тот же экран/фильтры, что ожидает пользователь.

### [TARGET] — URL как источник правды

- `**pathname` + `search` + при необходимости `hash`** — каноническое описание «где я в приложении». Состояние навигации **парсится из URL** при загрузке и при `**popstate`**, и **записывается в URL** при переходах (не только «вперёд», но и замена истории где уместно).
- **Двунаправленная синхронизация:** `URL → state` и `state → URL`; избегать режима «только pushState без чтения обратно».
- **Deep linking:** каждый значимый экран восстанавливается из URL, например `/deals/:id`, `/tasks?status=…&assignee=…`, вкладки CRM — как query или сегменты пути (зафиксировать схему в одном месте).
- **История:** обработчик `**window.addEventListener('popstate', …)`** обязателен в целевой архитектуре; без него кнопки «Назад»/«Вперёд» ломают согласованность с `currentView`.
- Миграция с `currentView` может идти поэтапно (сначала критичные маршруты CRM/Tasks), см. [DECISIONS.md](./DECISIONS.md) про временные решения с дедлайном.

### Таблица представлений (`currentView`) — [CURRENT]


| `currentView`        | Компонент         | Описание                              |
| -------------------- | ----------------- | ------------------------------------- |
| `home`               | `WorkdeskView`    | Рабочий стол, дашборд                 |
| `tasks`              | `TasksPage`       | Глобальный список задач               |
| `spaces`             | `SpacesTabsView`  | Выбор пространства                    |
| `table`              | `SpaceModule`     | Активная таблица (по `activeTableId`) |
| `sales-funnel`       | `CRMHubModule`    | CRM: воронка + диалоги + клиенты      |
| `finance`            | `FinanceModule`   | Финансы                               |
| `employees`          | `HRModule`        | HR: сотрудники                        |
| `business-processes` | `HRModule`        | HR: бизнес-процессы                   |
| `production`         | `ProductionView`  | Производство                          |
| `inventory`          | `InventoryView`   | Склад                                 |
| `settings`           | `SettingsView`    | Настройки (lazy)                      |
| `chat`               | `ClientChatsPage` | Диалоги (полноэкранный)               |
| `inbox`              | `InboxPage`       | Внутренний чат                        |
| `doc-editor`         | `DocEditor`       | Редактор документов                   |


**Добавить новый экран:**

1. Добавить значение в `ViewType` union (`types/ui.ts`)
2. Добавить ветку в `AppRouter.tsx`
3. Добавить пункт в `Sidebar.tsx` с проверкой прав
4. При необходимости — data-loading в `useAppLogic`

---

## 3. Стейт-менеджмент

### Текущее состояние

`useAppLogic` — монолитный хук, композит из слайсов. Недостатки:

- 40+ зависимостей в одном хуке
- Сложная отладка
- Лишние re-render, если потребители подписаны на «весь стейт»

### Целевое состояние (Zustand)

**Селекторы:** не подписывать компонент на весь store без нужды — брать срезы:

```typescript
const tasks = useTasksStore((s) => s.tasks); // ✅
// const store = useTasksStore();            // ❌ лишние ререндеры
```

Для селекторов, возвращающих объекты/массивы, использовать `**useShallow**` из `zustand/react/shallow`, чтобы не провоцировать ререндер из-за новой ссылки при том же содержимом.

**Загрузка:** по возможности `**isFetching`** (GET) и `**isMutating**` (POST/PATCH/DELETE) вместо одного `isLoading`.

**Ошибки:** в доменных сторах — `**error: string | null`** (или узкий тип), сброс при успехе / `clearError`.

**Optimistic UI:** для задач/сделок (и аналогичных сущностей) — оптимистичное обновление списка/детали с **откатом** при ошибке; на бэкенде желателен **Idempotency-Key** для POST ([API.md](./API.md) §3).

```typescript
// stores/tasksStore.ts (идея)
interface TasksState {
  tasks: Task[];
  filters: TaskFilters;
  isFetching: boolean;
  isMutating: boolean;
  error: string | null;
  fetchTasks: (tableId?: string, signal?: AbortSignal) => Promise<void>;
  // ...
}
```

### Стратегия миграции

1. Создать `stores/` с Zustand-сторами
2. Новые фичи писать через stores, не через useAppLogic
3. Слайсы useAppLogic переписывать постепенно, не ломая существующее
4. `useAppLogic` остаётся временным фасадом, пока слайсы не мигрированы
5. В dev подключить **Zustand DevTools** (см. [§18](#18-dx-и-инструменты))

---

## 4. API-клиент

### Обязательные возможности (целевой контракт)


| Тема                | Правило                                                                                                                                                                                        |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AbortController** | Любой запрос принимает опциональный `**signal: AbortSignal`**; при **unmount** или смене фильтров отменять in-flight запрос, чтобы не гонять состояние                                         |
| **Timeout**         | Обёртка над `fetch` с таймаутом **10–15 с** (AbortError по истечении), настраиваемо per-call для тяжёлых отчётов                                                                               |
| **Retry**           | Автоповтор **только** при сетевом сбое и **5xx**, с backoff и лимитом попыток; **не** ретраить **4xx** (кроме оговоренных **429** с `Retry-After`)                                             |
| **Idempotency-Key** | Для создающих **POST** — опция передавать заголовок `**Idempotency-Key`** (UUID); ключ в Redis scoped по методу и пути ([API.md](./API.md) §3)                                                 |
| **Ошибки**          | Любой неуспех превращать в единый `**ApiError`** (или дискриминированный union): даже не-JSON тело, HTML от nginx, обрыв сети — предсказуемые поля `code`, `message`, опционально `request_id` |


### Пример каркаса

```typescript
// backend/api.ts — идея; фактический API сверять с репозиторием

const DEFAULT_TIMEOUT_MS = 12_000;
const MAX_RETRIES = 2; // только network / 5xx

async function apiFetch<T>(
  url: string,
  options: RequestInit & {
    signal?: AbortSignal;
    idempotencyKey?: string;
    timeoutMs?: number;
  } = {}
): Promise<T> {
  const csrfToken = getCookie('csrf_token');
  const { signal, idempotencyKey, timeoutMs = DEFAULT_TIMEOUT_MS, ...rest } = options;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const composed = mergeAbortSignals(signal, controller.signal);

  try {
    const response = await fetchWithRetry(url, {
      ...rest,
      signal: composed,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken ?? '',
        'X-Request-ID': crypto.randomUUID(),
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
        ...rest.headers,
      },
    });

    if (response.status === 401) {
      /* refresh + один повтор — как сейчас */
    }

    if (!response.ok) {
      throw await parseErrorResponse(response); // всегда ApiError
    }

    return response.json() as Promise<T>;
  } finally {
    clearTimeout(timeout);
  }
}
```

**Нормализация ошибок:** `parseErrorResponse` читает JSON по схеме API; при невалидном теле — `ApiError('parse_error' | 'unknown', message, { status })`.

*Имена `fetchWithRetry`, `mergeAbortSignals` в примере — иллюстрация; реализация в `apps/web`.*

---

## 5. Компонентная архитектура

### Иерархия

```
App
└── AppRouter (по currentView)
    └── <Module> (данные + оркестрация)
        └── <View> (представление, получает пропсы)
            └── <Feature> (доменный блок)
                └── <UI> (примитивы)
```

### Правила компонентов


| Правило                        | Почему                                                                                                                                              |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **≤ ~300 строк** на файл       | Декомпозиция; превышение — сигнал вынести подкомпоненты / хуки                                                                                      |
| **Данные не в листьях**        | В **presentational**-компонентах нет `fetch`/вызовов API — только props/callbacks; загрузка в **container** (модуль, store, хук рядом со страницей) |
| **Container / Presentational** | Container: стор, эффекты, обработчики; Presentational: чистый UI. Не превращать в догму для микро-компонентов <50 строк                             |
| **Стабильные `key`**           | В списках `**key={entity.id}**`, не индекс массива                                                                                                  |
| `**React.memo**`               | Только для **тяжёлых** узлов (большие списки, дорогой рендер карточки), не «на всё подряд»                                                          |
| `useCallback`/`useMemo`        | Только при измеримом выигрыше                                                                                                                       |


### Формы

- **Сложные формы (много полей, валидация):** целевой стек `**react-hook-form` + `zod`** (или эквивалент). Все поля **controlled** в рамках RHF (`register`/`Controller`), без «полу-нативных» форм в середине мастера.
- **Простые формы** (одно поле, поиск): допускается локальный `useState`, но валидация всё равно на сервере как источник правды.
- **Совпадение с бэкендом:** схемы по возможности **общие** (monorepo package) или **дублируются осознанно** с комментарием «зеркало OpenAPI»; расхождение — баг.
- **Ошибки полей:** отображать `details` из `ApiError` / 422 рядом с полями.

### UI-кит (`components/ui/`)

```
Button, Input, Textarea, Select, Checkbox, Toggle
DateInput, DateRangePicker
Modal (StandardModal), Drawer
Card, Badge, Avatar
Tabs, TabPanel
PageLayout, Container
ModulePageShell, ModulePageHeader
ModuleSegmentedControl
ModuleCreateDropdown, ModuleSelectDropdown
ModuleFilterIconButton
Toast (через useToast())
Spinner, Skeleton
SystemDialogs (confirm, alert)
```

**Паттерн модуля:**

```tsx
<ModulePageShell>
  <ModulePageHeader title="CRM" actions={<CreateButton />} />
  <ModuleSegmentedControl tabs={tabs} />
  {/* контент таба */}
</ModulePageShell>
```

---

## 6. Типизация

### Структура `types/`

```typescript
// types/enums.ts — зеркалируют бэкенд
export type TaskStatus    = 'todo' | 'in_progress' | 'review' | 'done' | 'cancelled'
export type TaskPriority  = 'low' | 'medium' | 'high' | 'urgent'
export type DealStage     = 'new' | 'contacted' | 'negotiation' | 'proposal' | 'won' | 'lost'
export type UserRole      = 'admin' | 'manager' | 'employee' | 'readonly'
export type ViewType      = 'home' | 'tasks' | 'spaces' | 'table' | 'sales-funnel'
                          | 'finance' | 'employees' | 'business-processes'
                          | 'production' | 'inventory' | 'settings' | 'chat'
                          | 'inbox' | 'doc-editor'

// types/entities.ts
export interface User {
  id: string;
  name: string;
  email: string | null;
  role: UserRole;
  permissions: string[];
  avatarUrl: string | null;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority | null;
  tableId: string;
  assignee: UserShort | null;
  dueDate: string | null;
  tags: string[];
  commentsCount: number;
  createdAt: string;
  updatedAt: string | null;
}

export interface Deal {
  id: string;
  title: string;
  stage: DealStage;
  funnelId: string;
  client: ClientShort | null;
  assignee: UserShort | null;
  amount: number | null;
  currency: string;
  source: string;
  createdAt: string;
}
// ... и т.д. для всех сущностей
```

### Правила типизации

- `**strict: true`:** включать **постепенно** (файл/модуль), цель — полный strict для всего `apps/web`.
- `**any`:** только с `**TODO`** и причиной в комментарии + задача в трекере; иначе `unknown` + сужение.
- **Генерация из OpenAPI:** целевой путь — `**openapi-typescript`** (или аналог) по `GET /openapi.json`; ручные `types/api.ts` допустимы на время миграции.
- **DTO vs UI-модель:** сырой ответ API (`DealDto`, snake_case как с сервера) не протаскивать в глубину UI — маппинг в **ViewModel** (`Deal` в `entities.ts`, camelCase) в слое api/store.
- Props-интерфейсы — рядом с компонентом.

---

## 7. Обработка ошибок

### Глобальный UX

- Помимо локальных `try/catch`, иметь **единую точку** для непойманных ошибок API (interceptor / обёртка `apiFetch`): **toast** с человекочитаемым текстом + лог с `request_id` в dev.
- Не полагаться только на `console.error` в проде.

### Error Boundaries (гранулярность)

- **Корень:** `App.tsx` — запасной экран при падении роутера.
- **Модули:** граница на каждый крупный раздел (`FinanceModule`, `CRMHubModule`, …).
- **Поддеревья:** отдельная граница на **тяжёлые** виджеты (большая таблица, график), чтобы локальный баг не ронял весь модуль.

```tsx
<ErrorBoundary fallback={<ModuleError message="Не удалось загрузить раздел" onRetry={reload} />}>
  <FinanceModule />
</ErrorBoundary>

<ErrorBoundary fallback={<TableErrorPlaceholder />}>
  <DealsDataTable />
</ErrorBoundary>
```

### Ошибки API

```typescript
class ApiError extends Error {
  constructor(
    public code: string,
    public message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
  }
}

// Локально + глобальный handler для неожиданного
const handleCreate = async () => {
  try {
    await createTask(data);
    toast.success('Задача создана');
  } catch (e) {
    if (e instanceof ApiError) {
      toast.error(e.message);
    } else {
      toast.error('Неизвестная ошибка');
      console.error(e);
    }
  }
};
```

---

## 8. CustomEvents (межкомпонентная коммуникация)

**Ограничение:** CustomEvents — **только для UI-триггеров** («открыть модалку», «проскроллить к…»). **Не** использовать для бизнес-логики, источника правды по данным или цепочек, которые должны жить в **store** / **роутере**. В перспективе — **store-driven** события или лёгкий **event bus** внутри приложения вместо разрастания `window` событий.

Типизированные CustomEvents (как сейчас) — допустимы в этом узком смысле:

```typescript
// utils/events.ts
export const appEvents = {
  openDeal: (dealId: string) =>
    window.dispatchEvent(new CustomEvent('app:open-deal', { detail: { dealId } })),
  
  openCreateTask: (opts?: { tableId?: string }) =>
    window.dispatchEvent(new CustomEvent('app:create-task', { detail: opts ?? {} })),
  
  openMeeting: (meetingId: string) =>
    window.dispatchEvent(new CustomEvent('app:open-meeting', { detail: { meetingId } })),
  
  syncContentPlan: () =>
    window.dispatchEvent(new CustomEvent('app:content-plan-sync')),
};

// Использование
appEvents.openDeal(deal.id);

// Подписка (в хуке)
useEffect(() => {
  const handler = (e: CustomEvent<{ dealId: string }>) => {
    openDealModal(e.detail.dealId);
  };
  window.addEventListener('app:open-deal', handler as EventListener);
  return () => window.removeEventListener('app:open-deal', handler as EventListener);
}, []);
```

---

## 9. Уведомления (WebSocket)

Контракт сообщений — [API.md](./API.md) §11; семантика **best-effort** — [DECISIONS.md](./DECISIONS.md) Часть III.

### Обязательные практики

- **Сброс `retryCount` при успешном `onopen`**, иначе после одной серии ошибок задержки останутся на максимуме даже при восстановлении сети.
- **Heartbeat:** клиент отвечает на серверный `ping` / шлёт `pong` по политике API; при отсутствии трафика — лёгкий keepalive (например проверка каждые **30 с**), чтобы рвать «мёртвые» TCP раньше пользователя.
- `**document.visibilityState`:** при `**hidden`** не открывать агрессивные reconnect-штормы (пауза или реже попытки); при `**visible**` — при необходимости одна попытка восстановления.
- **Несколько вкладок:** опционально `**BroadcastChannel`** (или `storage` event) для синхронизации «переподключились / refresh сессии», чтобы не плодить лишние WS при одном пользователе (серверный лимит соединений — [ARCHITECTURE.md](./ARCHITECTURE.md) §5).

```typescript
// contexts/NotificationCenterContext.tsx — идея

const WS_URL = `${location.origin.replace('http', 'ws')}/api/notifications/ws/${userId}`;

let retryCount = 0;

const connect = () => {
  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    retryCount = 0;
  };

  ws.onmessage = (event) => {
    const notification = JSON.parse(event.data);
    addNotification(notification);
    incrementUnreadCount();
  };

  ws.onclose = () => {
    if (document.visibilityState === 'hidden') {
      /* отложить reconnect */
    }
    const delay = Math.min(1000 * Math.pow(2, retryCount), 30_000);
    setTimeout(connect, delay);
    retryCount++;
  };

  ws.onerror = () => {
    sessionStorage.setItem('ws_error', '1');
  };
};
```

---

## 10. Права доступа

**Бэкенд — единственный источник правды:** UI скрывает кнопки и маршруты для UX, но **каждая** мутация всё равно проверяется на сервере. Не дублировать «секретные» правила только на фронте.

**Централизация на фронте:** общий хелпер `**hasPermission`**, обёртки `**ProtectedRoute` / `withPermission**` (или render-prop), единая проверка перед рендером модуля и чувствительных действий.

```typescript
// utils/permissions.ts
export const hasPermission = (user: User, permission: string): boolean => {
  if (user.role === 'admin') return true;
  return user.permissions.includes(permission);
};

// Пример: скрыть раздел
{hasPermission(user, 'finance.view') && (
  <SidebarItem icon={FinanceIcon} label="Финансы" view="finance" />
)}
```

---

## 11. Производительность

### Поиск и фильтры

- Ввод в поиск и тяжёлые фильтры — `**debounce` 300–500 ms**, чтобы не бить API на каждый символ.

### Списки и пагинация

- Не держать в DOM **> 100–200** элементов без **виртуализации** или серверной пагинации.

### Виртуализация списков

Для длинных списков использовать `@tanstack/react-virtual` (или аналог):

```tsx
import { useVirtual } from '@tanstack/react-virtual';

const rowVirtualizer = useVirtual({
  size: tasks.length,
  parentRef,
  estimateSize: () => 60,
});
```

### Lazy loading модулей (code splitting)

```tsx
// AppRouter.tsx — границы по крупным зонам: CRM, Finance, HR, Settings
const SettingsView     = lazy(() => import('./SettingsView'));
const GanttView        = lazy(() => import('./GanttView'));
const AnalyticsView    = lazy(() => import('../pages/AnalyticsView'));

<Suspense fallback={<ModuleLoader />}>
  <SettingsView />
</Suspense>
```

### Мемоизация

`React.memo` / тяжёлые `useMemo` — **точечно** для узких мест (карточка в виртуализированном списке), а не по умолчанию на каждый компонент.

### Изображения

- `**loading="lazy"`** для контента ниже сгиба; задавать `**width`/`height**` (или aspect-ratio), чтобы уменьшить CLS.

---

## 12. Стили и тема

- **Tailwind** + кастомный цвет бренда
- Темная тема: класс `dark` на `document.documentElement`
- Токены:

```
Акцент:           #3337AD  (brand-500)
Фон приложения:   #191919  (в dark)
Фон карточек:     #252525  (в dark)
Фон модалок:      #1E1E1E  (в dark)
```

- Переключение темы через `useSettingsLogic` → `document.documentElement.classList.toggle('dark')`

---

## 13. Сборка и качество кода

### Окружения и конфиг

- Раздельные `**.env.development` / `.env.production**` (или переменные Vite); **базовый URL API** и флаги не хардкодить в исходниках.
- **Alias импортов:** `@/components`, `@/stores`, … — избегать цепочек `../../../../`.

### Именование

- **camelCase** в TS/JS; **snake_case** только в DTO до маппинга в ViewModel.

### Команды

```bash
npm run lint
npm run typecheck
npm run test          # Vitest unit + integration
npm run test:e2e      # Playwright
npm run build
npm run build:analyze # bundle analyzer
```

### ESLint (обязательные ориентиры)

```json
{
  "no-innerHTML-without-sanitization": "error",
  "@typescript-eslint/no-explicit-any": "warn",
  "react-hooks/exhaustive-deps": "warn",
  "react/no-danger": "error"
}
```

---

## 14. Утилиты: даты и деньги

- **Даты:** единый слой (**dayjs / luxon / date-fns-tz**) для парсинга и отображения; не смешивать «сырой» `new Date()` без политики TZ.
- **Деньги:** одна функция `**formatMoney(amount, currency)`** в `utils/format.ts`, согласованная с CRM/Finance.

---

## 15. Безопасность (фронт)

- **XSS:** `**dangerouslySetInnerHTML`** только после **DOMPurify** (или аналога); иначе запрет — см. [SECURITY.md](./SECURITY.md).
- **CSP:** **Content-Security-Policy** на стороне **nginx** (или CDN); согласовать с ограничениями Vite.
- **Cookies:** JWT в **HttpOnly** — **не читать из JS**; доступен для скриптов в основном `**csrf_token`**. См. [API.md](./API.md) §1, [ARCHITECTURE.md](./ARCHITECTURE.md) §8.

---

## 16. Доступность (a11y)

- Базовый уровень: `**aria-label**`, клавиатура для **dropdown** и **модалок**.
- **Модалки:** **focus trap** и возврат фокуса на триггер при закрытии.

---

## 17. Тестирование


| Уровень         | Минимум                                                                       |
| --------------- | ----------------------------------------------------------------------------- |
| **Unit**        | Утилиты, мапперы DTO, изолированная логика стора                              |
| **Integration** | **MSW** для стабильных контрактов API                                         |
| **E2E**         | **Логин**, **создание сделки**, **отправка сообщения** в диалоге (Playwright) |


---

## 18. DX и инструменты

- **Zustand DevTools** в development.
- В **dev** логировать запросы (URL, статус, время) и ошибки API; в **prod** — без шума, только Sentry/агрегатор.
- **Feature flags:** простые ключи в **env** (`VITE_FEATURE_…`), без overengineering до появления реальной потребности.

---

## 19. Наблюдаемость (клиент)

- **Ошибки:** Sentry (или аналог), source maps, корреляция с `request_id` из ответа API где возможно.
- **Производительность:** **web-vitals** (LCP, CLS, INP) — мониторинг регрессий после релизов.

---

### Что сознательно не догматизируем

- **RHF + Zod на каждую форму подряд** — для одно-двухполевых форм допустим `useState`; для сложных CRM-форм стек RHF+Zod — целевая норма.
- **Жёсткий container/presentational в каждом файле** — обязателен на уровне **модуля**, гибкость на уровне мелких компонентов.

