/**
 * LoadingState - состояние загрузки
 * 
 * Зачем отдельно:
 * - Единый стиль загрузки во всем приложении
 * - Переиспользуется везде
 */
import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Загрузка...',
  size = 'md',
  className = '',
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <div className={`flex flex-col items-center justify-center py-8 ${className}`}>
      <Loader2 className={`${sizeClasses[size]} animate-spin text-blue-500 mb-2`} />
      <p className="text-sm text-gray-500 dark:text-gray-400">{message}</p>
    </div>
  );
};
