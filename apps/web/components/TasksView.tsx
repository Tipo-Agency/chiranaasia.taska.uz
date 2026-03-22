import React, { useState, useMemo, useCallback } from 'react';
import { Task, User, Project, StatusOption, PriorityOption, TableCollection, BusinessProcess, ViewMode } from '../types';
import TableView from './TableView';
import KanbanBoard from './KanbanBoard';
import GanttView from './GanttView';
import { Plus, X } from 'lucide-react';
import { Filter } from 'lucide-react';
import { TaskSelect } from './TaskSelect';
import { ModulePageShell, ModulePageHeader, ModuleSegmentedControl, MODULE_PAGE_GUTTER } from './ui';
import { CheckSquare } from 'lucide-react';

// Константы
const COMPLETED_STATUSES = ['Выполнено', 'Done', 'Завершено'];
const EXCLUDED_SOURCES = ['Задача', 'Беклог', 'Функционал'];

interface TasksViewProps {
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

export const TasksView: React.FC<TasksViewProps> = ({
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
  const [hideCompleted, setHideCompleted] = useState<string>('hide'); // 'hide' или 'show'

  // Получаем уникальные источники из задач
  const uniqueSources = useMemo(() => {
    return Array.from(
      new Set(
        tasks
          .filter(t => t.source && !EXCLUDED_SOURCES.includes(t.source))
          .map(t => t.source!)
      )
    );
  }, [tasks]);

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
      // Базовые фильтры
      if (task.entityType === 'idea' || task.entityType === 'feature') return false;
      if (task.isArchived) return false;
      
      // Фильтр по выполненным
      if (hideCompleted === 'hide' && COMPLETED_STATUSES.includes(task.status)) return false;
      
      // Фильтры по полям
      if (filterStatus && task.status !== filterStatus) return false;
      if (filterPriority && task.priority !== filterPriority) return false;
      if (filterAssignee && task.assigneeId !== filterAssignee && !task.assigneeIds?.includes(filterAssignee)) return false;
      if (filterProject && task.projectId !== filterProject) return false;
      if (filterSource && !matchesSource(task, filterSource)) return false;
      
      return true;
    });
  }, [tasks, hideCompleted, filterStatus, filterPriority, filterAssignee, filterProject, filterSource, matchesSource]);

  // Конфигурация фильтров
  const taskFilters: FilterConfig[] = useMemo(() => [
    {
      label: 'Статус',
      value: filterStatus,
      onChange: setFilterStatus,
      options: [
        { value: '', label: 'Все статусы' },
        ...statuses.map(s => ({ value: s.name, label: s.name }))
      ]
    },
    {
      label: 'Приоритет',
      value: filterPriority,
      onChange: setFilterPriority,
      options: [
        { value: '', label: 'Все приоритеты' },
        ...priorities.map(p => ({ value: p.name, label: p.name }))
      ]
    },
    {
      label: 'Исполнитель',
      value: filterAssignee,
      onChange: setFilterAssignee,
      options: [
        { value: '', label: 'Все исполнители' },
        ...users.map(u => ({ value: u.id, label: u.name }))
      ]
    },
    {
      label: 'Модуль',
      value: filterProject,
      onChange: setFilterProject,
      options: [
        { value: '', label: 'Все модули' },
        ...projects.map(p => ({ value: p.id, label: p.name }))
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
  ], [filterStatus, filterPriority, filterAssignee, filterProject, filterSource, hideCompleted, statuses, priorities, users, projects, uniqueSources]);

  const hasActiveFilters = useMemo(() => 
    !!filterStatus || !!filterPriority || !!filterAssignee || !!filterProject || !!filterSource || hideCompleted !== 'hide'
  , [filterStatus, filterPriority, filterAssignee, filterProject, filterSource, hideCompleted]);

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
        <div className="mb-6 space-y-5">
          <ModulePageHeader
            accent="indigo"
            icon={<CheckSquare size={24} strokeWidth={2} />}
            title="Задачи"
            description="Управление всеми задачами системы"
            actions={
              <>
                <button
                  type="button"
                  onClick={() => setShowFilters(!showFilters)}
                  className={`px-3 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors ${
                    showFilters || hasActiveFilters
                      ? 'bg-[#3337AD] text-white hover:bg-[#292b8a] shadow-sm'
                      : 'bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#333] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#252525]'
                  }`}
                >
                  <Filter size={16} />
                  <span className="hidden sm:inline">Фильтры</span>
                  {hasActiveFilters && (
                    <span className="bg-white/20 text-white px-1.5 py-0.5 rounded text-xs font-semibold">
                      {taskFilters.filter((f) => f.value && f.value !== 'all' && f.value !== '' && f.value !== 'hide').length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={onCreateTask}
                  className="px-4 py-2 rounded-xl bg-[#3337AD] text-white text-sm font-semibold hover:bg-[#292b8a] flex items-center gap-2 shadow-md shadow-[#3337AD]/25"
                >
                  <Plus size={18} />
                  <span className="hidden sm:inline">Создать</span>
                </button>
              </>
            }
          />

          <ModuleSegmentedControl
            variant="accent"
            accent="indigo"
            value={viewMode}
            onChange={(v) => setViewMode(v as ViewMode)}
            options={[
              { value: ViewMode.TABLE, label: 'Таблица' },
              { value: ViewMode.KANBAN, label: 'Канбан' },
              { value: ViewMode.GANTT, label: 'Гант' },
            ]}
          />

          <div className="mb-4">
            {showFilters && (
              <div className="mb-4 p-4 bg-gray-50 dark:bg-[#252525] rounded-lg border border-gray-200 dark:border-[#333]">
                <div 
                  className="grid gap-3"
                  style={{
                    gridTemplateColumns: `repeat(auto-fit, minmax(150px, 1fr))`,
                    maxWidth: '100%'
                  }}
                >
                  {taskFilters.map((filter, index) => (
                    <div key={index}>
                      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                        {filter.label}
                      </label>
                      <TaskSelect
                        value={filter.value}
                        onChange={filter.onChange}
                        options={filter.options}
                      />
                    </div>
                  ))}
                </div>
                {hasActiveFilters && (
                  <div className="mt-3 flex justify-end">
                    <button
                      onClick={clearFilters}
                      className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 flex items-center gap-1"
                    >
                      <X size={14} />
                      Очистить фильтры
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        <div className={`${MODULE_PAGE_GUTTER} pb-24 h-full`}>
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
              onUpdateStatus={(id, s) => onUpdateTask(id, { status: s })}
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
