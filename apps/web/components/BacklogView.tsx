import React, { useMemo, useState, useLayoutEffect } from 'react';
import { Task, User, StatusOption, TableCollection } from '../types';
import { Archive, Trash2, Edit2, Play } from 'lucide-react';
import { TaskSelect } from './TaskSelect';
import {
  ModulePageShell,
  MODULE_PAGE_GUTTER,
  ModuleCreateIconButton,
  ModuleFilterIconButton,
  ToolbarModuleLabel,
  APP_TOOLBAR_MODULE_CLUSTER,
} from './ui';
import { TaskBadgeInline } from './ui/TaskBadgeInline';
import { useAppToolbar } from '../contexts/AppToolbarContext';

interface BacklogViewProps {
  backlogIdeas: Task[];
  backlogLinkedTasks: Task[];
  users: User[];
  statuses: StatusOption[];
  /** зарезервировано для совместимости с SpaceModule */
  tables?: TableCollection[];
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
  onDeleteTask: (id: string) => void;
  onOpenTask: (task: Task) => void;
  onCreateTask: () => void;
  onTakeToWork: (task: Task) => void;
}

const BacklogView: React.FC<BacklogViewProps> = ({
  backlogIdeas,
  backlogLinkedTasks,
  users,
  statuses,
  onUpdateTask,
  onDeleteTask,
  onOpenTask,
  onCreateTask,
  onTakeToWork,
}) => {
  const { setLeading, setModule } = useAppToolbar();
  const [listMode, setListMode] = useState<'ideas' | 'in_work' | 'done'>('ideas');
  const [scope, setScope] = useState<'all' | 'assigned' | 'unassigned'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filteredTasks = useMemo(() => {
    return backlogIdeas.filter((t) => {
      if (scope === 'assigned' && !t.assigneeId && !(t.assigneeIds && t.assigneeIds.length)) return false;
      if (scope === 'unassigned' && (t.assigneeId || (t.assigneeIds && t.assigneeIds.length))) return false;
      return true;
    });
  }, [backlogIdeas, scope]);

  const tasksFromBacklog = useMemo(() => {
    let list = (backlogLinkedTasks || []).filter((t) => !t.isArchived);
    if (listMode === 'in_work') {
      list = list.filter((t) => !['Выполнено', 'Done', 'Завершено'].includes(t.status));
    }
    if (listMode === 'done') {
      list = list.filter((t) => ['Выполнено', 'Done', 'Завершено'].includes(t.status));
    }
    if (statusFilter !== 'all') {
      list = list.filter((t) => t.status === statusFilter);
    }
    return list;
  }, [backlogLinkedTasks, listMode, statusFilter]);

  const filterActiveCount = useMemo(() => {
    let n = 0;
    if (listMode !== 'ideas') n += 1;
    if (scope !== 'all') n += 1;
    if (listMode !== 'ideas' && statusFilter !== 'all') n += 1;
    return n;
  }, [listMode, scope, statusFilter]);

  useLayoutEffect(() => {
    setLeading(
      <ToolbarModuleLabel accent="orange">Идеи</ToolbarModuleLabel>
    );
    setModule(
      <div className={APP_TOOLBAR_MODULE_CLUSTER}>
        <ModuleFilterIconButton
          accent="orange"
          size="sm"
          active={filtersOpen || filterActiveCount > 0}
          activeCount={filterActiveCount}
          label="Фильтры"
          onClick={() => setFiltersOpen((o) => !o)}
        />
        <ModuleCreateIconButton accent="orange" label="Новая идея" onClick={onCreateTask} />
      </div>
    );
    return () => {
      setLeading(null);
      setModule(null);
    };
  }, [setLeading, setModule, onCreateTask, filtersOpen, filterActiveCount]);

  const getStatusBadge = (statusName: string) => {
    const s = statuses.find((st) => st.name === statusName);
    const color = s?.color || 'bg-gray-100 text-gray-600';

    return (
      <TaskBadgeInline color={color} className="px-2 py-1 rounded-full text-xs font-bold uppercase">
        {statusName}
      </TaskBadgeInline>
    );
  };

  const body =
    listMode === 'ideas'
      ? filteredTasks.length > 0
        ? (
          <div className="grid grid-cols-1 gap-4">
            {filteredTasks.map((task) => {
              const assignee = users.find((u) => u.id === task.assigneeId);
              const status = statuses.find((s) => s.name === task.status);

              return (
                <div
                  key={task.id}
                  className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl p-5 hover:shadow-md transition-all group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div
                        onClick={() => onOpenTask(task)}
                        className="font-semibold text-lg text-gray-800 dark:text-gray-200 cursor-pointer hover:text-orange-600 dark:hover:text-orange-400 transition-colors mb-2"
                      >
                        {task.title}
                      </div>
                      {task.description && (
                        <div className="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2">{task.description}</div>
                      )}

                      <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-2">
                          <TaskBadgeInline color={status?.color} className="px-2.5 py-1 rounded-full text-xs font-bold uppercase border border-transparent">
                            {task.status}
                          </TaskBadgeInline>
                        </div>

                        {assignee ? (
                          <div className="flex items-center gap-2">
                            <img src={assignee.avatar} className="w-5 h-5 rounded-full object-cover object-center" alt="" />
                            <span className="text-xs text-gray-600 dark:text-gray-400">{assignee.name}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Не назначено</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => onTakeToWork(task)}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 flex items-center gap-2 shadow-sm transition-colors"
                      >
                        <Play size={16} /> Взять в работу
                      </button>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => onOpenTask(task)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                          title="Редактировать"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => onDeleteTask(task.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                          title="Удалить"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
        : (
          <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl p-12 text-center">
            <Archive size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-gray-400 dark:text-gray-500 text-lg mb-2">Пока нет идей</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">Добавьте первую идею для будущей реализации</p>
            <ModuleCreateIconButton accent="orange" label="Добавить идею" onClick={onCreateTask} className="mx-auto" />
          </div>
        )
      : tasksFromBacklog.length > 0
        ? (
          <div className="grid grid-cols-1 gap-4">
            {tasksFromBacklog.map((task) => {
              const assignee = users.find((u) => u.id === task.assigneeId);
              const status = statuses.find((s) => s.name === task.status);

              return (
                <div
                  key={task.id}
                  className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl p-5 hover:shadow-md transition-all group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div
                        onClick={() => onOpenTask(task)}
                        className="font-semibold text-lg text-gray-800 dark:text-gray-200 cursor-pointer hover:text-orange-600 dark:hover:text-orange-400 transition-colors mb-2"
                      >
                        {task.title}
                      </div>
                      <div className="flex items-center gap-4 flex-wrap">
                        <TaskBadgeInline color={status?.color} className="px-2.5 py-1 rounded-full text-xs font-bold uppercase border border-transparent">
                          {task.status}
                        </TaskBadgeInline>
                        {assignee ? (
                          <div className="flex items-center gap-2">
                            <img src={assignee.avatar} className="w-5 h-5 rounded-full object-cover object-center" alt="" />
                            <span className="text-xs text-gray-600 dark:text-gray-400">{assignee.name}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Не назначено</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={() => onOpenTask(task)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                        title="Открыть"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => onDeleteTask(task.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                        title="Удалить"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
        : (
          <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl p-12 text-center">
            <Archive size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-gray-400 dark:text-gray-500 text-lg mb-2">Пока пусто</p>
            <p className="text-sm text-gray-400 dark:text-gray-500">Здесь будут задачи, созданные из идей</p>
          </div>
        );

  return (
    <ModulePageShell>
      {filtersOpen && (
        <div className={`${MODULE_PAGE_GUTTER} pt-2 pb-2 flex-shrink-0 border-b border-gray-200 dark:border-[#333]`}>
          <div className="p-4 bg-gray-50 dark:bg-[#252525] rounded-lg border border-gray-200 dark:border-[#333]">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Список</label>
                <TaskSelect
                  value={listMode}
                  onChange={(v) => setListMode(v as 'ideas' | 'in_work' | 'done')}
                  options={[
                    { value: 'ideas', label: 'Идеи' },
                    { value: 'in_work', label: 'В работе' },
                    { value: 'done', label: 'Выполнено' },
                  ]}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Исполнитель</label>
                <TaskSelect
                  value={scope}
                  onChange={(v) => setScope(v as 'all' | 'assigned' | 'unassigned')}
                  options={[
                    { value: 'all', label: 'Все' },
                    { value: 'assigned', label: 'С исполнителем' },
                    { value: 'unassigned', label: 'Без исполнителя' },
                  ]}
                />
              </div>
              {listMode !== 'ideas' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Статус задачи</label>
                  <TaskSelect
                    value={statusFilter}
                    onChange={setStatusFilter}
                    options={[
                      { value: 'all', label: 'Все статусы' },
                      ...statuses.filter((s) => !s.isArchived).map((s) => ({ value: s.name, label: s.name })),
                    ]}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-hidden">
        <div className={`${MODULE_PAGE_GUTTER} pb-24 md:pb-32 h-full overflow-y-auto custom-scrollbar`}>{body}</div>
      </div>
    </ModulePageShell>
  );
};

export default BacklogView;
