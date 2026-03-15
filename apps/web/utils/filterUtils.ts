/**
 * Утилиты для работы с фильтрами
 */

export const DEFAULT_FILTER_VALUES = {
  ALL: 'all',
  HIDE: 'hide',
  SHOW: 'show',
  EMPTY: ''
} as const;

/**
 * Проверяет, есть ли активные фильтры
 */
export const hasActiveFilters = (filters: Record<string, string | undefined>): boolean => {
  return Object.values(filters).some(value => {
    if (!value) return false;
    return value !== DEFAULT_FILTER_VALUES.ALL && 
           value !== DEFAULT_FILTER_VALUES.EMPTY && 
           value !== DEFAULT_FILTER_VALUES.HIDE;
  });
};

/**
 * Подсчитывает количество активных фильтров
 */
export const countActiveFilters = (filters: Record<string, string | undefined>): number => {
  return Object.values(filters).filter(value => {
    if (!value) return false;
    return value !== DEFAULT_FILTER_VALUES.ALL && 
           value !== DEFAULT_FILTER_VALUES.EMPTY && 
           value !== DEFAULT_FILTER_VALUES.HIDE;
  }).length;
};

