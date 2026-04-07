/**
 * TasksPage - страница задач (рефакторенная версия)
 * 
 * Зачем отдельно:
 * - Только композиция компонентов
 * - Не содержит бизнес-логику
 * - Использует переиспользуемые компоненты
 */
import React, { useState, useMemo, useCallback, useLayoutEffect } from 'react';
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
import { ModulePageShell, MODULE_PAGE_GUTTER, MODULE_PAGE_TOP_PAD, ModuleFilterIconButton, ModuleCreateIconButton } from '../ui';
import { TasksFilters } from '../features/tasks';
import { useAppToolbar } from '../../contexts/AppToolbarContext';
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
  const { setLeading, setModule } = useAppToolbar();
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

  useLayoutEffect(() => {
    const indigo = 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300';
    const idle = 'text-gray-600 dark:text-gray-400';
    const modes: { id: ViewMode; label: string }[] = [
      { id: ViewMode.TABLE, label: 'Таблица' },
      { id: ViewMode.KANBAN, label: 'Канбан' },
      { id: ViewMode.GANTT, label: 'Гант' },
    ];
    setLeading(
      <div className="flex items-center gap-0.5 shrink-0 flex-wrap" role="tablist" aria-label="Вид задач">
        {modes.map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={viewMode === m.id}
            onClick={() => setViewMode(m.id)}
            className={`px-2 sm:px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-medium whitespace-nowrap transition-colors ${
              viewMode === m.id ? indigo : `${idle} hover:bg-gray-100 dark:hover:bg-[#252525]`
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
    );
    setModule(
      <div className="flex items-center gap-1 shrink-0">
        <ModuleFilterIconButton
          accent="indigo"
          size="sm"
          active={showFilters || hasActiveFilters}
          activeCount={activeFiltersCount}
          onClick={() => setShowFilters((v) => !v)}
        />
        <ModuleCreateIconButton accent="indigo" label="Новая задача" size="sm" onClick={onCreateTask} />
      </div>
    );
    return () => {
      setLeading(null);
      setModule(null);
    };
  }, [
    viewMode,
    showFilters,
    hasActiveFilters,
    activeFiltersCount,
    onCreateTask,
    setLeading,
    setModule,
  ]);

  return (
    <ModulePageShell className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {showFilters && (
        <div className={`${MODULE_PAGE_GUTTER} ${MODULE_PAGE_TOP_PAD} pb-2 flex-shrink-0 border-b border-gray-200 dark:border-[#333]`}>
          <TasksFilters filters={taskFilters} onClear={clearFilters} />
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <div className={`${MODULE_PAGE_GUTTER} ${showFilters ? 'pt-2' : MODULE_PAGE_TOP_PAD} flex-1 min-h-0 flex flex-col overflow-hidden pb-4`}>
          {viewMode === ViewMode.TABLE && (
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
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
            </div>
          )}

          {viewMode === ViewMode.KANBAN && (
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
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
            </div>
          )}

          {viewMode === ViewMode.GANTT && (
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <GanttView
              tasks={filteredTasks}
              projects={projects}
              onOpenTask={onOpenTask}
            />
            </div>
          )}
        </div>
      </div>
    </ModulePageShell>
  );
};
