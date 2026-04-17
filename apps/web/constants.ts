
import { Project, Role, TableCollection, Task, User, Doc, StatusOption, PriorityOption, NotificationPreferences, Department, FinanceCategory, OrgPosition, AutomationRule } from "./types";


export const TELEGRAM_CHAT_ID = '-1002719375477'; 

// Used for projects/modules/pages icons selection (keep in sync with AppIcons.DynamicIcon mapping).
export const ICON_OPTIONS = [
  'Briefcase',
  'Layers',
  'Layout',
  'CheckSquare',
  'ClipboardList',
  'Clipboard',
  'FileText',
  'Folder',
  'Bookmark',
  'BookOpen',
  'Users',
  'Users2',
  'User',
  'Bell',
  'MessageSquare',
  'Send',
  'Mail',
  'Phone',
  'Calendar',
  'Clock',
  'AlarmClock',
  'Target',
  'Flag',
  'Star',
  'Heart',
  'Rocket',
  'Zap',
  'Sparkles',
  'Activity',
  'TrendingUp',
  'BarChart3',
  'PieChart',
  'Wallet',
  'ShoppingCart',
  'Package',
  'Building2',
  'GitFork',
  'Network',
  'Globe',
  'Compass',
  'MapPin',
  'Link',
  'Server',
  'Database',
  'Code',
  'Cog',
  'Wrench',
  'SlidersHorizontal',
  'Eye',
  'Download',
  'Shield',
  'Lock',
  'KeyRound',
  'Tag',
  'Trash2',
  'Bug',
  'Aperture',
  'Atom',
  'Award',
  'Camera',
  'Image',
  'Video',
  'Bot',
  'Home',
  'Inbox',
  'Settings',
];

// 11 standard colors + allow custom hex in UI (stored as "#rrggbb").
export const COLOR_OPTIONS = [
  'text-slate-500',
  'text-gray-500',
  'text-red-500',
  'text-orange-500',
  'text-amber-500',
  'text-yellow-500',
  'text-lime-600',
  'text-green-600',
  'text-emerald-600',
  'text-blue-500',
  'text-indigo-500',
];

/** 40 hex — палитра иконки модуля (inline style, не зависит от Tailwind safelist). */
export const MODULE_ICON_HEX_COLORS: readonly string[] = [
  '#64748b',
  '#57534e',
  '#92400e',
  '#b45309',
  '#ca8a04',
  '#a16207',
  '#65a30d',
  '#16a34a',
  '#059669',
  '#0d9488',
  '#0e7490',
  '#0c4a6e',
  '#1d4ed8',
  '#2563eb',
  '#4f46e5',
  '#5b21b6',
  '#6d28d9',
  '#7c3aed',
  '#9333ea',
  '#a21caf',
  '#c026d3',
  '#db2777',
  '#e11d48',
  '#ea580c',
  '#f97316',
  '#f59e0b',
  '#eab308',
  '#facc15',
  '#fbbf24',
  '#a3e635',
  '#84cc16',
  '#22c55e',
  '#14b8a6',
  '#06b6d4',
  '#0ea5e9',
  '#38bdf8',
  '#818cf8',
  '#a78bfa',
  '#c084fc',
  '#e879f9',
];

/** Старые project.color (Tailwind) → hex при открытии формы модуля */
export const LEGACY_PROJECT_COLOR_TO_HEX: Record<string, string> = {
  'text-slate-500': '#64748b',
  'text-gray-500': '#6b7280',
  'text-red-500': '#ef4444',
  'text-orange-500': '#f97316',
  'text-amber-500': '#f59e0b',
  'text-yellow-500': '#eab308',
  'text-lime-600': '#65a30d',
  'text-green-600': '#16a34a',
  'text-emerald-600': '#059669',
  'text-blue-500': '#3b82f6',
  'text-indigo-500': '#6366f1',
};

/** Hex для кружка в палитре COLOR_OPTIONS (без динамических `bg-*` — JIT их не подхватывает). */
export function swatchHexForTableColorToken(token: string): string {
  if (token.startsWith('#')) return token;
  return LEGACY_PROJECT_COLOR_TO_HEX[token] ?? '#6b7280';
}

