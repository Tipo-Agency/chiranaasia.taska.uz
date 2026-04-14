/**
 * Акцентные цвета модулей (иконка в шапке + активный сегмент в стиле «Встречи»).
 */
export type ModuleAccentKey =
  | 'teal'
  | 'indigo'
  | 'violet'
  | 'amber'
  | 'emerald'
  | 'rose'
  | 'sky'
  | 'orange'
  | 'cyan'
  | 'slate'
  | 'yellow'
  | 'blue';

export type SpaceTabKind = 'content-plan' | 'backlog' | 'functionality';

export type ModuleViewContext = {
  activeSpaceTab?: SpaceTabKind;
  activeTableId?: string | null;
  tables?: { id: string; type: string }[];
};

const TABLE_TYPE_ACCENT: Record<string, ModuleAccentKey> = {
  'content-plan': 'indigo',
  backlog: 'orange',
  functionality: 'sky',
  tasks: 'sky',
  meetings: 'teal',
  docs: 'slate',
};

/** Акцент по типу пространства (вкладки «Контент / Идеи / Функционал»). */
export function accentForSpaceType(type: SpaceTabKind): ModuleAccentKey {
  return TABLE_TYPE_ACCENT[type] ?? 'indigo';
}

/** Акцент по типу таблицы (страница `table` и др.). */
export function accentForTableType(type: string | undefined): ModuleAccentKey | null {
  if (!type) return null;
  return TABLE_TYPE_ACCENT[type] ?? null;
}

/**
 * Единая точка: какой акцент показывать для текущего экрана (шапка, FAB, вкладки).
 */
export function resolveModuleAccentKey(view: string, ctx?: ModuleViewContext): ModuleAccentKey {
  if (view === 'table' && ctx?.activeTableId && ctx.tables?.length) {
    const row = ctx.tables.find((t) => t.id === ctx.activeTableId);
    const a = accentForTableType(row?.type);
    if (a) return a;
  }
  if (view === 'spaces' && ctx?.activeSpaceTab) {
    return accentForSpaceType(ctx.activeSpaceTab);
  }

  const map: Record<string, ModuleAccentKey> = {
    home: 'indigo',
    tasks: 'sky',
    search: 'slate',
    inbox: 'cyan',
    chat: 'teal',
    'doc-editor': 'amber',
    clients: 'violet',
    'sales-funnel': 'violet',
    'client-chats': 'violet',
    finance: 'emerald',
    'business-processes': 'cyan',
    production: 'amber',
    inventory: 'teal',
    employees: 'orange',
    payroll: 'orange',
    analytics: 'yellow',
    settings: 'slate',
    meetings: 'teal',
    docs: 'slate',
    admin: 'slate',
    spaces: 'indigo',
    table: 'indigo',
  };
  return map[view] ?? 'indigo';
}

export const MODULE_ACCENTS: Record<
  ModuleAccentKey,
  {
    iconBox: string;
    segmentActive: string;
    /** Квадратная кнопка «+» в шапке, как во «Встречах» */
    fab: string;
    /** Активное состояние кнопки фильтров */
    filterActive: string;
    /** Цвет иконок в выпадающем меню "+" */
    menuIcon: string;
    /** Чип активной иконки в сайдбаре и текстовых вкладках (мягкая подсветка) */
    navIconActive: string;
  }
