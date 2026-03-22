/**
 * TasksHeader — шапка страницы задач (единый стиль с модулями).
 */
import React from 'react';
import { Button } from '../../ui/Button';
import { ModuleCreateIconButton } from '../../ui/ModuleCreateIconButton';
import { Filter } from 'lucide-react';
import { ModulePageHeader } from '../../ui/ModulePageHeader';
import { CheckSquare } from 'lucide-react';

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
    <ModulePageHeader
      accent="indigo"
      icon={<CheckSquare size={24} strokeWidth={2} />}
      title="Задачи"
      description="Управление всеми задачами системы"
      actions={
        <>
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
          <ModuleCreateIconButton accent="indigo" label="Новая задача" onClick={onCreateTask} />
        </>
      }
    />
  );
};
