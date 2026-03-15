/**
 * NotificationsSection - секция уведомлений на главной странице
 */
import React from 'react';
import { ActivityLog } from '../../../types';
import { Card } from '../../ui/Card';
import { ActivityItem } from '../activity/ActivityItem';
import { User } from '../../../types';
import { AlertCircle } from 'lucide-react';

interface NotificationsSectionProps {
  notifications: ActivityLog[];
  users: User[];
  onViewAll: () => void;
  onMarkRead?: (id: string) => void;
  maxItems?: number;
}

export const NotificationsSection: React.FC<NotificationsSectionProps> = ({
  notifications,
  users,
  onViewAll,
  onMarkRead,
  maxItems = 10,
}) => {
  const displayedNotifications = notifications.slice(0, maxItems);

  return (
    <Card className="flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-[#333] bg-gray-50 dark:bg-[#252525] flex justify-between items-center shrink-0">
        <h2 className="font-bold text-sm text-gray-800 dark:text-white flex items-center gap-2">
          <AlertCircle size={16} className="text-orange-500" /> Уведомления
        </h2>
        <span className="bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
          {notifications.length}
        </span>
      </div>
      <div className="overflow-y-auto custom-scrollbar p-2 space-y-1 flex-1 min-h-0">
        {displayedNotifications.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-400">
            Нет непрочитанных уведомлений
          </div>
        ) : (
          <>
            {displayedNotifications.map((notification) => (
              <ActivityItem
                key={notification.id}
                activity={notification}
                users={users}
                onClick={onViewAll}
                onMarkRead={onMarkRead ? () => onMarkRead(notification.id) : undefined}
              />
            ))}
            {notifications.length > maxItems && (
              <button
                onClick={onViewAll}
                className="w-full mt-2 p-2 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
              >
                Показать все ({notifications.length})
              </button>
            )}
          </>
        )}
      </div>
    </Card>
  );
};
