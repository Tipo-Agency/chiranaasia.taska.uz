/**
 * TasksPage - страница задач (рефакторенная версия)
 * 
 * Зачем отдельно:
 * - Только композиция компонентов
 * - Не содержит бизнес-логику
 * - Использует переиспользуемые компоненты
 */
import React, { useState, useMemo, useCallback } from 'react';
import {
  Task,
  User,
  Project,
  StatusOption,
  PriorityOption,
  TableCollection,
  BusinessProcess,
  ViewMode,
} from '../../types';
import { ModulePageShell, MODULE_PAGE_GUTTER } from '../ui';
import {
  TasksHeader,
  ViewModeToggle,
  TasksFilters,
  TasksList,
} from '../features/tasks';
import TableView from '../TableView';
import KanbanBoard from '../KanbanBoard';
import GanttView from '../GanttView';

interface TasksPageProps {
  tasks: Task[];
  users: User[];
  projects: Project[];
  statuses: StatusOption[];
  priorities: PriorityOption[];
  tables: TableCollection[];
  businessProcesses: BusinessProcess[];
  currentUser: User;
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
  onDeleteTask: (taskId: string) => void;
  onOpenTask: (task: Task) => void;
  onCreateTask: () => void;
}

const COMPLETED_STATUSES = ['Выполнено', 'Done', 'Завершено'];
const EXCLUDED_SOURCES = ['Задача', 'Беклог', 'Функционал'];

