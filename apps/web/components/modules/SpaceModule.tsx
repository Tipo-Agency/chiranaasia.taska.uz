
import React, { useMemo, useState } from 'react';
import { TableCollection, Task, User, Project, StatusOption, PriorityOption, Doc, Folder, Meeting, ContentPost, ViewMode, BusinessProcess, Client, Deal } from '../../types';
import type { AppActions } from '../../frontend/hooks/useAppLogic';
import TableView from '../TableView';
import KanbanBoard from '../KanbanBoard';
import GanttView from '../GanttView';
import FunctionalityView from '../FunctionalityView';
import BacklogView from '../BacklogView';
import MeetingsView from '../MeetingsView';
import ContentPlanView from '../ContentPlanView';
import DocumentsView from '../DocumentsView';
import { AlertCircle, LayoutList, Kanban, BarChart3, ListFilter, EyeOff, CheckSquare } from 'lucide-react';
import { ModulePageShell, ModulePageHeader, ModuleSegmentedControl, MODULE_PAGE_GUTTER, ModuleCreateIconButton } from '../ui';

interface SpaceModuleProps {
  activeTable: TableCollection;
  viewMode: ViewMode;
  tasks: Task[];
  users: User[];
  currentUser: User;
  projects: Project[];
  statuses: StatusOption[];
  priorities: PriorityOption[];
  tables: TableCollection[];
  docs: Doc[];
  folders: Folder[];
  meetings: Meeting[];
  contentPosts: ContentPost[];
  businessProcesses?: BusinessProcess[];
  clients?: Client[];
  deals?: Deal[];
  actions: AppActions;
}

