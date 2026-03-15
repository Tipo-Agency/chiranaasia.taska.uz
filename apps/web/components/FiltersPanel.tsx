
import React, { useMemo } from 'react';
import { Filter, X } from 'lucide-react';
import { TaskSelect } from './TaskSelect';

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterConfig {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
}

interface FiltersPanelProps {
  filters: FilterConfig[];
  showFilters: boolean;
  onToggleFilters: () => void;
  hasActiveFilters: boolean;
  onClearFilters?: () => void;
  columns?: number; // Количество колонок в grid (по умолчанию 6)
}

export const FiltersPanel: React.FC<FiltersPanelProps> = ({
  filters,
  showFilters,
  onToggleFilters,
  hasActiveFilters,
  onClearFilters,
  columns = 6
}) => {
  // Подсчет активных фильтров
  const activeFiltersCount = useMemo(() => {
    return filters.filter(f => {
      const value = f.value;
      return value && value !== 'all' && value !== '' && value !== 'hide';
    }).length;
  }, [filters]);

  const buttonClassName = useMemo(() => {
    const base = 'px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors';
    const active = 'bg-blue-600 text-white hover:bg-blue-700';
    const inactive = 'bg-gray-100 dark:bg-[#252525] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#303030]';
    return `${base} ${showFilters || hasActiveFilters ? active : inactive}`;
  }, [showFilters, hasActiveFilters]);

  return (
    <>
      <button
        onClick={onToggleFilters}
        className={buttonClassName}
      >
        <Filter size={16} />
        <span className="hidden sm:inline">Фильтры</span>
        {hasActiveFilters && activeFiltersCount > 0 && (
          <span className="bg-white/20 dark:bg-white/20 text-white px-1.5 py-0.5 rounded text-xs font-semibold">
            {activeFiltersCount}
          </span>
        )}
      </button>

      {showFilters && (
        <div className="mb-4 p-4 bg-gray-50 dark:bg-[#252525] rounded-lg border border-gray-200 dark:border-[#333]">
          <div 
            className="grid gap-3"
            style={{
              gridTemplateColumns: `repeat(auto-fit, minmax(150px, 1fr))`,
              maxWidth: '100%'
            }}
          >
            {filters.map((filter, index) => (
              <div key={index}>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                  {filter.label}
                </label>
                <TaskSelect
                  value={filter.value}
                  onChange={filter.onChange}
                  options={filter.options}
                />
              </div>
            ))}
          </div>
          {hasActiveFilters && onClearFilters && (
            <div className="mt-3 flex justify-end">
              <button
                onClick={onClearFilters}
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 flex items-center gap-1"
              >
                <X size={14} />
                Очистить фильтры
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
};

