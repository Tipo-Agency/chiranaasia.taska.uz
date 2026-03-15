/**
 * TaskCard - карточка задачи для отображения в списках
 * 
 * Зачем отдельно:
 * - Переиспользуется в TasksView, HomeView, TableView, Search
 * - Единый стиль отображения задач
 * - Изолированная логика отображения
 */
import React from 'react';
import { Task, User, Project, StatusOption, PriorityOption } from '../../../types';
import { Card } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
import { UserAvatar } from '../common/UserAvatar';
import { PriorityBadge } from '../common/PriorityBadge';
import { StatusBadge } from '../common/StatusBadge';
import { Calendar, Clock } from 'lucide-react';
import { formatDate } from '../../../utils/dateUtils';

interface TaskCardProps {
  task: Task;
  users: User[];
  projects: Project[];
  statuses: StatusOption[];
  priorities: PriorityOption[];
  onClick?: () => void;
  onStatusChange?: (status: string) => void;
  className?: string;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  users,
  projects,
  statuses,
  priorities,
  onClick,
  onStatusChange,
  className = '',
}) => {
  const assignee = users.find(u => u.id === task.assigneeId);
  const project = projects.find(p => p.id === task.projectId);
  const status = statuses.find(s => s.value === task.status);
  const priority = priorities.find(p => p.value === task.priority);

  const isOverdue = task.endDate && new Date(task.endDate) < new Date() && task.status !== 'Выполнено';

  return (
    <Card
      className={`
        p-4 cursor-pointer hover:shadow-md active:scale-[0.98] transition-all
        min-h-[80px] md:min-h-[auto]
        ${isOverdue ? 'border-l-4 border-l-red-500' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Заголовок и приоритет */}
          <div className="flex items-start gap-2 mb-2">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm flex-1 truncate">
              {task.title}
            </h3>
            {priority && (
              <PriorityBadge priority={priority} />
            )}
          </div>

          {/* Статус */}
          {status && (
            <div className="mb-2">
              <StatusBadge status={status} />
            </div>
          )}

          {/* Метаданные */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
            {task.endDate && (
              <div className={`flex items-center gap-1 ${isOverdue ? 'text-red-600 dark:text-red-400' : ''}`}>
                <Calendar size={12} />
                <span>{formatDate(task.endDate)}</span>
              </div>
            )}

            {project && (
              <div className="flex items-center gap-1">
                <span className="truncate max-w-[120px]">{project.name}</span>
              </div>
            )}

            {assignee && (
              <div className="flex items-center gap-1">
                <UserAvatar user={assignee} size="sm" />
                <span className="truncate max-w-[100px]">{assignee.name}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};
