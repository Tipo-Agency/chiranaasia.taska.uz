/**
 * TasksHeader - заголовок страницы задач с фильтрами и действиями
 */
import React from 'react';
import { Button } from '../../ui/Button';
import { Filter, Plus } from 'lucide-react';

interface TasksHeaderProps {
  showFilters: boolean;
  hasActiveFilters: boolean;
  activeFiltersCount: number;
  onToggleFilters: () => void;
  onCreateTask: () => void;
}

export const TasksHeader: React.FC<TasksHeaderProps> = ({
  showFilters,
  hasActiveFilters,
  activeFiltersCount,
  onToggleFilters,
  onCreateTask,
}) => {
  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-lg md:text-2xl font-bold text-gray-800 dark:text-white truncate">
            Задачи
          </h1>
          <p className="hidden md:block text-xs text-gray-500 dark:text-gray-400 mt-1">
            Управление всеми задачами системы
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={showFilters || hasActiveFilters ? 'primary' : 'secondary'}
            size="sm"
            icon={Filter}
            onClick={onToggleFilters}
          >
            <span className="hidden sm:inline">Фильтры</span>
            {hasActiveFilters && (
              <span className="bg-white/20 dark:bg-white/20 text-white px-1.5 py-0.5 rounded text-xs font-semibold ml-1">
                {activeFiltersCount}
              </span>
            )}
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={Plus}
            onClick={onCreateTask}
          >
            <span className="hidden sm:inline">Создать</span>
          </Button>
        </div>
      </div>
    </div>
  );
};
