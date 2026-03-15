/**
 * TasksList - список задач с использованием TaskCard
 */
import React from 'react';
import { Task, User, Project, StatusOption, PriorityOption } from '../../../types';
import { TaskCard } from './TaskCard';
import { EmptyState } from '../common/EmptyState';
import { CheckSquare } from 'lucide-react';

interface TasksListProps {
  tasks: Task[];
  users: User[];
  projects: Project[];
  statuses: StatusOption[];
  priorities: PriorityOption[];
  onTaskClick: (task: Task) => void;
  emptyMessage?: string;
  className?: string;
}

export const TasksList: React.FC<TasksListProps> = ({
  tasks,
  users,
  projects,
  statuses,
  priorities,
  onTaskClick,
  emptyMessage = 'Нет задач',
  className = '',
}) => {
  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={CheckSquare}
        title={emptyMessage}
        description="Создайте первую задачу, чтобы начать работу"
      />
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {tasks.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          users={users}
          projects={projects}
          statuses={statuses}
          priorities={priorities}
          onClick={() => onTaskClick(task)}
        />
      ))}
    </div>
  );
};