export const DEFAULT_STATUSES: StatusOption[] = [
    { id: 's1', name: 'Не начато', color: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700' },
    { id: 's2', name: 'В работе', color: 'bg-blue-100 dark:bg-blue-900/35 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800/60' },
    { id: 's3', name: 'На проверке', color: 'bg-amber-100 dark:bg-amber-900/35 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800/60' },
    { id: 's4', name: 'Выполнено', color: 'bg-emerald-100 dark:bg-emerald-900/35 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800/60' },
];

export const DEFAULT_PRIORITIES: PriorityOption[] = [
    { id: 'p1', name: 'Низкий', color: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700' },
    { id: 'p2', name: 'Средний', color: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700' },
    { id: 'p3', name: 'Высокий', color: 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-700' },
];

export const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
    channels: { in_app: true, chat: true, telegram: false, email: false },
    quietHours: { enabled: false, start: '22:00', end: '08:00', timezone: 'Asia/Tashkent' },
    types: {},
    // Задачи
    newTask: { telegramPersonal: true, telegramGroup: false },
    statusChange: { telegramPersonal: true, telegramGroup: false },
    taskAssigned: { telegramPersonal: true, telegramGroup: false },
    taskComment: { telegramPersonal: true, telegramGroup: false },
    taskDeadline: { telegramPersonal: true, telegramGroup: false },
    // Документы
    docCreated: { telegramPersonal: true, telegramGroup: false },
    docUpdated: { telegramPersonal: true, telegramGroup: false },
    docShared: { telegramPersonal: true, telegramGroup: false },
    // Встречи
    meetingCreated: { telegramPersonal: true, telegramGroup: false },
    meetingReminder: { telegramPersonal: true, telegramGroup: false },
    meetingUpdated: { telegramPersonal: true, telegramGroup: false },
    // Контент-план
    postCreated: { telegramPersonal: true, telegramGroup: false },
    postStatusChanged: { telegramPersonal: true, telegramGroup: false },
    // Финансы
    purchaseRequestCreated: { telegramPersonal: true, telegramGroup: false },
    purchaseRequestStatusChanged: { telegramPersonal: true, telegramGroup: false },
    financePlanUpdated: { telegramPersonal: true, telegramGroup: false },
    // CRM
    dealCreated: { telegramPersonal: true, telegramGroup: false },
    dealStatusChanged: { telegramPersonal: true, telegramGroup: false },
    clientCreated: { telegramPersonal: true, telegramGroup: false },
    contractCreated: { telegramPersonal: true, telegramGroup: false },
    // Сотрудники
    employeeCreated: { telegramPersonal: true, telegramGroup: false },
    employeeUpdated: { telegramPersonal: true, telegramGroup: false },
    // Бизнес-процессы
    processStarted: { telegramPersonal: true, telegramGroup: false },
    processStepCompleted: { telegramPersonal: true, telegramGroup: false },
    processStepRequiresApproval: { telegramPersonal: true, telegramGroup: false }
};

export const DEFAULT_AUTOMATION_RULES: AutomationRule[] = [
    {
        id: 'rule-1',
        name: 'Согласование договора',
        isActive: true,
        module: 'tasks',
        trigger: 'task_status_changed',
        conditions: { statusTo: 'На проверке' },
        action: {
            type: 'telegram_message',
            targetUser: 'admin',
            template: '🔔 <b>Требует согласования:</b> {task_title}\n\nПожалуйста, проверьте документ.',
            buttons: [
                { text: '✅ Одобрить', action: 'approve', callbackData: 'change_status:Выполнено' },
                { text: '❌ Вернуть', action: 'reject', callbackData: 'change_status:В работе' }
            ]
        }
    }
];

export const LABEL_COLORS = [
    { name: 'Gray', class: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700' },
    { name: 'Blue', class: 'bg-blue-500 dark:bg-blue-600 text-white border border-blue-600 dark:border-blue-500' },
    { name: 'Green', class: 'bg-emerald-500 dark:bg-emerald-600 text-white border border-emerald-600 dark:border-emerald-500' },
    { name: 'Yellow', class: 'bg-amber-500 dark:bg-amber-600 text-white border border-amber-600 dark:border-amber-500' },
    { name: 'Red', class: 'bg-rose-500 dark:bg-rose-600 text-white border border-rose-600 dark:border-rose-500' },
    { name: 'Purple', class: 'bg-violet-500 dark:bg-violet-600 text-white border border-violet-600 dark:border-violet-500' },
    { name: 'Pink', class: 'bg-pink-500 dark:bg-pink-600 text-white border border-pink-600 dark:border-pink-500' },
    { name: 'Indigo', class: 'bg-indigo-500 dark:bg-indigo-600 text-white border border-indigo-600 dark:border-indigo-500' },
    { name: 'Orange', class: 'bg-orange-500 dark:bg-orange-600 text-white border border-orange-600 dark:border-orange-500' },
    { name: 'Cyan', class: 'bg-cyan-500 dark:bg-cyan-600 text-white border border-cyan-600 dark:border-cyan-500' },
];

export const PRIORITY_COLORS = [
    { name: 'Green', class: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700' },
    { name: 'Orange', class: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700' },
    { name: 'Red', class: 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-700' },
    { name: 'Gray', class: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700' },
    { name: 'Blue', class: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700' },
    { name: 'Yellow', class: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-700' },
];

// Fallback для начальной загрузки / дефолты UI до ответа API
export const MOCK_PROJECTS: Project[] = [];

export const MOCK_TABLES: TableCollection[] = [];

export const MOCK_DEPARTMENTS: Department[] = [];

export const MOCK_ORG_POSITIONS: OrgPosition[] = [];

export const DEFAULT_FINANCE_CATEGORIES: FinanceCategory[] = [
    { id: 'fund-1', name: 'Операционный', type: 'fixed', value: 0, order: 1, color: 'bg-slate-100 text-slate-700' },
    { id: 'fund-2', name: 'Закупки', type: 'fixed', value: 0, order: 2, color: 'bg-emerald-100 text-emerald-700' },
    { id: 'fund-3', name: 'Резерв', type: 'fixed', value: 0, order: 3, color: 'bg-amber-100 text-amber-800' },
    { id: 'fc1', name: 'ФОТ (Зарплаты)', type: 'percent', value: 40, order: 10, color: 'bg-blue-100 text-blue-700' },
    { id: 'fc2', name: 'Налоги', type: 'percent', value: 12, order: 11, color: 'bg-red-100 text-red-700' },
    { id: 'fc3', name: 'Реклама', type: 'percent', value: 15, order: 12, color: 'bg-purple-100 text-purple-700' },
    { id: 'fc4', name: 'Аренда офиса', type: 'fixed', value: 5000000, order: 13, color: 'bg-orange-100 text-orange-700' },
    { id: 'fc5', name: 'Сервисы / Софт', type: 'fixed', value: 1000000, order: 14, color: 'bg-green-100 text-green-700' },
    { id: 'fc6', name: 'Дивиденды', type: 'percent', value: 10, order: 15, color: 'bg-yellow-100 text-yellow-700' },
];

