/**
 * StatusBadge - бейдж статуса
 * 
 * Зачем отдельно:
 * - Переиспользуется везде где показывается статус
 * - Единый стиль и цвета
 */
import React from 'react';
import { StatusOption } from '../../../types';
import { Badge } from '../../ui/Badge';

interface StatusBadgeProps {
  status: StatusOption;
  size?: 'sm' | 'md';
}

const statusColors: Record<string, string> = {
  'Новая': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  'В работе': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  'Выполнено': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  'Отменено': 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  'New': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  'In Progress': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  'Done': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  'Cancelled': 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'sm',
}) => {
  const colorClass = statusColors[status.value] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  const sizeClass = size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-sm px-2 py-1';

  return (
    <Badge className={`${colorClass} ${sizeClass}`}>
      {status.label || status.value}
    </Badge>
  );
};
