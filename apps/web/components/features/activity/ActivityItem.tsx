/**
 * ActivityItem - элемент активности для отображения в списках
 * 
 * Зачем отдельно:
 * - Переиспользуется в InboxView, HomeView
 * - Единый стиль отображения активности
 */
import React from 'react';
import { ActivityLog, User } from '../../../types';
import { UserAvatar } from '../common/UserAvatar';
import { Clock, CheckCircle2 } from 'lucide-react';
// formatDate используется в других компонентах, но здесь используем встроенный формат

interface ActivityItemProps {
  activity: ActivityLog;
  users: User[];
  onClick?: () => void;
  onMarkRead?: () => void;
  className?: string;
}

export const ActivityItem: React.FC<ActivityItemProps> = ({
  activity,
  users,
  onClick,
  onMarkRead,
  className = '',
}) => {
  const user = users.find(u => u.id === activity.userId);
  
  // Форматируем дату и время
  const formatDateTime = (timestamp?: string) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const isToday = date.toDateString() === today.toDateString();
    const isYesterday = date.toDateString() === yesterday.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    } else if (isYesterday) {
      return `Вчера, ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      return date.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  // Получаем детальную информацию из activity
  const userName = activity.userName || user?.name || 'Неизвестный пользователь';
  const action = activity.action || '';
  const details = activity.details || '';
  const message = activity.message || '';

  return (
    <div
      className={`
        p-4 
        hover:bg-gray-50 dark:hover:bg-[#303030] transition-colors
        cursor-pointer
        ${!activity.read ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      <div className="flex items-start gap-4">
        {/* Аватар */}
        <div className="shrink-0">
          {user ? (
            <UserAvatar user={user} size="md" />
          ) : activity.userAvatar ? (
            <img 
              src={activity.userAvatar} 
              className="w-10 h-10 rounded-full border-2 border-gray-200 dark:border-[#444] object-cover" 
              alt={userName}
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-[#444] flex items-center justify-center text-gray-500 dark:text-gray-300 text-sm font-semibold">
              {userName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* Основной текст */}
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex-1 min-w-0">
              {message ? (
                <p className="text-sm text-gray-900 dark:text-white leading-relaxed">
                  {message}
                </p>
              ) : (
                <div className="text-sm">
                  <span className="font-semibold text-gray-900 dark:text-white">{userName}</span>
                  {action && (
                    <>
                      <span className="text-gray-600 dark:text-gray-400 mx-1">{action}</span>
                      {details && (
                        <span className="font-medium text-gray-800 dark:text-gray-200">"{details}"</span>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
            
            {/* Индикатор непрочитанного */}
            {!activity.read && (
              <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0"></div>
            )}
          </div>

          {/* Метаданные */}
          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-1">
              <Clock size={12} />
              <span>{formatDateTime(activity.timestamp)}</span>
            </div>
            {!activity.read && onMarkRead && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkRead();
                }}
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                Отметить прочитанным
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