export const SpaceModule: React.FC<SpaceModuleProps> = ({
  activeTable, viewMode, tasks, users, currentUser, projects, statuses, priorities, tables, docs, folders, meetings, contentPosts, businessProcesses = [], clients = [], deals = [], actions
}) => {
  const isAggregator = activeTable?.isSystem && activeTable?.type === 'tasks';

  // --- Filters for task views (таблица / канбан / гант) ---
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [hideCompleted, setHideCompleted] = useState<boolean>(true);

  const filteredTasks: Task[] = useMemo(() => {
      return tasks.filter((t) => {
          if (t.isArchived) return false;
          if (hideCompleted && t.status === 'Выполнено') return false;
          if (statusFilter !== 'all' && t.status !== statusFilter) return false;
          if (assigneeFilter !== 'all' && t.assigneeId !== assigneeFilter && !(t.assigneeIds && t.assigneeIds.includes(assigneeFilter))) {
              return false;
          }
          if (projectFilter !== 'all' && t.projectId !== projectFilter) return false;
          return true;
      });
  }, [tasks, hideCompleted, statusFilter, assigneeFilter, projectFilter]);

  // Получаем идеи для беклога (entityType: 'idea' и tableId совпадает с activeTable.id)
  const backlogIdeas = useMemo(() => {
    if (activeTable?.type === 'backlog' && activeTable?.id) {
      return tasks.filter(t => 
        t.entityType === 'idea' && 
        t.tableId === activeTable.id &&
        !t.isArchived
      );
    }
    return [];
  }, [tasks, activeTable]);

  const backlogLinkedTasks = useMemo(() => {
    if (activeTable?.type !== 'backlog') return [];
    return tasks.filter(
      (t) => t.entityType === 'task' && t.source === 'Беклог' && !!t.linkedIdeaId && !t.isArchived
    );
  }, [tasks, activeTable?.type]);

  // Получаем все backlog таблицы для фильтрации
  const backlogTableIds = useMemo(() => {
    return tables.filter(t => t.type === 'backlog').map(t => t.id);
  }, [tables]);

  // Получаем ВСЕ функции из всех functionality таблиц (entityType: 'feature')
  const allFunctionalityTasks = useMemo(() => {
    const functionalityTableIds = tables.filter(t => t.type === 'functionality').map(t => t.id);
    return tasks.filter(t => 
      t.entityType === 'feature' && 
      functionalityTableIds.includes(t.tableId) &&
      !t.isArchived
    );
  }, [tasks, tables]);

  // Защита от undefined activeTable (после всех хуков)
  if (!activeTable) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400">
        <AlertCircle size={48} className="mb-4 opacity-20" />
        <p>Страница не выбрана</p>
      </div>
    );
  }

  switch (activeTable.type) {
    case 'tasks':
        return (
            <ModulePageShell>
                <div className={`${MODULE_PAGE_GUTTER} pt-4 md:pt-8 flex-shrink-0`}>
                    <div className="mb-4 md:mb-6 space-y-4">
                        <ModulePageHeader
                            accent="indigo"
                            icon={<CheckSquare size={24} strokeWidth={2} />}
                            title="Задачи"
                            description="Управление задачами и проектами"
                            actions={
                                <ModuleCreateIconButton
                                    accent="indigo"
                                    label="Новая задача"
                                    onClick={() => actions.openTaskModal(null)}
                                />
                            }
                        />
                        <div className="flex flex-wrap items-center justify-between gap-2 md:gap-3">
                            <ModuleSegmentedControl
                                variant="accent"
                                accent="indigo"
                                value={viewMode}
                                onChange={(v) => actions.setViewMode(v as ViewMode)}
                                options={[
                                    { value: ViewMode.TABLE, label: 'Таблица', icon: <LayoutList size={16} /> },
                                    { value: ViewMode.KANBAN, label: 'Канбан', icon: <Kanban size={16} /> },
                                    { value: ViewMode.GANTT, label: 'Гант', icon: <BarChart3 size={16} /> },
                                ]}
                            />

                            <div className="flex flex-wrap items-center gap-1.5 md:gap-2 text-[10px] md:text-xs">
                                <div className="flex items-center gap-1">
                                    <ListFilter size={12} className="text-gray-400 md:w-[14px] md:h-[14px]" />
                                    <select
                                        value={statusFilter}
                                        onChange={(e) => setStatusFilter(e.target.value)}
                                        className="border border-gray-200 dark:border-[#333] rounded-lg px-1.5 md:px-2 py-1 bg-white dark:bg-[#252525] text-gray-800 dark:text-gray-100 text-[10px] md:text-xs"
                                    >
                                        <option value="all">Все статусы</option>
                                        {statuses.map((s) => (
                                            <option key={s.id} value={s.name}>
                                                {s.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex items-center gap-1">
                                    <ListFilter size={12} className="text-gray-400 md:w-[14px] md:h-[14px]" />
                                    <select
                                        value={assigneeFilter}
                                        onChange={(e) => setAssigneeFilter(e.target.value)}
                                        className="border border-gray-200 dark:border-[#333] rounded-lg px-1.5 md:px-2 py-1 bg-white dark:bg-[#252525] text-gray-800 dark:text-gray-100 text-[10px] md:text-xs"
                                    >
                                        <option value="all">Все сотрудники</option>
                                        {users.map((u) => (
                                            <option key={u.id} value={u.id}>
                                                {u.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex items-center gap-1">
                                    <ListFilter size={12} className="text-gray-400 md:w-[14px] md:h-[14px]" />
                                    <select
                                        value={projectFilter}
                                        onChange={(e) => setProjectFilter(e.target.value)}
                                        className="border border-gray-200 dark:border-[#333] rounded-lg px-1.5 md:px-2 py-1 bg-white dark:bg-[#252525] text-gray-800 dark:text-gray-100 text-[10px] md:text-xs"
                                    >
                                        <option value="all">Все модули</option>
                                        {projects.map((p) => (
                                            <option key={p.id} value={p.id}>
                                                {p.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setHideCompleted((v) => !v)}
                                    className={`inline-flex items-center gap-1 px-2 md:px-3 py-1 md:py-1.5 rounded-full border text-[10px] md:text-xs ${
                                        hideCompleted
                                            ? 'bg-gray-900 text-white border-gray-700'
                                            : 'bg-white dark:bg-[#252525] text-gray-700 dark:text-gray-200 border-gray-300 dark:border-[#444]'
                                    }`}
                                >
                                    <EyeOff size={12} className="md:w-[14px] md:h-[14px]" />
                                    <span className="hidden sm:inline">{hideCompleted ? 'Скрыть выполненные' : 'Показывать выполненные'}</span>
                                    <span className="sm:hidden">{hideCompleted ? 'Скрыть' : 'Показать'}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar min-h-0">
                    <div className={`${MODULE_PAGE_GUTTER} pb-24 md:pb-32`}>
                    {viewMode === ViewMode.TABLE && (
                        <TableView 
                            tasks={filteredTasks} 
                            users={users} 
                            projects={projects} 
                            statuses={statuses} 
                            priorities={priorities} 
                            tables={tables} 
                            isAggregator={isAggregator} 
                            currentUser={currentUser} 
                            businessProcesses={businessProcesses}
                            onUpdateTask={(id, updates) => actions.saveTask({ id, ...updates })} 
                            onDeleteTask={actions.deleteTask} 
                            onOpenTask={actions.openTaskModal} 
                        />
                    )}
                    {viewMode === ViewMode.KANBAN && (
                        <KanbanBoard 
                            tasks={filteredTasks} 
                            users={users} 
                            projects={projects} 
                            statuses={statuses} 
                            tables={tables} 
                            isAggregator={isAggregator} 
                            currentUser={currentUser} 
                            businessProcesses={businessProcesses}
                            onUpdateStatus={(id, s) => actions.saveTask({id, status: s})} 
                            onOpenTask={actions.openTaskModal} 
                        />
                    )}
                    {viewMode === ViewMode.GANTT && (
                        <GanttView tasks={filteredTasks} projects={projects} onOpenTask={actions.openTaskModal} />
                    )}
                    </div>
                </div>
            </ModulePageShell>
        );

    case 'backlog':
        // Функция для переноса идеи из беклога в работу
        const handleTakeToWork = (idea: Task) => {
            // Идемпотентность: если задача уже создана — просто открываем её.
            const existing = tasks.find((t) => t.entityType === 'task' && t.linkedIdeaId === idea.id && !t.isArchived);
            if (existing) {
                actions.openTaskModal(existing);
                return;
            }

            const workStatus =
                statuses.find(s => ['В работе', 'В работе ✅', 'В процессе', 'In progress', 'In Progress'].includes(s.name))?.name ||
                statuses.find(s => !['Выполнено', 'Done', 'Завершено'].includes(s.name))?.name ||
                statuses[0]?.name ||
                'Новая';
            
            const newTask: Partial<Task> = {
                entityType: 'task',
                tableId: '', // Для обычных задач tableId не используется
                title: idea.title,
                description: idea.description,
                projectId: idea.projectId,
                status: defaultStatus,
                priority: idea.priority || 'Средний',
                assigneeId: idea.assigneeId,
                assigneeIds: idea.assigneeIds,
                startDate: idea.startDate || new Date().toISOString().split('T')[0],
                endDate: idea.endDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                source: 'Беклог',
                linkedIdeaId: idea.id,
                attachments: idea.attachments,
                createdAt: new Date().toISOString()
            };
            
            actions.saveTask({ ...newTask, status: workStatus });
            // Идея должна исчезнуть из списка идей
            actions.saveTask({ id: idea.id, status: workStatus, isArchived: true });
        };

        return (
            <div className="h-full flex flex-col min-h-0">
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
                <BacklogView 
                    backlogIdeas={backlogIdeas}
                    backlogLinkedTasks={backlogLinkedTasks}
                    users={users}
                    statuses={statuses}
                    tables={tables}
                    onUpdateTask={(id, updates) => actions.saveTask({ id, ...updates })} 
                    onDeleteTask={actions.deleteTask} 
                    onOpenTask={actions.openTaskModal} 
                    onCreateTask={() => {
                        // При создании идеи в беклоге, устанавливаем entityType: 'idea' и tableId на текущий backlog
                        const newIdea: Partial<Task> = {
                            entityType: 'idea',
                            tableId: activeTable.id,
                            title: '',
                            status: 'Новая',
                            priority: 'Средний',
                            assigneeId: null,
                            startDate: new Date().toISOString().split('T')[0],
                            endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                            createdByUserId: currentUser.id,
                            createdAt: new Date().toISOString()
                        };
                        actions.openTaskModal(newIdea);
                    }}
                    onTakeToWork={handleTakeToWork}
                />
                </div>
            </div>
        );
    
    case 'functionality':
        // Функция для переноса функции из функционала в работу
        const handleTakeFeatureToWork = (feature: Task) => {
            // Идемпотентность: если задача уже создана — просто открываем её.
            const existing = tasks.find((t) => t.entityType === 'task' && t.linkedFeatureId === feature.id && !t.isArchived);
            if (existing) {
                actions.openTaskModal(existing);
                return;
            }

            const workStatus =
                statuses.find(s => ['В работе', 'В работе ✅', 'В процессе', 'In progress', 'In Progress'].includes(s.name))?.name ||
                statuses.find(s => !['Выполнено', 'Done', 'Завершено'].includes(s.name))?.name ||
                statuses[0]?.name ||
                'Новая';

            // Функция НЕ удаляется, остается с entityType: 'feature'
            // Создаем новую задачу на основе функции
            const newTask: Partial<Task> = {
                entityType: 'task',
                tableId: '', // Для обычных задач tableId не используется
                title: feature.title,
                description: feature.description,
                projectId: feature.projectId,
                category: feature.category,
                status: workStatus,
                priority: feature.priority,
                assigneeId: feature.assigneeId,
                assigneeIds: feature.assigneeIds,
                startDate: feature.startDate || new Date().toISOString().split('T')[0],
                endDate: feature.endDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                source: 'Функционал',
                linkedFeatureId: feature.id, // Связываем задачу с функцией
                attachments: feature.attachments,
                createdAt: new Date().toISOString()
            };
            
            actions.saveTask(newTask);
            // Обновляем статус функции (чтобы было видно, что взяли в работу)
            actions.saveTask({ id: feature.id, status: workStatus });
        };

        return (
            <div className="h-full flex flex-col min-h-0">
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
                <FunctionalityView 
                    features={allFunctionalityTasks} 
                    users={users} 
                    statuses={statuses}
                    projects={projects}
                    onUpdateFeature={(id, u) => actions.saveTask({id, ...u})} 
                    onDeleteFeature={actions.deleteTask} 
                    onOpenFeature={actions.openTaskModal} 
                    onCreateFeature={(projectId, category) => {
                        // При создании функции в функционале, находим подходящую functionality таблицу
                        // Если указан projectId, ищем таблицу для этого проекта, иначе используем activeTable
                        let targetTableId = activeTable.id;
                        
                        // Если указан projectId, ищем functionality таблицу для этого проекта
                        if (projectId) {
                            // Можно использовать первую попавшуюся functionality таблицу или создать новую
                            const functionalityTable = tables.find(t => t.type === 'functionality');
                            if (functionalityTable) {
                                targetTableId = functionalityTable.id;
                            }
                        }
                        
                        const newTask: Partial<Task> = {
                            entityType: 'feature',
                            tableId: targetTableId,
                            title: '',
                            status: 'Не начато',
                            assigneeId: null,
                            startDate: new Date().toISOString().split('T')[0],
                            endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                            projectId: projectId || null,
                            category: category || undefined,
                            createdByUserId: currentUser.id,
                            createdAt: new Date().toISOString()
                        };
                        actions.openTaskModal(newTask);
                    }}
                    onTakeToWork={handleTakeFeatureToWork}
                />
                </div>
            </div>
        );

    case 'meetings':
        return (
            <div className="h-full flex flex-col min-h-0">
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 pb-24 md:pb-32">
                <MeetingsView 
                    meetings={meetings} users={users} clients={clients} deals={deals} tableId={activeTable.id} showAll={activeTable.isSystem} tables={tables} 
                    onSaveMeeting={actions.saveMeeting} onDeleteMeeting={actions.deleteMeeting}                     onUpdateSummary={actions.updateMeetingSummary} 
                />
                </div>
            </div>
        );

    case 'content-plan':
        return (
            <div className="h-full flex flex-col min-h-0">
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
                <ContentPlanView 
                    posts={contentPosts} tableId={activeTable.id} tasks={tasks} 
                    activeTable={activeTable}
                    onSavePost={actions.savePost} onDeletePost={actions.deletePost} 
                    onOpenTask={actions.openTaskModal} onCreateTask={actions.openTaskModal} 
                />
                </div>
            </div>
        );

    case 'docs':
        return (
            <div className="h-full flex flex-col min-h-0">
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 pb-24 md:pb-32">
                <DocumentsView 
                    docs={docs} folders={folders} tableId={activeTable.id} showAll={activeTable.isSystem} tables={tables} 
                    tasks={tasks}
                    onOpenDoc={actions.handleDocClick} 
                    onAddDoc={(folderId) => actions.openDocModal(folderId)} 
                    onCreateFolder={(name, parentFolderId) => actions.createFolder(name, activeTable.id, parentFolderId)} 
                    onDeleteFolder={actions.deleteFolder} 
                    onDeleteDoc={actions.deleteDoc}
                    onDeleteAttachment={(taskId, attachmentId) => {
                        const task = tasks.find(t => t.id === taskId);
                        if (task) {
                            const updatedAttachments = (task.attachments || []).filter(a => a.id !== attachmentId);
                            actions.saveTask({ id: taskId, attachments: updatedAttachments });
                        }
                    }}
                />
                </div>
            </div>
        );

    default:
        return (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <AlertCircle size={48} className="mb-4 opacity-20" />
                <p>Тип страницы не поддерживается или в разработке</p>
            </div>
        );
  }
};
