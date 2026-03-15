/**
 * RecentActivity - последняя активность на главной странице
 */
import React from 'react';
import { ActivityLog, User } from '../../../types';
import { ActivityItem } from '../activity/ActivityItem';
import { Button } from '../../ui/Button';
import { ArrowRight, Bell } from 'lucide-react';

interface RecentActivityProps {
  activities: ActivityLog[];
  users: User[];
  onViewAll: () => void;
  onMarkRead?: (id: string) => void;
  maxItems?: number;
}

export const RecentActivity: React.FC<RecentActivityProps> = ({
  activities,
  users,
  onViewAll,
  onMarkRead,
  maxItems = 5,
}) => {
  const recentActivities = activities.slice(0, maxItems);

  if (recentActivities.length === 0) {
    return null;
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase flex items-center gap-2">
          <Bell size={16} />
          Последняя активность
        </h2>
        {activities.length > maxItems && (
          <Button variant="ghost" size="sm" icon={ArrowRight} iconPosition="right" onClick={onViewAll}>
            Все
          </Button>
        )}
      </div>
      <div className="space-y-1">
        {recentActivities.map((activity) => (
          <ActivityItem
            key={activity.id}
            activity={activity}
            users={users}
            onMarkRead={onMarkRead ? () => onMarkRead(activity.id) : undefined}
          />
        ))}
      </div>
    </div>
  );
};
