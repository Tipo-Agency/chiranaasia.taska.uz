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
  | 'yellow';

export const MODULE_ACCENTS: Record<
  ModuleAccentKey,
  { iconBox: string; segmentActive: string; /** Квадратная кнопка «+» в шапке, как во «Встречах» */ fab: string }
> = {
  teal: {
    iconBox:
      'bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-lg shadow-teal-500/20',
    segmentActive: 'bg-teal-600 text-white shadow-sm',
    fab: 'bg-teal-600 hover:bg-teal-700 text-white shadow-md shadow-teal-600/20',
  },
  indigo: {
    iconBox:
      'bg-gradient-to-br from-[#3337AD] to-indigo-800 text-white shadow-lg shadow-[#3337AD]/30',
    segmentActive: 'bg-[#3337AD] text-white shadow-sm',
    fab: 'bg-[#3337AD] hover:bg-[#292b8a] text-white shadow-md shadow-[#3337AD]/25',
  },
  violet: {
    iconBox:
      'bg-gradient-to-br from-violet-600 to-purple-700 text-white shadow-lg shadow-violet-500/25',
    segmentActive: 'bg-violet-600 text-white shadow-sm',
    fab: 'bg-violet-600 hover:bg-violet-700 text-white shadow-md shadow-violet-600/20',
  },
  amber: {
    iconBox:
      'bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/25',
    segmentActive: 'bg-amber-600 text-white shadow-sm',
    fab: 'bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-600/20',
  },
  emerald: {
    iconBox:
      'bg-gradient-to-br from-emerald-500 to-teal-700 text-white shadow-lg shadow-emerald-500/20',
    segmentActive: 'bg-emerald-600 text-white shadow-sm',
    fab: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20',
  },
  rose: {
    iconBox:
      'bg-gradient-to-br from-rose-500 to-pink-700 text-white shadow-lg shadow-rose-500/25',
    segmentActive: 'bg-rose-600 text-white shadow-sm',
    fab: 'bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20',
  },
  sky: {
    iconBox:
      'bg-gradient-to-br from-sky-500 to-blue-700 text-white shadow-lg shadow-sky-500/25',
    segmentActive: 'bg-sky-600 text-white shadow-sm',
    fab: 'bg-sky-600 hover:bg-sky-700 text-white shadow-md shadow-sky-600/20',
  },
  orange: {
    iconBox:
      'bg-gradient-to-br from-orange-500 to-red-600 text-white shadow-lg shadow-orange-500/25',
    segmentActive: 'bg-orange-600 text-white shadow-sm',
    fab: 'bg-orange-600 hover:bg-orange-700 text-white shadow-md shadow-orange-600/20',
  },
  cyan: {
    iconBox:
      'bg-gradient-to-br from-cyan-500 to-blue-700 text-white shadow-lg shadow-cyan-500/25',
    segmentActive: 'bg-cyan-600 text-white shadow-sm',
    fab: 'bg-cyan-600 hover:bg-cyan-700 text-white shadow-md shadow-cyan-600/20',
  },
  slate: {
    iconBox:
      'bg-gradient-to-br from-slate-600 to-slate-900 text-white shadow-lg shadow-slate-500/20',
    segmentActive: 'bg-slate-700 dark:bg-slate-600 text-white shadow-sm',
    fab: 'bg-slate-700 hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500 text-white shadow-md shadow-slate-600/20',
  },
  yellow: {
    iconBox:
      'bg-gradient-to-br from-yellow-500 to-amber-700 text-white shadow-lg shadow-yellow-500/25',
    segmentActive: 'bg-yellow-600 text-white shadow-sm',
    fab: 'bg-yellow-600 hover:bg-yellow-700 text-white shadow-md shadow-yellow-600/20',
  },
};

/** Общий контейнер ширины как у модуля «Встречи» */
export const MODULE_PAGE_GUTTER = 'max-w-7xl mx-auto w-full px-4 sm:px-6';