export const TasksPage: React.FC<TasksPageProps> = ({
  tasks,
  users,
  projects,
  statuses,
  priorities,
  tables,
  businessProcesses,
  currentUser,
  onUpdateTask,
  onDeleteTask,
  onOpenTask,
  onCreateTask,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.TABLE);
  const [showFilters, setShowFilters] = useState(false);

  // Фильтры
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterPriority, setFilterPriority] = useState<string>('');
  const [filterAssignee, setFilterAssignee] = useState<string>('');
  const [filterProject, setFilterProject] = useState<string>('');
  const [filterSource, setFilterSource] = useState<string>('');
  const [hideCompleted, setHideCompleted] = useState<string>('hide');

  // Получаем уникальные источники
  const uniqueSources = useMemo(() => {
    return Array.from(
      new Set(
        tasks
          .filter(t => t.source && !EXCLUDED_SOURCES.includes(t.source))
          .map(t => t.source!)
      )
    );
  }, [tasks]);

  const activeUsers = useMemo(() => users.filter((u) => !u.isArchived), [users]);
  const activeStatuses = useMemo(() => statuses.filter((s) => !s.isArchived), [statuses]);
  const activePriorities = useMemo(() => priorities.filter((p) => !p.isArchived), [priorities]);
  const activeProjects = useMemo(() => projects.filter((p) => !p.isArchived), [projects]);

  // Логика фильтрации источника
  const matchesSource = useCallback((task: Task, source: string): boolean => {
    if (!source) return true;
    switch (source) {
      case 'deal':
        return !!task.dealId;
      case 'process':
        return !!task.processId;
      case 'content':
        return !!task.contentPostId || (!!task.source && !EXCLUDED_SOURCES.includes(task.source));
      case 'backlog':
        return task.source === 'Беклог';
      case 'functionality':
        return task.source === 'Функционал';
      case 'task':
        return task.source === 'Задача' || !task.source;
      default:
        return task.source === source;
    }
  }, []);

  // Фильтрация задач
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      if (task.entityType === 'idea' || task.entityType === 'feature') return false;
      if (task.isArchived) return false;
      if (hideCompleted === 'hide' && COMPLETED_STATUSES.includes(task.status)) return false;
      if (filterStatus && task.status !== filterStatus) return false;
      if (filterPriority && task.priority !== filterPriority) return false;
      if (filterAssignee && task.assigneeId !== filterAssignee && !task.assigneeIds?.includes(filterAssignee)) return false;
      if (filterProject && task.projectId !== filterProject) return false;
      if (filterSource && !matchesSource(task, filterSource)) return false;
      return true;
    });
  }, [tasks, hideCompleted, filterStatus, filterPriority, filterAssignee, filterProject, filterSource, matchesSource]);

  // Конфигурация фильтров
  const taskFilters = useMemo(() => [
    {
      label: 'Статус',
      value: filterStatus,
      onChange: setFilterStatus,
      options: [
        { value: '', label: 'Все статусы' },
        ...activeStatuses.map(s => ({ value: s.name, label: s.name }))
      ]
    },
    {
      label: 'Приоритет',
      value: filterPriority,
      onChange: setFilterPriority,
      options: [
        { value: '', label: 'Все приоритеты' },
        ...activePriorities.map(p => ({ value: p.name, label: p.name }))
      ]
    },
    {
      label: 'Исполнитель',
      value: filterAssignee,
      onChange: setFilterAssignee,
      options: [
        { value: '', label: 'Все исполнители' },
        ...activeUsers.map(u => ({ value: u.id, label: u.name }))
      ]
    },
    {
      label: 'Модуль',
      value: filterProject,
      onChange: setFilterProject,
      options: [
        { value: '', label: 'Все модули' },
        ...activeProjects.map(p => ({ value: p.id, label: p.name }))
      ]
    },
    {
      label: 'Источник',
      value: filterSource,
      onChange: setFilterSource,
      options: [
        { value: '', label: 'Все источники' },
        { value: 'task', label: 'Задача' },
        { value: 'deal', label: 'Сделка' },
        { value: 'process', label: 'Процесс' },
        { value: 'content', label: 'Контент' },
        { value: 'backlog', label: 'Беклог' },
        { value: 'functionality', label: 'Функционал' },
        ...uniqueSources.map(source => ({ value: source, label: source }))
      ]
    },
    {
      label: 'Выполненные',
      value: hideCompleted,
      onChange: setHideCompleted,
      options: [
        { value: 'hide', label: 'Скрыть' },
        { value: 'show', label: 'Показать' }
      ]
    }
  ], [filterStatus, filterPriority, filterAssignee, filterProject, filterSource, hideCompleted, activeStatuses, activePriorities, activeUsers, activeProjects, uniqueSources]);

  const hasActiveFilters = useMemo(() =>
    !!filterStatus || !!filterPriority || !!filterAssignee || !!filterProject || !!filterSource || hideCompleted !== 'hide'
  , [filterStatus, filterPriority, filterAssignee, filterProject, filterSource, hideCompleted]);

  const activeFiltersCount = useMemo(() =>
    taskFilters.filter(f => f.value && f.value !== 'all' && f.value !== '' && f.value !== 'hide').length
  , [taskFilters]);

  const clearFilters = useCallback(() => {
    setFilterStatus('');
    setFilterPriority('');
    setFilterAssignee('');
    setFilterProject('');
    setFilterSource('');
    setHideCompleted('hide');
  }, []);

  return (
    <ModulePageShell>
      <div className={`${MODULE_PAGE_GUTTER} pt-6 md:pt-8 flex-shrink-0`}>
        <div className="mb-5">
          <TasksHeader
            showFilters={showFilters}
            hasActiveFilters={hasActiveFilters}
            activeFiltersCount={activeFiltersCount}
            onToggleFilters={() => setShowFilters(!showFilters)}
            onCreateTask={onCreateTask}
            tabs={<ViewModeToggle viewMode={viewMode} onViewModeChange={setViewMode} />}
          />
        </div>

        {showFilters && (
          <TasksFilters
            filters={taskFilters}
            onClear={clearFilters}
          />
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <div className={`${MODULE_PAGE_GUTTER} mt-3 pb-24 md:pb-32 h-full overflow-y-auto overflow-x-hidden custom-scrollbar`}>
          {viewMode === ViewMode.TABLE && (
            <TableView
              tasks={filteredTasks}
              users={users}
              projects={projects}
              statuses={statuses}
              priorities={priorities}
              tables={tables}
              isAggregator={true}
              currentUser={currentUser}
              businessProcesses={businessProcesses}
              onUpdateTask={onUpdateTask}
              onDeleteTask={onDeleteTask}
              onOpenTask={onOpenTask}
            />
          )}

          {viewMode === ViewMode.KANBAN && (
            <KanbanBoard
              tasks={filteredTasks}
              users={users}
              projects={projects}
              statuses={statuses}
              tables={tables}
              isAggregator={true}
              currentUser={currentUser}
              businessProcesses={businessProcesses}
              onUpdateStatus={(id, status) => onUpdateTask(id, { status })}
              onOpenTask={onOpenTask}
            />
          )}

          {viewMode === ViewMode.GANTT && (
            <GanttView
              tasks={filteredTasks}
              projects={projects}
              onOpenTask={onOpenTask}
            />
          )}
        </div>
      </div>
    </ModulePageShell>
  );
};
