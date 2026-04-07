/**
 * PriorityBadge - бейдж приоритета (цвет из настроек задач).
 */
import React from 'react';
import { PriorityOption } from '../../../types';
import { TaskBadgeInline } from '../../ui/TaskBadgeInline';

interface PriorityBadgeProps {
  priority: PriorityOption;
  size?: 'sm' | 'md';
}

const priorityColors: Record<string, string> = {
  Высокий: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  Средний: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  Низкий: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  High: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  Medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  Low: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
};

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority, size = 'sm' }) => {
  const sizeClass = size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-sm px-2 py-1';
  const color =
    priority.color?.trim() ||
    priorityColors[priority.name] ||
    'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';

  return (
    <TaskBadgeInline color={color} className={sizeClass}>
      {priority.name}
    </TaskBadgeInline>
  );
};
