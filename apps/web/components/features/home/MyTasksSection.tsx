/**
 * MyTasksSection - секция моих задач на главной странице
 * 
 * Зачем отдельно:
 * - Переиспользуемый блок задач
 * - Использует TaskCard для отображения
 */
import React from 'react';
import { Task, User, Project, StatusOption, PriorityOption } from '../../../types';
import { TaskCard } from '../tasks/TaskCard';
import { Button } from '../../ui/Button';
import { ArrowRight, CheckSquare } from 'lucide-react';

interface MyTasksSectionProps {
  tasks: Task[];
  users: User[];
  projects: Project[];
  statuses: StatusOption[];
  priorities: PriorityOption[];
  onOpenTask: (task: Task) => void;
  onViewAll: () => void;
  maxItems?: number;
}

export const MyTasksSection: React.FC<MyTasksSectionProps> = ({
  tasks,
  users,
  projects,
  statuses,
  priorities,
  onOpenTask,
  onViewAll,
  maxItems = 5,
}) => {
  const displayedTasks = tasks.slice(0, maxItems);

  if (tasks.length === 0) {
    return (
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase flex items-center gap-2">
            <CheckSquare size={16} />
            Мои задачи
          </h2>
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400 p-4 bg-gray-50 dark:bg-[#252525] rounded-lg">
          Нет активных задач
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase flex items-center gap-2">
          <CheckSquare size={16} />
          Мои задачи ({tasks.length})
        </h2>
        {tasks.length > maxItems && (
          <Button variant="ghost" size="sm" icon={ArrowRight} iconPosition="right" onClick={onViewAll}>
            Все задачи
          </Button>
        )}
      </div>
      <div className="space-y-2">
        {displayedTasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            users={users}
            projects={projects}
            statuses={statuses}
            priorities={priorities}
            onClick={() => onOpenTask(task)}
          />
        ))}
      </div>
    </div>
  );
};