> = {
  teal: {
    iconBox:
      'bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-lg shadow-teal-500/20',
    segmentActive: 'bg-teal-600 text-white shadow-sm',
    fab: 'bg-teal-600 hover:bg-teal-700 text-white shadow-md shadow-teal-600/20',
    filterActive: 'bg-teal-600 hover:bg-teal-700 text-white',
    menuIcon: 'text-teal-600 dark:text-teal-400 shrink-0',
    navIconActive:
      'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  },
  indigo: {
    iconBox:
      'bg-gradient-to-br from-[#3337AD] to-indigo-800 text-white shadow-lg shadow-[#3337AD]/30',
    segmentActive: 'bg-[#3337AD] text-white shadow-sm',
    fab: 'bg-[#3337AD] hover:bg-[#292b8a] text-white shadow-md shadow-[#3337AD]/25',
    filterActive: 'bg-[#3337AD] hover:bg-[#292b8a] text-white',
    menuIcon: 'text-[#3337AD] dark:text-[#8b8ee0] shrink-0',
    navIconActive:
      'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  },
  violet: {
    iconBox:
      'bg-gradient-to-br from-violet-600 to-purple-700 text-white shadow-lg shadow-violet-500/25',
    segmentActive: 'bg-violet-600 text-white shadow-sm',
    fab: 'bg-violet-600 hover:bg-violet-700 text-white shadow-md shadow-violet-600/20',
    filterActive: 'bg-violet-600 hover:bg-violet-700 text-white',
    menuIcon: 'text-violet-600 dark:text-violet-400 shrink-0',
    navIconActive:
      'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  },
  amber: {
    iconBox:
      'bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/25',
    segmentActive: 'bg-amber-600 text-white shadow-sm',
    fab: 'bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-600/20',
    filterActive: 'bg-amber-600 hover:bg-amber-700 text-white',
    menuIcon: 'text-amber-600 dark:text-amber-400 shrink-0',
    navIconActive:
      'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  },
  emerald: {
    iconBox:
      'bg-gradient-to-br from-emerald-500 to-teal-700 text-white shadow-lg shadow-emerald-500/20',
    segmentActive: 'bg-emerald-600 text-white shadow-sm',
    fab: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20',
    filterActive: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    menuIcon: 'text-emerald-600 dark:text-emerald-400 shrink-0',
    navIconActive:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  },
  rose: {
    iconBox:
      'bg-gradient-to-br from-rose-500 to-pink-700 text-white shadow-lg shadow-rose-500/25',
    segmentActive: 'bg-rose-600 text-white shadow-sm',
    fab: 'bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20',
    filterActive: 'bg-rose-600 hover:bg-rose-700 text-white',
    menuIcon: 'text-rose-600 dark:text-rose-400 shrink-0',
    navIconActive:
      'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  },
  sky: {
    iconBox:
      'bg-gradient-to-br from-sky-500 to-blue-700 text-white shadow-lg shadow-sky-500/25',
    segmentActive: 'bg-sky-600 text-white shadow-sm',
    fab: 'bg-sky-600 hover:bg-sky-700 text-white shadow-md shadow-sky-600/20',
    filterActive: 'bg-sky-600 hover:bg-sky-700 text-white',
    menuIcon: 'text-sky-600 dark:text-sky-400 shrink-0',
    navIconActive:
      'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  },
  orange: {
    iconBox:
      'bg-gradient-to-br from-orange-500 to-red-600 text-white shadow-lg shadow-orange-500/25',
    segmentActive: 'bg-orange-600 text-white shadow-sm',
    fab: 'bg-orange-600 hover:bg-orange-700 text-white shadow-md shadow-orange-600/20',
    filterActive: 'bg-orange-600 hover:bg-orange-700 text-white',
    menuIcon: 'text-orange-600 dark:text-orange-400 shrink-0',
    navIconActive:
      'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  },
  cyan: {
    iconBox:
      'bg-gradient-to-br from-cyan-500 to-blue-700 text-white shadow-lg shadow-cyan-500/25',
    segmentActive: 'bg-cyan-600 text-white shadow-sm',
    fab: 'bg-cyan-600 hover:bg-cyan-700 text-white shadow-md shadow-cyan-600/20',
    filterActive: 'bg-cyan-600 hover:bg-cyan-700 text-white',
    menuIcon: 'text-cyan-600 dark:text-cyan-400 shrink-0',
    navIconActive:
      'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  },
  slate: {
    iconBox:
      'bg-gradient-to-br from-slate-600 to-slate-900 text-white shadow-lg shadow-slate-500/20',
    segmentActive: 'bg-slate-700 dark:bg-slate-600 text-white shadow-sm',
    fab: 'bg-slate-700 hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500 text-white shadow-md shadow-slate-600/20',
    filterActive: 'bg-slate-700 hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500 text-white',
    menuIcon: 'text-slate-700 dark:text-slate-300 shrink-0',
    navIconActive:
      'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300',
  },
  yellow: {
    iconBox:
      'bg-gradient-to-br from-yellow-500 to-amber-700 text-white shadow-lg shadow-yellow-500/25',
    segmentActive: 'bg-yellow-600 text-white shadow-sm',
    fab: 'bg-yellow-600 hover:bg-yellow-700 text-white shadow-md shadow-yellow-600/20',
    filterActive: 'bg-yellow-600 hover:bg-yellow-700 text-white',
    menuIcon: 'text-yellow-600 dark:text-yellow-400 shrink-0',
    navIconActive:
      'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  },
  blue: {
    iconBox:
      'bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-lg shadow-blue-500/25',
    segmentActive: 'bg-blue-600 text-white shadow-sm',
    fab: 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20',
    filterActive: 'bg-blue-600 hover:bg-blue-700 text-white',
    menuIcon: 'text-blue-600 dark:text-blue-400 shrink-0',
    navIconActive:
      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  },
};

/** Неактивная вкладка в шапке модуля. */
export const MODULE_TOOLBAR_TAB_IDLE =
  'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#252525]';

/** Активная вкладка в шапке — как чип иконки в левом меню (полупрозрачный фон). */
export function moduleToolbarTabActive(accent: ModuleAccentKey): string {
  return MODULE_ACCENTS[accent].navIconActive;
}

/**
 * Общий контейнер модуля: тянем контент на всю ширину,
 * но сохраняем одинаковые боковые отступы.
 */
export const MODULE_PAGE_GUTTER = 'w-full px-4 sm:px-6';

/**
 * Правая группа в AppHeader: фильтр, «+», переключатели вида — единый шаг `gap-2`.
 */
export const APP_TOOLBAR_MODULE_CLUSTER =
  'flex items-center gap-2 shrink-0 flex-wrap justify-end';

/** Отступ контента от нижней границы верхней панели — как горизонтальный gutter (px-4 / sm:px-6). */
export const MODULE_PAGE_TOP_PAD = 'pt-4 sm:pt-6';
