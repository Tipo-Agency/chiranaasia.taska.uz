/**
 * MeetingCard - карточка встречи для отображения в списках
 * 
 * Зачем отдельно:
 * - Переиспользуется в MeetingsModule, HomeView
 * - Единый стиль отображения встреч
 */
import React from 'react';
import { Meeting, User } from '../../../types';
import { Card } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
import { UserAvatar } from '../common/UserAvatar';
import { Calendar, Clock, Users } from 'lucide-react';
import { formatDate } from '../../../utils/dateUtils';

interface MeetingCardProps {
  meeting: Meeting;
  users: User[];
  onClick?: () => void;
  className?: string;
}

export const MeetingCard: React.FC<MeetingCardProps> = ({
  meeting,
  users,
  onClick,
  className = '',
}) => {
  const participants = users.filter(u => meeting.participantIds?.includes(u.id));
  const isToday = meeting.date && new Date(meeting.date).toDateString() === new Date().toDateString();
  const isPast = meeting.date && new Date(meeting.date) < new Date();

  return (
    <Card
      className={`
        p-4 cursor-pointer hover:shadow-md active:scale-[0.98] transition-all
        min-h-[80px] md:min-h-[auto]
        ${isToday ? 'border-l-4 border-l-blue-500' : ''}
        ${isPast ? 'opacity-60' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Заголовок */}
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-2 truncate">
            {meeting.title}
          </h3>

          {/* Дата и время */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mb-2">
            {meeting.date && (
              <div className="flex items-center gap-1">
                <Calendar size={12} />
                <span>{formatDate(meeting.date)}</span>
              </div>
            )}
            {meeting.time && (
              <div className="flex items-center gap-1">
                <Clock size={12} />
                <span>{meeting.time}</span>
              </div>
            )}
          </div>

          {/* Участники */}
          {participants.length > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <Users size={12} className="text-gray-400" />
              <div className="flex items-center gap-1 flex-wrap">
                {participants.slice(0, 3).map((user) => (
                  <UserAvatar key={user.id} user={user} size="xs" />
                ))}
                {participants.length > 3 && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    +{participants.length - 3}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Статус */}
          {isToday && (
            <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 text-xs px-2 py-0.5 mt-2">
              Сегодня
            </Badge>
          )}
        </div>
      </div>
    </Card>
  );
};
