# Карта компонентов фронтенда

Краткий указатель по каталогу `apps/web/components/`. Подробная логика — в **[FRONTEND.md](./FRONTEND.md)**.

## Корень `components/`


| Файл / область                                                 | Назначение                                                |
| -------------------------------------------------------------- | --------------------------------------------------------- |
| `App.tsx`                                                      | Корневой layout приложения (на уровень выше `components`) |
| `AppRouter.tsx`                                                | Роутинг по `currentView`                                  |
| `AppHeader.tsx`                                                | Верхняя панель: поиск, слоты toolbar, профиль             |
| `Sidebar.tsx`                                                  | Боковая навигация по разделам                             |
| `SettingsView.tsx`                                             | Настройки (lazy)                                          |
| `TaskModal.tsx`                                                | Модалка задачи                                            |
| `TableView.tsx`                                                | Табличное представление задач                             |
| `KanbanBoard.tsx`, `GanttView.tsx`                             | Альтернативные представления                              |
| `FinanceView.tsx`, `InventoryView.tsx`, `ProductionView.tsx`   | Крупные разделы                                           |
| `SalesFunnelView.tsx`, `ClientsView.tsx`, `EmployeesView.tsx`  | CRM / HR экраны                                           |
| `MeetingsView.tsx`, `DocumentsView.tsx`, `ContentPlanView.tsx` | Календарь, документы, контент-план                        |
| `BusinessProcessesView.tsx`, `AnalyticsView.tsx`               | BPM, аналитика                                            |


## `ui/`

Переиспользуемые примитивы: кнопки, поля, модалки, оболочки страниц (`ModulePageShell`), сегменты (`ModuleSegmentedControl`), дропдауны создания/выбора (`ModuleCreateDropdown`, `ModuleSelectDropdown`), `PageLayout`, `Container`, `Toast`, `SystemDialogs`.

## `modules/`

Сборка экранов из view + данные:

- `SpaceModule` — страница «таблицы» и типизированный контент.
- `CRMHubModule` — воронка + диалоги + клиенты.
- `CRMModule` — внутренние режимы воронки/клиентов.
- `FinanceModule`, `HRModule`, `MeetingsModule`, `DocumentsModule` — обёртки разделов.

## `pages/`

Полноэкранные страницы: `WorkdeskView`, `TasksPage`, `InboxPage`, `ClientChatsPage`, `LoginPage`, `ClientsPage`.

## `features/`

Доменные блоки: `chat/` (`MiniMessenger`), `tasks/`, `home/`, `deals/`, `processes/`, `clients/`, `activity/`, `meetings/`, `common/`.

## `settings/`

Вкладки и формы внутри `SettingsView`: пользователи, воронки, финансы, автоматизация, архив, логи и т.д.

## `clients/`, `documents/`, `finance/`, `production/`, `admin/`

Специализированные поддеревья для карточек клиентов, документов, финансовых отчётов, производства, админки.

## Контексты (`contexts/`)

`AppToolbarContext`, `NotificationCenterContext` — глобальное поведение шапки и уведомлений.

---

Добавляя компонент, держите **одну ответственность** на файл, повторяющийся UI выносите в `ui/`, а данные — через пропсы из `AppRouter` / модулей.