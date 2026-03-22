/**
 * TasksFilters — компактная панель фильтров для задач
 */
import React from 'react';
import { Select } from '../../ui/Select';
import { Button } from '../../ui/Button';
import { Filter, X } from 'lucide-react';

interface FilterConfig {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}

interface TasksFiltersProps {
  filters: FilterConfig[];
  onClear: () => void;
  className?: string;
}

export const TasksFilters: React.FC<TasksFiltersProps> = ({
  filters,
  onClear,
  className = '',
}) => {
  return (
    <div
      className={`
        rounded-2xl border border-gray-200/90 dark:border-[#333]
        bg-gradient-to-b from-gray-50/90 to-white/80 dark:from-[#1c1c1c] dark:to-[#191919]
        px-3 py-3 sm:px-4 sm:py-3.5 mb-3 shadow-sm
        ${className}
      `.trim()}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#3337AD]/10 text-[#3337AD] dark:bg-[#3337AD]/20 dark:text-[#a5a8f0]">
            <Filter size={16} strokeWidth={2} />
          </span>
          <span className="text-sm font-semibold tracking-tight">Фильтры</span>
        </div>
        <Button variant="ghost" size="sm" icon={X} onClick={onClear} className="!min-h-0 py-1.5 text-xs">
          Сбросить
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
        {filters.map((filter) => (
          <div key={filter.label} className="min-w-0">
            <Select
              label={filter.label}
              value={filter.value}
              onChange={(e) => filter.onChange(e.target.value)}
              options={filter.options}
              className="py-2 text-sm rounded-xl border-gray-200/90 dark:border-[#404040]"
            />
          </div>
        ))}
      </div>
    </div>
  );
};
