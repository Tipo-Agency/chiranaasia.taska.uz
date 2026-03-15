/**
 * UpcomingMeetings - предстоящие встречи на главной странице
 */
import React from 'react';
import { Meeting, User } from '../../../types';
import { MeetingCard } from '../meetings/MeetingCard';
import { Button } from '../../ui/Button';
import { ArrowRight, Calendar } from 'lucide-react';
import { getTodayLocalDate } from '../../../utils/dateUtils';

interface UpcomingMeetingsProps {
  meetings: Meeting[];
  users: User[];
  onViewAll: () => void;
  maxItems?: number;
}

export const UpcomingMeetings: React.FC<UpcomingMeetingsProps> = ({
  meetings,
  users,
  onViewAll,
  maxItems = 3,
}) => {
  const todayStr = getTodayLocalDate();
  const upcomingMeetings = meetings
    .filter(m => m && m.date >= todayStr)
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (a.time || '').localeCompare(b.time || '');
    })
    .slice(0, maxItems);

  if (upcomingMeetings.length === 0) {
    return null;
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase flex items-center gap-2">
          <Calendar size={16} />
          Предстоящие встречи
        </h2>
        {meetings.length > maxItems && (
          <Button variant="ghost" size="sm" icon={ArrowRight} iconPosition="right" onClick={onViewAll}>
            Все встречи
          </Button>
        )}
      </div>
      <div className="space-y-2">
        {upcomingMeetings.map((meeting) => (
          <MeetingCard
            key={meeting.id}
            meeting={meeting}
            users={users}
          />
        ))}
      </div>
    </div>
  );
};
