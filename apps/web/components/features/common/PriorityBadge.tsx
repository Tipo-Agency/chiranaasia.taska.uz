/**
 * PriorityBadge - бейдж приоритета
 * 
 * Зачем отдельно:
 * - Переиспользуется везде где показывается приоритет
 * - Единый стиль и цвета
 */
import React from 'react';
import { PriorityOption } from '../../../types';
import { Badge } from '../../ui/Badge';

interface PriorityBadgeProps {
  priority: PriorityOption;
  size?: 'sm' | 'md';
}

const priorityColors: Record<string, string> = {
  'Высокий': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  'Средний': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  'Низкий': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  'High': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  'Medium': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  'Low': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
};

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({
  priority,
  size = 'sm',
}) => {
  const colorClass = priorityColors[priority.value] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  const sizeClass = size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-sm px-2 py-1';

  return (
    <Badge className={`${colorClass} ${sizeClass}`}>
      {priority.label || priority.value}
    </Badge>
  );
};
