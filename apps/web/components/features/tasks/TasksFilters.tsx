/**
 * TasksFilters - панель фильтров для задач
 */
import React from 'react';
import { StatusOption, PriorityOption, User, Project } from '../../../types';
import { Select } from '../../ui/Select';
import { Button } from '../../ui/Button';
import { X } from 'lucide-react';
import { Card } from '../../ui/Card';

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
    <Card className={`p-4 mb-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Фильтры
        </h3>
        <Button variant="ghost" size="sm" icon={X} onClick={onClear}>
          Очистить
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filters.map((filter) => (
          <Select
            key={filter.label}
            label={filter.label}
            value={filter.value}
            onChange={(e) => filter.onChange(e.target.value)}
            options={filter.options}
          />
        ))}
      </div>
    </Card>
  );
};
