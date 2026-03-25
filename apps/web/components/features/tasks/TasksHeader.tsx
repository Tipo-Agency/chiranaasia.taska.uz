/**
 * TasksHeader — шапка страницы задач (единый стиль с модулями).
 */
import React from 'react';
import { ModuleFilterIconButton } from '../../ui/ModuleFilterIconButton';
import { ModuleCreateIconButton } from '../../ui/ModuleCreateIconButton';
import { ModulePageHeader } from '../../ui/ModulePageHeader';
import { CheckSquare } from 'lucide-react';

interface TasksHeaderProps {
  showFilters: boolean;
  hasActiveFilters: boolean;
  activeFiltersCount: number;
  onToggleFilters: () => void;
  onCreateTask: () => void;
  tabs?: React.ReactNode;
}

export const TasksHeader: React.FC<TasksHeaderProps> = ({
  showFilters,
  hasActiveFilters,
  activeFiltersCount,
  onToggleFilters,
  onCreateTask,
  tabs,
}) => {
  return (
    <ModulePageHeader
      accent="indigo"
      icon={<CheckSquare size={24} strokeWidth={2} />}
      title="Задачи"
      description="Управление всеми задачами системы"
      tabs={tabs}
      controls={
        <>
          <ModuleFilterIconButton
            accent="indigo"
            active={showFilters || hasActiveFilters}
            activeCount={activeFiltersCount}
            onClick={onToggleFilters}
          />
          <ModuleCreateIconButton accent="indigo" label="Новая задача" onClick={onCreateTask} />
        </>
      }
    />
  );
};
