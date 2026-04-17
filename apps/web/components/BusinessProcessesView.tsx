
import React, { useState, useEffect, useMemo, useLayoutEffect, useCallback } from 'react';
import { BusinessProcess, ProcessStep, ProcessStepBranch, OrgPosition, User, Task, ProcessInstance, TableCollection, EmployeeInfo } from '../types';
import { getStepsForInstance } from '../utils/bpmDealFunnel';
import { resolveAssigneesForOrgPosition } from '../utils/orgPositionAssignee';
import { Network, Plus, Edit2, Trash2, ChevronRight, User as UserIcon, Building2, Save, X, ArrowDown, Play, CheckCircle2, Clock, FileText, ArrowLeft, Calendar, Users, Layers3 } from 'lucide-react';
import { EntitySearchSelect } from './ui/EntitySearchSelect';
import { ProcessCard } from './features/processes/ProcessCard';
import {
  Button,
  ModuleCreateDropdown,
  ModuleFilterIconButton,
  ModulePageShell,
  ModuleSegmentedControl,
  MODULE_PAGE_GUTTER,
  MODULE_PAGE_TOP_PAD,
  SystemAlertDialog,
  APP_TOOLBAR_MODULE_CLUSTER,
  MODULE_ACCENTS,
  MODULE_TOOLBAR_TAB_IDLE,
} from './ui';
import { useAppToolbar } from '../contexts/AppToolbarContext';

interface BusinessProcessesViewProps {
  processes: BusinessProcess[];
  orgPositions: OrgPosition[];
  /** Карточки HR: привязка к должности (orgPositionId), в т.ч. несколько человек на пост */
  employees: EmployeeInfo[];
  users: User[];
  tasks: Task[];
  tables: TableCollection[];
  currentUser?: User | null;
  onSaveProcess: (proc: BusinessProcess) => void;
  onDeleteProcess: (id: string) => void;
  onSaveTask: (task: Partial<Task>) => void;
  onOpenTask: (task: Task) => void;
  onCompleteProcessStepWithBranch?: (instanceId: string, nextStepId: string) => void;
  /** Сохранить курсор round-robin при назначении по должности */
  onSavePosition?: (pos: OrgPosition) => void;
  autoOpenCreateModal?: boolean;
}

const BusinessProcessesView: React.FC<BusinessProcessesViewProps> = ({ 
    processes, orgPositions, employees, users, tasks, tables, currentUser, onSaveProcess, onDeleteProcess, onSaveTask, onOpenTask, onCompleteProcessStepWithBranch, onSavePosition, autoOpenCreateModal = false
}) => {
  const { setLeading, setModule } = useAppToolbar();
  const activeOrgPositions = useMemo(
      () => orgPositions.filter((p) => !p.isArchived),
      [orgPositions]
  );
  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(null);
  /** Шаблоны = описания процессов; В работе = active + paused; Завершённые = completed */
  const [activeTab, setActiveTab] = useState<'templates' | 'running' | 'completed'>('templates');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [startPickerOpen, setStartPickerOpen] = useState(false);
  const [bpmListFilterOpen, setBpmListFilterOpen] = useState(false);
  const [bpmSearchQuery, setBpmSearchQuery] = useState('');
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProcess, setEditingProcess] = useState<BusinessProcess | null>(null);
  const [editModalTab, setEditModalTab] = useState<'steps' | 'schema'>('steps');
  
  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState<ProcessStep[]>([]);
  const [alertText, setAlertText] = useState<string | null>(null);

  const tasksTableId = useMemo(() => tables.find((t) => t.type === 'tasks')?.id || '', [tables]);

  // Получаем только последние версии процессов для отображения в списке, исключаем архивные
  const uniqueProcesses = useMemo(() => {
    const processMap = new Map<string, BusinessProcess>();
    processes.filter(p => !p.isArchived).forEach(p => {
      const existing = processMap.get(p.id);
      if (!existing || (p.version || 1) > (existing.version || 1)) {
        processMap.set(p.id, p);
      }
    });
    return Array.from(processMap.values());
  }, [processes]);

  const userTemplates = useMemo(
    () => uniqueProcesses.filter((p) => !p.systemKey),
    [uniqueProcesses]
  );

  const selectedProcess = uniqueProcesses.find(p => p.id === selectedProcessId);

  const handleOpenCreate = useCallback(() => {
    setEditingProcess(null);
    setTitle('');
    setDescription('');
    setSteps([]);
    setEditModalTab('steps');
    setIsModalOpen(true);
  }, []);

  // Автоматически открываем модалку создания при монтировании, если autoOpenCreateModal = true
  useEffect(() => {
    if (autoOpenCreateModal) {
      handleOpenCreate();
    }
  }, [autoOpenCreateModal, handleOpenCreate]);

  // Слушаем событие для открытия модалки с рабочего стола (WorkdeskView)
  useEffect(() => {
    const handleOpenModal = () => {
      handleOpenCreate();
    };
    window.addEventListener('openCreateProcessModal', handleOpenModal);
    return () => window.removeEventListener('openCreateProcessModal', handleOpenModal);
  }, [handleOpenCreate]);

  const handleOpenEdit = (proc: BusinessProcess) => {
      const latestVersion = processes
        .filter(p => p.id === proc.id)
        .sort((a, b) => (b.version || 1) - (a.version || 1))[0] || proc;
      setEditingProcess(latestVersion);
      setTitle(latestVersion.title); setDescription(latestVersion.description || ''); setSteps(latestVersion.steps || []);
      setEditModalTab('steps');
      setIsModalOpen(true);
  };

  const handleAddStep = () => {
      const newStep: ProcessStep = {
          id: `step-${Date.now()}`,
          title: '',
          description: '',
          assigneeType: 'position',
          assigneeId: '',
          order: steps.length
      };
      setSteps([...steps, newStep]);
  };

  const handleUpdateStep = (id: string, updates: Partial<ProcessStep>) => {
      setSteps(steps.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const handleRemoveStep = (id: string) => {
      setSteps(steps.filter(s => s.id !== id));
  };

  const handleAddBranch = (stepId: string) => {
      const step = steps.find(s => s.id === stepId);
      if (!step) return;
      const branches = step.branches || [];
      const newBranch: ProcessStepBranch = {
          id: `br-${Date.now()}`,
          label: '',
          nextStepId: steps[0]?.id || ''
      };
      handleUpdateStep(stepId, { branches: [...branches, newBranch] });
  };

  const handleUpdateBranch = (stepId: string, branchId: string, updates: Partial<ProcessStepBranch>) => {
      const step = steps.find(s => s.id === stepId);
      if (!step?.branches) return;
      const branches = step.branches.map(b => b.id === branchId ? { ...b, ...updates } : b);
      handleUpdateStep(stepId, { branches });
  };

  const handleRemoveBranch = (stepId: string, branchId: string) => {
      const step = steps.find(s => s.id === stepId);
      if (!step?.branches) return;
      const branches = step.branches.filter(b => b.id !== branchId);
      handleUpdateStep(stepId, { branches: branches.length ? branches : undefined });
  };

  const handleSubmit = (e?: React.FormEvent) => {
      if (e) e.preventDefault();

      if (!String(title || '').trim()) {
          setAlertText('Укажите название процесса.');
          return;
      }

      const emptyStep = steps.find(s => !String(s.title || '').trim());
      if (steps.length > 0 && emptyStep) {
          setAlertText('Укажите название у каждого шага процесса.');
          return;
      }
      
      const now = new Date().toISOString();
      let version = 1;
      let createdAt = now;
      
      if (editingProcess) {
          // Проверяем, были ли изменения
          const titleChanged = editingProcess.title !== title;
          const descriptionChanged = editingProcess.description !== description;
          const stepsChanged = JSON.stringify(editingProcess.steps) !== JSON.stringify(steps);
          
          if (titleChanged || descriptionChanged || stepsChanged) {
              // Если были изменения, увеличиваем версию
              version = (editingProcess.version || 1) + 1;
          } else {
              version = editingProcess.version || 1;
          }
          createdAt = editingProcess.createdAt || now;
      }
      
      onSaveProcess({
          id: editingProcess ? editingProcess.id : `bp-${Date.now()}`,
          version,
          title,
          description,
          steps: steps || [],
          instances: editingProcess?.instances || [],
          createdAt,
          updatedAt: now,
          isArchived: editingProcess?.isArchived || false
      });
      setIsModalOpen(false);
      if (!editingProcess) {
          // Если создали новый процесс, открываем его
          const newProcessId = `bp-${Date.now()}`;
          setTimeout(() => {
              const savedProcess = processes.find(p => p.id === newProcessId) || processes[processes.length - 1];
              if (savedProcess) setSelectedProcessId(savedProcess.id);
          }, 100);
      }
  };

  const handleDelete = () => {
      if(editingProcess && confirm('Удалить процесс?')) {
          onDeleteProcess(editingProcess.id);
          setIsModalOpen(false);
          if (selectedProcessId === editingProcess.id) setSelectedProcessId(null);
      }
  };

  const getAssigneeName = (step: ProcessStep) => {
      if (step.assigneeType === 'position') {
          return orgPositions.find(p => p.id === step.assigneeId)?.title || 'Неизвестная должность';
      } else {
          return users.find(u => u.id === step.assigneeId)?.name || 'Неизвестный сотрудник';
      }
  };

  const getAssigneeId = (step: ProcessStep): string | null => {
      if (step.assigneeType === 'position') {
          const position = orgPositions.find(p => p.id === step.assigneeId);
          const resolved = resolveAssigneesForOrgPosition(position, employees);
          return resolved.assigneeId;
      } else {
          return step.assigneeId || null;
      }
  };

  const startProcessFor = (proc: BusinessProcess, opts?: { fromPicker?: boolean }) => {
      const fromPicker = opts?.fromPicker === true;
      if (proc.steps.length === 0) {
          setAlertText('Добавьте шаги в шаблон процесса.');
          return;
      }

      const firstStep = proc.steps[0];
      let assigneeId: string | null = null;
      let assigneeIds: string[] | undefined;
      if (firstStep.assigneeType === 'position') {
          const position = orgPositions.find((p) => p.id === firstStep.assigneeId);
          const resolved = resolveAssigneesForOrgPosition(position, employees);
          assigneeId = resolved.assigneeId;
          assigneeIds = resolved.assigneeIds;
          if (resolved.positionPatch && position && onSavePosition) {
              onSavePosition({ ...position, ...resolved.positionPatch });
          }
      } else {
          assigneeId = firstStep.assigneeId || null;
      }
      
      if (!assigneeId) {
          setAlertText('Не назначен исполнитель для первого шага');
          return;
      }

      const instanceId = `inst-${Date.now()}`;
      const instance: ProcessInstance = {
          id: instanceId,
          processId: proc.id,
          processVersion: proc.version || 1,
          currentStepId: firstStep.id,
          status: 'active',
          startedAt: new Date().toISOString(),
          taskIds: []
      };

      const taskId = `task-${Date.now()}`;
      const newTask: Partial<Task> = {
          id: taskId,
          entityType: 'task',
          tableId: tasksTableId || '',
          title: `${proc.title}: ${firstStep.title}`,
          description: firstStep.description || '',
          status: 'Не начато',
          priority: 'Средний',
          assigneeId: assigneeId,
          assigneeIds,
          source: 'Процесс',
          startDate: new Date().toISOString().split('T')[0],
          endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          processId: proc.id,
          processInstanceId: instanceId,
          stepId: firstStep.id,
          createdAt: new Date().toISOString(),
          createdByUserId: currentUser?.id // Постановщик - пользователь, который запустил процесс
      };

      instance.taskIds = [taskId];
      
      // Находим последнюю версию процесса для обновления экземпляров
      const latestVersion = processes
        .filter(p => p.id === proc.id)
        .sort((a, b) => (b.version || 1) - (a.version || 1))[0] || proc;
      
      const updatedProcess: BusinessProcess = {
          ...latestVersion,
          instances: [...(latestVersion.instances || []), instance]
      };

      onSaveProcess(updatedProcess);
      onSaveTask(newTask);
      if (fromPicker) {
          setStartPickerOpen(false);
          setActiveTab('running');
          setSelectedProcessId(null);
      }
  };

  const handleStartProcess = () => {
      if (!selectedProcess) return;
      startProcessFor(selectedProcess);
  };

  const getProcessInstances = (processId: string): ProcessInstance[] => {
      // Собираем все экземпляры из всех версий процесса
      const allInstances: ProcessInstance[] = [];
      processes.filter(p => p.id === processId).forEach(p => {
        if (p.instances) {
          allInstances.push(...p.instances);
        }
      });
      return allInstances;
  };

  const getInstanceTasks = (instanceId: string): Task[] => {
      return tasks.filter(t => t.processInstanceId === instanceId);
  };

  const getStepStatus = (stepId: string, instance: ProcessInstance | null, instanceTasks: Task[]): 'pending' | 'active' | 'completed' => {
      if (!instance) return 'pending';

      // Если шаг есть в истории выполненных — считаем completed
      if (instance.completedStepIds && instance.completedStepIds.includes(stepId)) {
          return 'completed';
      }

      if (instance.status === 'completed') {
          const stepTask = instanceTasks.find(t => t.stepId === stepId);
          return stepTask && (stepTask.status === 'Выполнено' || stepTask.status === 'Done') ? 'completed' : 'pending';
      }
      const stepTask = instanceTasks.find(t => t.stepId === stepId);
      if (stepTask && (stepTask.status === 'Выполнено' || stepTask.status === 'Done')) return 'completed';
      if (instance.currentStepId === stepId) return 'active';
      if (instance.pendingBranchSelection?.stepId === stepId) return 'active';
      return 'pending';
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
          setIsModalOpen(false);
      }
  };

  // Получаем все экземпляры всех процессов (нужно для вкладок)
  const allInstances: { process: BusinessProcess; instance: ProcessInstance; tasks: Task[] }[] = processes
    .filter(p => !p.isArchived) // Исключаем архивные процессы
    .flatMap(proc => 
      (proc.instances || []).map(instance => ({
        process: proc,
        instance,
        tasks: tasks.filter(t => t.processInstanceId === instance.id)
      }))
    );

  const runningInstances = useMemo(
    () => allInstances.filter(({ instance }) => instance.status === 'active' || instance.status === 'paused'),
    [allInstances]
  );

  const completedInstancesList = useMemo(
    () => allInstances.filter(({ instance }) => instance.status === 'completed'),
    [allInstances]
  );

  const tabInstanceList =
    activeTab === 'templates'
      ? []
      : activeTab === 'running'
        ? runningInstances
        : completedInstancesList;

  const filteredUserTemplates = useMemo(() => {
    const q = bpmSearchQuery.trim().toLowerCase();
    if (!q) return userTemplates;
    return userTemplates.filter((p) => (p.title || '').toLowerCase().includes(q));
  }, [userTemplates, bpmSearchQuery]);

  const filteredTabInstanceList = useMemo(() => {
    const q = bpmSearchQuery.trim().toLowerCase();
    if (!q) return tabInstanceList;
    return tabInstanceList.filter(({ process, instance }) => {
      const hay = `${process.title || ''} ${instance.id}`.toLowerCase();
      return hay.includes(q);
    });
  }, [tabInstanceList, bpmSearchQuery]);

  const renderStatusPill = (status: ProcessInstance['status']) => (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
        status === 'completed'
          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
          : status === 'paused'
            ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
            : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
      }`}
    >
      {status === 'active' && 'Активен'}
      {status === 'completed' && 'Завершён'}
      {status === 'paused' && 'Приостановлен'}
    </span>
  );

  const isProcessListView = !selectedProcessId && !selectedInstanceId;

  useLayoutEffect(() => {
    if (!isProcessListView) {
      setLeading(null);
      setModule(null);
      return;
    }
    const tabActive = MODULE_ACCENTS.cyan.navIconActive;
    const idle = MODULE_TOOLBAR_TAB_IDLE;
    const tabs: { id: 'templates' | 'running' | 'completed'; label: string }[] = [
      { id: 'templates', label: 'Шаблоны' },
      { id: 'running', label: 'В работе' },
      { id: 'completed', label: 'Завершённые' },
    ];
    setLeading(
      <div className="flex items-center gap-0.5 shrink-0 flex-wrap sm:flex-nowrap" role="tablist" aria-label="Бизнес-процессы">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={activeTab === t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-2 sm:px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-medium whitespace-nowrap transition-colors ${
              activeTab === t.id ? tabActive : idle
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    );
    setModule(
      <div className={APP_TOOLBAR_MODULE_CLUSTER}>
        <ModuleFilterIconButton
          accent="cyan"
          size="sm"
          active={bpmListFilterOpen || !!bpmSearchQuery.trim()}
          activeCount={bpmSearchQuery.trim() ? 1 : 0}
          label="Поиск по списку"
          onClick={() => setBpmListFilterOpen((o) => !o)}
        />
        <ModuleCreateDropdown
          accent="cyan"
          buttonSize="sm"
          items={[
            {
              id: 'template',
              label: 'Шаблон процесса',
              icon: Layers3,
              onClick: handleOpenCreate,
              iconClassName: 'text-indigo-600 dark:text-indigo-400',
            },
            {
              id: 'start-process',
              label: 'Запустить процесс…',
              icon: Play,
              onClick: () => setStartPickerOpen(true),
              iconClassName: 'text-emerald-600 dark:text-emerald-400',
            },
          ]}
        />
        <div className="flex items-center gap-0.5 shrink-0" role="tablist" aria-label="Вид списка">
          {(
            [
              { id: 'grid' as const, label: 'Плитка' },
              { id: 'list' as const, label: 'Список' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={viewMode === t.id}
              onClick={() => setViewMode(t.id)}
              className={`px-2 py-1 rounded-lg text-[11px] sm:text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                viewMode === t.id ? tabActive : idle
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
    );
    return () => {
      setLeading(null);
      setModule(null);
    };
  }, [
    isProcessListView,
    activeTab,
    viewMode,
    bpmListFilterOpen,
    bpmSearchQuery,
    handleOpenCreate,
    setLeading,
    setModule,
  ]);

  const renderInstancesTable = (items: Array<{ process: BusinessProcess; instance: ProcessInstance; tasks: Task[] }>) => {
    return (
      <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-[#202020]">
              <tr className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                <th className="text-left font-bold px-4 py-3">Процесс</th>
                <th className="text-left font-bold px-4 py-3">Статус</th>
                <th className="text-left font-bold px-4 py-3">Текущий шаг</th>
                <th className="text-left font-bold px-4 py-3">Задачи</th>
                <th className="text-left font-bold px-4 py-3">Запущен</th>
                <th className="text-left font-bold px-4 py-3">Завершён</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-[#333]">
              {items.map(({ process, instance, tasks: instanceTasks }) => {
                const steps = getStepsForInstance(process, instance);
                const currentStep = steps.find((s) => s.id === instance.currentStepId);
                const done = instanceTasks.filter((t) => t.status === 'Выполнено' || t.status === 'Done').length;
                const total = instanceTasks.length;
                return (
                  <tr
                    key={instance.id}
                    onClick={() => setSelectedInstanceId(instance.id)}
                    className="cursor-pointer hover:bg-gray-50 dark:hover:bg-[#2a2a2a] transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900 dark:text-white">{process.title}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">v{instance.processVersion || process.version || 1}</div>
                    </td>
                    <td className="px-4 py-3">{renderStatusPill(instance.status)}</td>
                    <td className="px-4 py-3">
                      {instance.status === 'completed' ? (
                        <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
                      ) : (
                        <span className="text-gray-700 dark:text-gray-300">{currentStep?.title || '—'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {total > 0 ? (
                        <span className="text-gray-700 dark:text-gray-300">{done}/{total}</span>
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                      {instance.startedAt ? new Date(instance.startedAt).toLocaleString('ru-RU') : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                      {instance.completedAt ? new Date(instance.completedAt).toLocaleString('ru-RU') : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderTemplatesTable = () => {
    return (
      <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-[#202020]">
              <tr className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                <th className="text-left font-bold px-4 py-3">Шаблон</th>
                <th className="text-left font-bold px-4 py-3">Шаги</th>
                <th className="text-left font-bold px-4 py-3">В работе</th>
                <th className="text-left font-bold px-4 py-3">Завершено</th>
                <th className="text-right font-bold px-4 py-3">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-[#333]">
              {filteredUserTemplates.map((process) => {
                const instances = getProcessInstances(process.id);
                const running = instances.filter((i) => i.status === 'active' || i.status === 'paused').length;
                const completed = instances.filter((i) => i.status === 'completed').length;
                return (
                  <tr
                    key={process.id}
                    onClick={() => setSelectedProcessId(process.id)}
                    className="cursor-pointer hover:bg-gray-50 dark:hover:bg-[#2a2a2a] transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900 dark:text-white">{process.title}</div>
                      {process.description ? (
                        <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">{process.description}</div>
                      ) : (
                        <div className="text-xs text-gray-400 dark:text-gray-500">—</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{process.steps?.length || 0}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{running}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{completed}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEdit(process);
                          }}
                          className="p-2 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg bg-gray-50 dark:bg-[#303030]"
                          title="Редактировать"
                          aria-label="Редактировать"
                        >
                          <Edit2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Если выбран экземпляр — показываем его детали (приоритет над страницей процесса)
  if (selectedInstanceId) {
      const instanceData = allInstances.find(({ instance: inst }) => inst.id === selectedInstanceId);
      if (!instanceData) {
          return (
              <div className="h-full flex flex-col items-center justify-center p-6">
                  <p className="text-gray-500 dark:text-gray-400 mb-4">Экземпляр не найден</p>
                  <button onClick={() => setSelectedInstanceId(null)} className="px-4 py-2 bg-gray-200 dark:bg-[#333] rounded-lg text-sm">← Назад к списку</button>
              </div>
          );
      }
      const process = instanceData.process;
      const inst = instanceData.instance;
      const instanceTasks = instanceData.tasks;
      const processVersion = processes.find(p => p.id === process.id && (p.version || 1) === (inst.processVersion || 1));

      return (
          <div className="h-full flex flex-col min-h-0 bg-white dark:bg-[#191919]">
              <div className="border-b border-gray-200 dark:border-[#333] bg-white dark:bg-[#252525] px-6 py-4 flex-shrink-0">
                  <div className={`${MODULE_PAGE_GUTTER} flex items-center justify-between`}>
                      <div className="flex items-center gap-4">
                          <button
                              onClick={() => setSelectedInstanceId(null)}
                              className="flex items-center gap-2 p-2 hover:bg-gray-100 dark:hover:bg-[#333] rounded-lg transition-colors text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                          >
                              <ArrowLeft size={20} />
                              <span className="text-sm font-medium">Назад к запущенным</span>
                          </button>
                          <div className="flex items-center gap-3">
                              <div className="bg-indigo-100 dark:bg-indigo-900/30 p-2 rounded-lg text-indigo-600 dark:text-indigo-400">
                                  <Network size={20} />
                              </div>
                              <div>
                                  <h1 className="text-xl font-bold text-gray-900 dark:text-white">{process.title}</h1>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                      Экземпляр v{inst.processVersion || process.version || 1} • {inst.status === 'active' ? 'Активен' : inst.status === 'completed' ? 'Завершён' : 'Приостановлен'} • Запущен {new Date(inst.startedAt).toLocaleString('ru-RU')}
                                  </p>
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
                  <div className={`${MODULE_PAGE_GUTTER} ${MODULE_PAGE_TOP_PAD} py-6`}>
                      {process.description && (
                          <div className="mb-6 p-4 bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-[#333] rounded-xl">
                              <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">О процессе</h3>
                              <p className="text-sm text-gray-700 dark:text-gray-300">{process.description}</p>
                          </div>
                      )}
                      {inst.pendingBranchSelection && onCompleteProcessStepWithBranch && (() => {
                          const step = (processVersion || process).steps.find(s => s.id === inst.pendingBranchSelection!.stepId);
                          if (!step || step.stepType !== 'variant' || !step.branches?.length) return null;
                          return (
                              <div className="mb-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-6">
                                  <h3 className="text-sm font-bold text-amber-800 dark:text-amber-200 uppercase mb-2">Выберите вариант перехода</h3>
                                  <p className="text-xs text-amber-700 dark:text-amber-300 mb-4">Шаг «{step.title}» завершён. Выберите, куда направить процесс:</p>
                                  <div className="flex flex-wrap gap-2">
                                      {step.branches.map(b => {
                                          const nextStep = (processVersion || process).steps.find(s => s.id === b.nextStepId);
                                          return (
                                              <button
                                                  key={b.id}
                                                  onClick={() => onCompleteProcessStepWithBranch(inst.id, b.nextStepId)}
                                                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors"
                                              >
                                                  {b.label}
                                                  {nextStep && <span className="ml-1 opacity-80">→ {nextStep.title}</span>}
                                              </button>
                                          );
                                      })}
                                  </div>
                              </div>
                          );
                      })()}
                      <div className="mb-6 bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl p-6 shadow-sm">
                          <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase mb-4">Шаги процесса (версия {inst.processVersion || process.version || 1})</h2>
                          <div className="space-y-3">
                              {(processVersion || process).steps.map((step, idx) => {
                                  const stepStatus = getStepStatus(step.id, inst, instanceTasks);
                                  const stepTask = instanceTasks.find(t => t.stepId === step.id);
                                  return (
                                      <div key={step.id} className="relative">
                                          <div className={`bg-gray-50 dark:bg-[#2a2a2a] border rounded-lg p-4 flex items-center justify-between ${
                                              stepStatus === 'completed' ? 'border-green-300 dark:border-green-700' :
                                              stepStatus === 'active' ? 'border-blue-300 dark:border-blue-700' :
                                              'border-gray-200 dark:border-[#333]'
                                          }`}>
                                              <div className="flex items-center gap-3 flex-1">
                                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                                                      stepStatus === 'completed' ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' :
                                                      stepStatus === 'active' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' :
                                                      'bg-gray-100 dark:bg-[#333] text-gray-600 dark:text-gray-400'
                                                  }`}>
                                                      {stepStatus === 'completed' ? <CheckCircle2 size={16} /> : idx + 1}
                                                  </div>
                                                  <div className="flex-1">
                                                      <div className="font-medium text-gray-900 dark:text-white text-sm">{step.title}</div>
                                                      {step.description && <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{step.description}</div>}
                                                      {stepTask && (
                                                          <div className="mt-2">
                                                              <button
                                                                  onClick={() => onOpenTask(stepTask as Task)}
                                                                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                                                              >
                                                                  <FileText size={12} /> {stepTask.title} ({stepTask.status})
                                                              </button>
                                                          </div>
                                                      )}
                                                  </div>
                                              </div>
                                              <div className="flex items-center gap-2 bg-white dark:bg-[#333] px-3 py-1.5 rounded-lg text-xs">
                                                  {step.assigneeType === 'position' ? <Building2 size={14} className="text-purple-500"/> : <UserIcon size={14} className="text-blue-500"/>}
                                                  <span className="text-gray-700 dark:text-gray-300 font-medium">{getAssigneeName(step)}</span>
                                              </div>
                                          </div>
                                          {idx < (processVersion || process).steps.length - 1 && (
                                              <div className="flex justify-center py-2"><ArrowDown size={16} className="text-gray-300 dark:text-gray-600"/></div>
                                          )}
                                      </div>
                                  );
                              })}
                          </div>
                      </div>
                      <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl p-6 shadow-sm">
                          <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Задачи экземпляра ({instanceTasks.length})</h2>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Нажмите на задачу, чтобы открыть и ознакомиться с деталями</p>
                          {instanceTasks.length === 0 ? (
                              <p className="text-sm text-gray-500 dark:text-gray-400 py-4">Пока нет задач по этому экземпляру</p>
                          ) : (
                              <div className="space-y-2">
                                  {instanceTasks.map(task => {
                                      const assignee = users.find(u => u.id === task.assigneeId);
                                      return (
                                          <div
                                              key={task.id}
                                              onClick={() => onOpenTask(task as Task)}
                                              className="flex items-center justify-between gap-3 p-3 bg-gray-50 dark:bg-[#2a2a2a] rounded-lg hover:bg-gray-100 dark:hover:bg-[#333] cursor-pointer transition-colors border border-transparent hover:border-indigo-200 dark:hover:border-indigo-800"
                                          >
                                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                                  <FileText size={14} className="text-gray-400 flex-shrink-0" />
                                                  <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{task.title}</span>
                                              </div>
                                              <div className="flex items-center gap-2 flex-shrink-0">
                                                  {assignee && <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:inline">{assignee.name}</span>}
                                                  {task.endDate && <span className="text-xs text-gray-400 dark:text-gray-500">{task.endDate}</span>}
                                                  <span className={`text-xs px-2 py-0.5 rounded ${
                                                      task.status === 'Выполнено' || task.status === 'Done'
                                                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                          : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                                                  }`}>{task.status}</span>
                                              </div>
                                          </div>
                                      );
                                  })}
                              </div>
                          )}
                      </div>
                  </div>
              </div>
          </div>
      );
  }

  // Если выбран процесс, показываем его страницу
  if (selectedProcess) {
      const instances = getProcessInstances(selectedProcess.id);
      const activeInstances = instances.filter(i => i.status === 'active');
      const completedInstances = instances.filter(i => i.status === 'completed');

      return (
          <div className="h-full flex flex-col min-h-0 bg-white dark:bg-[#191919]">
              {/* Header */}
              <div className="border-b border-gray-200 dark:border-[#333] bg-white dark:bg-[#252525] px-6 py-4 flex-shrink-0">
                  <div className={`${MODULE_PAGE_GUTTER} flex items-center justify-between`}>
                      <div className="flex items-center gap-4">
                          <button
                              onClick={() => setSelectedProcessId(null)}
                              className="p-2 hover:bg-gray-100 dark:hover:bg-[#333] rounded-lg transition-colors"
                          >
                              <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
                          </button>
                          <div className="flex items-center gap-3">
                              <div className="bg-indigo-100 dark:bg-indigo-900/30 p-2 rounded-lg text-indigo-600 dark:text-indigo-400">
                                  <Network size={20} />
                              </div>
                              <div>
                                  <h1 className="text-xl font-bold text-gray-900 dark:text-white">{selectedProcess.title}</h1>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                      {selectedProcess.description || 'Бизнес-процесс'}
                                  </p>
                              </div>
                          </div>
                      </div>
                      <div className="flex items-center gap-2">
                          <button
                              onClick={() => handleOpenEdit(selectedProcess)}
                              className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#333] rounded-lg transition-colors flex items-center gap-2"
                          >
                              <Edit2 size={16} />
                              Редактировать
                          </button>
                          {selectedProcess.steps.length > 0 && (
                              <button
                                  type="button"
                                  onClick={handleStartProcess}
                                  className="px-4 py-1.5 bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 rounded-lg flex items-center gap-2 shadow-sm"
                              >
                                  <Play size={16} />
                                  Запустить процесс
                              </button>
                          )}
                      </div>
                  </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
                  <div className={`${MODULE_PAGE_GUTTER} ${MODULE_PAGE_TOP_PAD} py-6`}>
                      {/* Process Steps Overview - Схема */}
                      <div className="mb-6 bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl p-6 shadow-sm">
                          <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase mb-4">Схема процесса</h2>
                          <div className="space-y-3">
                              {selectedProcess.steps.map((step, idx) => {
                                  const nextSteps: { label?: string; step: ProcessStep }[] = [];
                                  if (step.stepType === 'variant' && step.branches?.length) {
                                      step.branches.forEach(br => {
                                          const ns = selectedProcess.steps.find(s => s.id === br.nextStepId);
                                          if (ns) nextSteps.push({ label: br.label, step: ns });
                                      });
                                  } else {
                                      const next = step.nextStepId
                                          ? selectedProcess.steps.find(s => s.id === step.nextStepId)
                                          : selectedProcess.steps[idx + 1];
                                      if (next) nextSteps.push({ step: next });
                                  }
                                  return (
                                      <div key={step.id} className="relative">
                                          <div className={`bg-gray-50 dark:bg-[#2a2a2a] border rounded-lg p-4 flex items-center justify-between ${step.stepType === 'variant' ? 'border-amber-400 dark:border-amber-600' : 'border-gray-200 dark:border-[#333]'}`}>
                                              <div className="flex items-center gap-3 flex-1">
                                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${step.stepType === 'variant' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'}`}>
                                                      {idx + 1}
                                                  </div>
                                                  <div className="flex-1 min-w-0">
                                                      <div className="flex items-center gap-2">
                                                          <span className="font-medium text-gray-900 dark:text-white text-sm">{step.title}</span>
                                                          {step.stepType === 'variant' && (
                                                              <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded text-xs font-bold">Вариант</span>
                                                          )}
                                                      </div>
                                                      {step.description && (
                                                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{step.description}</div>
                                                      )}
                                                  </div>
                                              </div>
                                              <div className="flex items-center gap-2 bg-white dark:bg-[#333] px-3 py-1.5 rounded-lg text-xs shrink-0">
                                                  {step.assigneeType === 'position' ? (
                                                      <Building2 size={14} className="text-purple-500"/>
                                                  ) : (
                                                      <UserIcon size={14} className="text-blue-500"/>
                                                  )}
                                                  <span className="text-gray-700 dark:text-gray-300 font-medium">
                                                      {getAssigneeName(step)}
                                                  </span>
                                              </div>
                                          </div>
                                          {nextSteps.length > 0 && (
                                              <div className="flex flex-wrap gap-2 justify-center py-2">
                                                  {nextSteps.map((n, i) => (
                                                      <div key={i} className="flex items-center gap-1">
                                                          {n.label && <span className="text-xs text-gray-500 dark:text-gray-400 px-1">{n.label}:</span>}
                                                          <ArrowDown size={16} className="text-gray-300 dark:text-gray-600"/>
                                                          <span className="text-xs text-gray-500 dark:text-gray-400">→ {n.step.title}</span>
                                                      </div>
                                                  ))}
                                              </div>
                                          )}
                                      </div>
                                  );
                              })}
                              {selectedProcess.steps.length === 0 && (
                                  <div className="text-center text-gray-400 dark:text-gray-500 text-sm py-8">
                                      В процессе нет шагов. Отредактируйте процесс, чтобы добавить шаги.
                                  </div>
                              )}
                          </div>
                      </div>

                      {/* Instances */}
                      <div className="space-y-4">
                          {/* Active Instances */}
                          {activeInstances.length > 0 && (
                              <div>
                                  <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase mb-3">Активные экземпляры ({activeInstances.length})</h2>
                                  <div className="space-y-3">
                                      {activeInstances.map(instance => {
                                          const instanceTasks = getInstanceTasks(instance.id);
                                          const currentStep = getStepsForInstance(selectedProcess, instance).find((s) => s.id === instance.currentStepId);
                                          
                                          return (
                                              <div key={instance.id} className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl p-5 shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedInstanceId(instance.id)}>
                                                  <div className="flex items-start justify-between mb-4">
                                                      <div className="flex-1">
                                                          <div className="flex items-center gap-2 mb-1">
                                                              <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-xs font-medium">
                                                                  Активен
                                                              </span>
                                                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                                                  v{instance.processVersion || selectedProcess.version || 1}
                                                              </span>
                                                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                                                  Запущен {new Date(instance.startedAt).toLocaleString('ru-RU')}
                                                              </span>
                                                          </div>
                                                          {currentStep && (
                                                              <div className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                                                                  Текущий шаг: {currentStep.title}
                                                              </div>
                                                          )}
                                                      </div>
                                                      <ChevronRight size={16} className="text-gray-400 shrink-0" />
                                                  </div>
                                                  
                                                  {instanceTasks.length > 0 && (
                                                      <div className="border-t border-gray-100 dark:border-[#333] pt-4">
                                                          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Задачи:</div>
                                                          <div className="space-y-2">
                                                              {instanceTasks.map(task => (
                                                                  <div
                                                                      key={task.id}
                                                                      className="flex items-center justify-between p-2 bg-gray-50 dark:bg-[#2a2a2a] rounded-lg"
                                                                  >
                                                                      <div className="flex items-center gap-2">
                                                                          <FileText size={14} className="text-gray-400" />
                                                                          <span className="text-sm text-gray-700 dark:text-gray-300">{task.title}</span>
                                                                      </div>
                                                                      <span className={`text-xs px-2 py-0.5 rounded ${
                                                                          task.status === 'Выполнено' || task.status === 'Done'
                                                                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                                              : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                                                                      }`}>
                                                                          {task.status}
                                                                      </span>
                                                                  </div>
                                                              ))}
                                                          </div>
                                                      </div>
                                                  )}
                                              </div>
                                          );
                                      })}
                                  </div>
                              </div>
                          )}

                          {/* Completed Instances */}
                          {completedInstances.length > 0 && (
                              <div>
                                  <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase mb-3">Завершённые экземпляры ({completedInstances.length})</h2>
                                  <div className="space-y-2">
                                      {completedInstances.map(instance => {
                                          const instanceTasks = getInstanceTasks(instance.id);
                                          
                                          return (
                                              <div key={instance.id} className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedInstanceId(instance.id)}>
                                                  <div className="flex items-center justify-between">
                                                      <div className="flex items-center gap-2">
                                                          <CheckCircle2 size={16} className="text-green-500" />
                                                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                                                              Завершён {instance.completedAt ? new Date(instance.completedAt).toLocaleString('ru-RU') : ''}
                                                          </span>
                                                          <span className="text-xs text-gray-500 dark:text-gray-400">
                                                              v{instance.processVersion || selectedProcess.version || 1}
                                                          </span>
                                                      </div>
                                                      <div className="flex items-center gap-2">
                                                          <span className="text-xs text-gray-500 dark:text-gray-400">
                                                              {instanceTasks.length} задач
                                                          </span>
                                                          <ChevronRight size={16} className="text-gray-400" />
                                                      </div>
                                                  </div>
                                              </div>
                                          );
                                      })}
                                  </div>
                              </div>
                          )}

                          {/* Empty State */}
                          {instances.length === 0 && (
                              <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl p-12 text-center">
                                  <Network size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                                  <p className="text-gray-500 dark:text-gray-400 text-sm mb-2">Нет запущенных экземпляров</p>
                                  <p className="text-xs text-gray-400 dark:text-gray-500">Нажмите "Запустить процесс" чтобы создать первый экземпляр</p>
                              </div>
                          )}
                      </div>
                  </div>
              </div>

              {/* Edit Modal */}
              {isModalOpen && (
                  <div
                    className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/50 dark:bg-black/70 backdrop-blur-sm p-0 md:p-4 animate-in fade-in duration-200"
                    onClick={handleBackdropClick}
                  >
                      <div
                        className="w-full max-w-2xl overflow-hidden rounded-t-2xl md:rounded-2xl border border-gray-200 dark:border-[#333] bg-white dark:bg-[#191919] shadow-2xl flex flex-col max-h-[95vh] md:max-h-[90vh] animate-in slide-in-from-bottom md:zoom-in-95 duration-200"
                        onClick={e => e.stopPropagation()}
                      >
                          <div className="p-4 md:p-5 border-b border-gray-200 dark:border-[#333] flex justify-between items-center gap-2 bg-white dark:bg-[#191919] shrink-0">
                              <h3 className="font-bold text-base md:text-lg text-gray-900 dark:text-white truncate">{editingProcess ? 'Редактировать процесс' : 'Новый процесс'}</h3>
                              <div className="flex items-center gap-1 shrink-0">
                                {editingProcess && (
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                                  >
                                    <Trash2 size={16} />
                                    <span className="hidden sm:inline">Удалить</span>
                                  </button>
                                )}
                                <button type="button" onClick={() => setIsModalOpen(false)} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-[#252525] text-gray-500 dark:text-gray-400" aria-label="Закрыть"><X size={20} /></button>
                              </div>
                          </div>
                          <div className="px-4 py-3 border-b border-gray-200 dark:border-[#333] bg-white dark:bg-[#191919]">
                              <div className="inline-flex w-full sm:w-auto gap-1 p-1 rounded-xl bg-gray-100 dark:bg-[#252525] border border-gray-200/80 dark:border-[#333]">
                              <button type="button" onClick={() => setEditModalTab('steps')} className={`flex-1 sm:flex-none px-3 py-2 text-sm font-medium rounded-lg transition-colors ${editModalTab === 'steps' ? 'bg-white dark:bg-[#2a2a2a] text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}`}>
                                  Шаги
                              </button>
                              <button type="button" onClick={() => setEditModalTab('schema')} className={`flex-1 sm:flex-none px-3 py-2 text-sm font-medium rounded-lg transition-colors ${editModalTab === 'schema' ? 'bg-white dark:bg-[#2a2a2a] text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}`}>
                                  Схема
                              </button>
                              </div>
                          </div>
                          
                          <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col min-h-0">
                              <div className="p-4 md:p-6 overflow-y-auto custom-scrollbar space-y-6">
                                  <div className="space-y-4">
                                      <div>
                                          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Название процесса</label>
                                          <input value={title} onChange={e => setTitle(e.target.value)} className="w-full rounded-xl border border-gray-200 dark:border-[#333] bg-gray-50 dark:bg-[#252525] px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 outline-none" placeholder="Например: Согласование договора"/>
                                      </div>
                                      <div>
                                          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Описание</label>
                                          <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full h-24 rounded-xl border border-gray-200 dark:border-[#333] bg-gray-50 dark:bg-[#252525] px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 resize-none focus:ring-2 focus:ring-indigo-500/30 outline-none"/>
                                      </div>
                                  </div>

                                  {editModalTab === 'schema' && (
                                      <div className="border border-gray-200 dark:border-[#333] rounded-2xl p-4 bg-gray-50 dark:bg-[#202020]">
                                          {steps.length > 0 ? (
                                          <>
                                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Визуализация процесса. Редактируйте шаги и связи во вкладке «Шаги».</p>
                                          <div className="space-y-2">
                                              {steps.map((step, idx) => {
                                                  const nextSteps: { label?: string; step: ProcessStep }[] = [];
                                                  if (step.stepType === 'variant' && step.branches?.length) {
                                                      step.branches.forEach(br => {
                                                          const ns = steps.find(s => s.id === br.nextStepId);
                                                          if (ns) nextSteps.push({ label: br.label, step: ns });
                                                      });
                                                  } else {
                                                      const next = step.nextStepId ? steps.find(s => s.id === step.nextStepId) : steps[idx + 1];
                                                      if (next) nextSteps.push({ step: next });
                                                  }
                                                  return (
                                                      <div key={step.id} className="flex items-center gap-2">
                                                          <div className={`w-7 h-7 rounded flex items-center justify-center text-xs font-bold shrink-0 ${step.stepType === 'variant' ? 'bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200' : 'bg-indigo-200 dark:bg-indigo-800 text-indigo-800 dark:text-indigo-200'}`}>{idx + 1}</div>
                                                          <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate flex-1">{step.title || '(без названия)'}</span>
                                                          {step.stepType === 'variant' && <span className="text-xs text-amber-600 dark:text-amber-400">вариант</span>}
                                                          {nextSteps.length > 0 && (
                                                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                                                  → {nextSteps.map(n => n.label ? `${n.label}: ${n.step.title}` : n.step.title).join('; ')}
                                                              </span>
                                                          )}
                                                      </div>
                                                  );
                                              })}
                                          </div>
                                          </>
                                          ) : (
                                              <p className="text-sm text-gray-500 dark:text-gray-400">Добавьте шаги во вкладке «Шаги», чтобы увидеть схему процесса.</p>
                                          )}
                                      </div>
                                  )}

                                  {editModalTab === 'steps' && <div className="border-t border-gray-200 dark:border-[#333] pt-4">
                                      <div className="flex justify-between items-center mb-4 gap-2">
                                          <h4 className="font-bold text-gray-900 dark:text-gray-100 text-sm">Шаги процесса</h4>
                                          <button type="button" onClick={handleAddStep} className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 text-xs font-semibold flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/80 dark:bg-indigo-950/30 shrink-0"><Plus size={14}/> Добавить шаг</button>
                                      </div>

                                      <div className="space-y-4">
                                          {steps.map((step, index) => (
                                              <div key={step.id} className="bg-gray-50 dark:bg-[#252525] p-4 rounded-2xl border border-gray-200 dark:border-[#333] relative group">
                                                  <button type="button" onClick={() => handleRemoveStep(step.id)} className="absolute top-2 right-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-white/80 dark:hover:bg-[#333]"><Trash2 size={14}/></button>
                                                  <div className="flex items-center gap-2 mb-3 pr-8">
                                                      <span className="text-xs font-bold text-white w-7 h-7 rounded-full bg-indigo-600 dark:bg-indigo-500 flex items-center justify-center shrink-0 shadow-sm">{index + 1}</span>
                                                      <input
                                                          value={step.title}
                                                          onChange={e => handleUpdateStep(step.id, { title: e.target.value })}
                                                          className="flex-1 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#444] rounded-xl px-3 py-2 text-sm font-medium text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500/30 outline-none"
                                                          placeholder="Название шага *"
                                                      />
                                                  </div>
                                                  <textarea
                                                      value={step.description || ''}
                                                      onChange={e => handleUpdateStep(step.id, { description: e.target.value })}
                                                      rows={2}
                                                      className="w-full bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#444] rounded-xl px-3 py-2 text-xs text-gray-600 dark:text-gray-400 placeholder-gray-400 mb-3 resize-none focus:ring-2 focus:ring-indigo-500/30 outline-none"
                                                      placeholder="Описание действий..."
                                                  />
                                                  <div className="flex gap-2">
                                                      <EntitySearchSelect
                                                          searchable={false}
                                                          value={step.assigneeType}
                                                          onChange={(val) => handleUpdateStep(step.id, { assigneeType: val as any, assigneeId: '' })}
                                                          options={[
                                                              { value: 'position', label: 'Должность' },
                                                              { value: 'user', label: 'Сотрудник' },
                                                          ]}
                                                          className="w-1/3 text-xs"
                                                      />
                                                      <EntitySearchSelect
                                                          value={step.assigneeId}
                                                          onChange={(val) => handleUpdateStep(step.id, { assigneeId: val })}
                                                          options={[
                                                              { value: '', label: 'Выберите...' },
                                                              ...(step.assigneeType === 'position' 
                                                                  ? activeOrgPositions.map(p => ({ value: p.id, label: p.title, searchText: p.title }))
                                                                  : users.map(u => ({ value: u.id, label: u.name, searchText: u.name }))
                                                              )
                                                          ]}
                                                          className="flex-1 text-xs"
                                                          searchPlaceholder="Поиск…"
                                                      />
                                                  </div>
                                                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-[#444]">
                                                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2">Тип шага</label>
                                                      <EntitySearchSelect
                                                          searchable={false}
                                                          value={step.stepType || 'normal'}
                                                          onChange={(val) => handleUpdateStep(step.id, { stepType: val as 'normal' | 'variant', branches: val === 'variant' ? (step.branches || [{ id: `br-${Date.now()}`, label: 'Вариант 1', nextStepId: steps[0]?.id || '' }]) : undefined })}
                                                          options={[
                                                              { value: 'normal', label: 'Обычный (линейный переход)' },
                                                              { value: 'variant', label: 'Вариант (ветвление процесса)' },
                                                          ]}
                                                          className="w-full text-xs"
                                                      />
                                                      {step.stepType === 'variant' && (
                                                          <div className="mt-3 space-y-2">
                                                              <div className="flex justify-between items-center">
                                                                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Варианты перехода</span>
                                                                  <button type="button" onClick={() => handleAddBranch(step.id)} className="text-indigo-600 hover:text-indigo-700 text-xs flex items-center gap-1">
                                                                      <Plus size={12}/> Добавить
                                                                  </button>
                                                              </div>
                                                              {(step.branches || []).map(br => (
                                                                  <div key={br.id} className="flex gap-2 items-center bg-white dark:bg-[#252525] p-2 rounded border border-gray-200 dark:border-[#444]">
                                                                      <input
                                                                          value={br.label}
                                                                          onChange={e => handleUpdateBranch(step.id, br.id, { label: e.target.value })}
                                                                          placeholder="Название варианта"
                                                                          className="flex-1 px-2 py-1 text-xs border border-gray-200 dark:border-[#555] rounded bg-transparent text-gray-800 dark:text-gray-200"
                                                                      />
                                                                      <EntitySearchSelect
                                                                          value={br.nextStepId}
                                                                          onChange={(val) => handleUpdateBranch(step.id, br.id, { nextStepId: val })}
                                                                          options={[
                                                                              { value: '', label: 'След. шаг...' },
                                                                              ...steps.filter(s => s.id !== step.id).map(s => ({
                                                                                  value: s.id,
                                                                                  label: s.title || '(без названия)',
                                                                                  searchText: s.title || '',
                                                                              }))
                                                                          ]}
                                                                          className="w-40 text-xs"
                                                                          searchPlaceholder="Шаг…"
                                                                      />
                                                                      <button type="button" onClick={() => handleRemoveBranch(step.id, br.id)} className="p-1 text-gray-400 hover:text-red-500"><Trash2 size={12}/></button>
                                                                  </div>
                                                              ))}
                                                          </div>
                                                      )}
                                                  </div>
                                              </div>
                                          ))}
                                      </div>
                                  </div>}
                              </div>

                              <div className="p-4 md:p-6 border-t border-gray-200 dark:border-[#333] bg-white dark:bg-[#191919] flex justify-end items-center gap-2 shrink-0">
                                   <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} size="md">Отмена</Button>
                                   <Button type="submit" size="md" icon={Save} className="!bg-indigo-600 hover:!bg-indigo-700 !text-white focus:!ring-indigo-500">Сохранить</Button>
                              </div>
                          </form>
                      </div>
                  </div>
              )}
              <SystemAlertDialog
                open={!!alertText}
                title="Бизнес-процессы"
                message={alertText || ''}
                onClose={() => setAlertText(null)}
              />
          </div>
      );
  }

  // Если выбран экземпляр, показываем его детали
  if (selectedInstanceId) {
      const instance = allInstances.find(({ instance: inst }) => inst.id === selectedInstanceId);
      if (!instance) {
          setSelectedInstanceId(null);
          return null;
      }

      const process = instance.process;
      const inst = instance.instance;
      const instanceTasks = instance.tasks;
      // Находим версию процесса, которая была на момент запуска экземпляра
      const processVersion = processes.find(p => p.id === process.id && (p.version || 1) === (inst.processVersion || 1));

      return (
          <div className="h-full flex flex-col min-h-0 bg-white dark:bg-[#191919]">
              {/* Header */}
              <div className="border-b border-gray-200 dark:border-[#333] bg-white dark:bg-[#252525] px-6 py-4 flex-shrink-0">
                  <div className={`${MODULE_PAGE_GUTTER} flex items-center justify-between`}>
                      <div className="flex items-center gap-4">
                          <button
                              onClick={() => setSelectedInstanceId(null)}
                              className="p-2 hover:bg-gray-100 dark:hover:bg-[#333] rounded-lg transition-colors"
                          >
                              <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
                          </button>
                          <div className="flex items-center gap-3">
                              <div className="bg-indigo-100 dark:bg-indigo-900/30 p-2 rounded-lg text-indigo-600 dark:text-indigo-400">
                                  <Network size={20} />
                              </div>
                              <div>
                                  <h1 className="text-xl font-bold text-gray-900 dark:text-white">{process.title}</h1>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                      Экземпляр v{inst.processVersion || process.version || 1} • {inst.status === 'active' ? 'Активен' : 'Завершён'} • Запущен {new Date(inst.startedAt).toLocaleString('ru-RU')}
                                  </p>
                              </div>
                          </div>
                      </div>
                  </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
                  <div className={`${MODULE_PAGE_GUTTER} ${MODULE_PAGE_TOP_PAD} py-6`}>
                      {/* Выбор ветки при варианте */}
                      {inst.pendingBranchSelection && onCompleteProcessStepWithBranch && (() => {
                          const step = (processVersion || process).steps.find(s => s.id === inst.pendingBranchSelection!.stepId);
                          if (!step || step.stepType !== 'variant' || !step.branches?.length) return null;
                          return (
                              <div className="mb-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-6">
                                  <h3 className="text-sm font-bold text-amber-800 dark:text-amber-200 uppercase mb-2">Выберите вариант перехода</h3>
                                  <p className="text-xs text-amber-700 dark:text-amber-300 mb-4">Шаг «{step.title}» завершён. Выберите, куда направить процесс:</p>
                                  <div className="flex flex-wrap gap-2">
                                      {step.branches.map(b => {
                                          const nextStep = (processVersion || process).steps.find(s => s.id === b.nextStepId);
                                          return (
                                              <button
                                                  key={b.id}
                                                  onClick={() => onCompleteProcessStepWithBranch(inst.id, b.nextStepId)}
                                                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors"
                                              >
                                                  {b.label}
                                                  {nextStep && <span className="ml-1 opacity-80">→ {nextStep.title}</span>}
                                              </button>
                                          );
                                      })}
                                  </div>
                              </div>
                          );
                      })()}

                      {/* Process Steps with Status */}
                      <div className="mb-6 bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl p-6 shadow-sm">
                          <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase mb-4">Шаги процесса (версия {inst.processVersion || process.version || 1})</h2>
                          <div className="space-y-3">
                              {(processVersion || process).steps.map((step, idx) => {
                                  const stepStatus = getStepStatus(step.id, inst, instanceTasks);
                                  const stepTask = instanceTasks.find(t => t.stepId === step.id);
                                  const isOnPath =
                                    (inst.completedStepIds?.includes(step.id) ||
                                      stepStatus === 'active' ||
                                      !!stepTask ||
                                      inst.pendingBranchSelection?.stepId === step.id);
                                  const chosenBranch = inst.branchHistory?.find(b => b.stepId === step.id);
                                  
                                  return (
                                      <div key={step.id} className="relative">
                                          <div className={`border rounded-lg p-4 flex items-center justify-between ${
                                              stepStatus === 'completed'
                                                ? 'bg-green-50 dark:bg-green-900/10 border-green-300 dark:border-green-700'
                                                : stepStatus === 'active'
                                                ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-300 dark:border-blue-700'
                                                : isOnPath
                                                ? 'bg-gray-50 dark:bg-[#2a2a2a] border-gray-300 dark:border-[#444]'
                                                : 'bg-gray-50/60 dark:bg-[#1f1f1f] border-gray-200/70 dark:border-[#333] opacity-70'
                                          }`}>
                                              <div className="flex items-center gap-3 flex-1">
                                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                                                      stepStatus === 'completed' ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' :
                                                      stepStatus === 'active' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' :
                                                      'bg-gray-100 dark:bg-[#333] text-gray-600 dark:text-gray-400'
                                                  }`}>
                                                      {stepStatus === 'completed' ? <CheckCircle2 size={16} /> : idx + 1}
                                                  </div>
                                                  <div className="flex-1">
                                                      <div className="font-medium text-gray-900 dark:text-white text-sm">{step.title}</div>
                                                      {step.description && (
                                                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{step.description}</div>
                                                      )}
                                                      {chosenBranch && (
                                                          <div className="text-[11px] text-amber-700 dark:text-amber-300 mt-1">
                                                              Выбран вариант: {chosenBranch.branchId ? `ветка ${chosenBranch.branchId}` : 'без названия'}
                                                          </div>
                                                      )}
                                                      {stepTask && (
                                                          <div className="mt-2">
                                                              <button
                                                                  onClick={() => onOpenTask(stepTask as Task)}
                                                                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                                                              >
                                                                  <FileText size={12} />
                                                                  {stepTask.title} ({stepTask.status})
                                                              </button>
                                                          </div>
                                                      )}
                                                  </div>
                                              </div>
                                              <div className="flex items-center gap-2 bg-white dark:bg-[#333] px-3 py-1.5 rounded-lg text-xs">
                                                  {step.assigneeType === 'position' ? (
                                                      <Building2 size={14} className="text-purple-500"/>
                                                  ) : (
                                                      <UserIcon size={14} className="text-blue-500"/>
                                                  )}
                                                  <span className="text-gray-700 dark:text-gray-300 font-medium">
                                                      {getAssigneeName(step)}
                                                  </span>
                                              </div>
                                          </div>
                                          {idx < (processVersion || process).steps.length - 1 && (
                                              <div className="flex justify-center py-2">
                                                  <ArrowDown size={16} className="text-gray-300 dark:text-gray-600"/>
                                              </div>
                                          )}
                                      </div>
                                  );
                              })}
                          </div>
                      </div>

                      {/* Tasks */}
                      {instanceTasks.length > 0 && (
                          <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl p-6 shadow-sm">
                              <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase mb-4">Задачи экземпляра ({instanceTasks.length})</h2>
                              <div className="space-y-2">
                                  {instanceTasks.map(task => (
                                      <div
                                          key={task.id}
                                          onClick={() => onOpenTask(task as Task)}
                                          className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#2a2a2a] rounded-lg hover:bg-gray-100 dark:hover:bg-[#333] cursor-pointer transition-colors"
                                      >
                                          <div className="flex items-center gap-2">
                                              <FileText size={14} className="text-gray-400" />
                                              <span className="text-sm text-gray-700 dark:text-gray-300">{task.title}</span>
                                          </div>
                                          <span className={`text-xs px-2 py-0.5 rounded ${
                                              task.status === 'Выполнено' || task.status === 'Done'
                                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                  : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                                          }`}>
                                              {task.status}
                                          </span>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      );
  }

  // Список процессов
  return (
    <ModulePageShell>
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className={`${MODULE_PAGE_GUTTER} ${MODULE_PAGE_TOP_PAD} pb-20 h-full overflow-y-auto custom-scrollbar`}>
          {bpmListFilterOpen && (
            <div className="mb-3 p-3 rounded-xl border border-gray-200 dark:border-[#333] bg-gray-50 dark:bg-[#1a1a1a]">
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Поиск по названию</label>
              <input
                value={bpmSearchQuery}
                onChange={(e) => setBpmSearchQuery(e.target.value)}
                placeholder="Название процесса или ID экземпляра…"
                className="w-full max-w-md h-9 rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#252525] px-3 text-sm text-gray-900 dark:text-gray-100"
              />
            </div>
          )}
          {activeTab === 'templates' ? (
            userTemplates.length === 0 ? (
            <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl p-12 text-center">
              <Network size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-2">Нет своих шаблонов</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Создайте первый шаблон процесса</p>
              <ModuleCreateDropdown
                accent="cyan"
                align="left"
                items={[
                  {
                    id: 'template',
                    label: 'Шаблон процесса',
                    icon: Layers3,
                    onClick: handleOpenCreate,
                    iconClassName: 'text-indigo-600 dark:text-indigo-400',
                  },
                  {
                    id: 'start-process',
                    label: 'Запустить процесс…',
                    icon: Play,
                    onClick: () => setStartPickerOpen(true),
                    iconClassName: 'text-emerald-600 dark:text-emerald-400',
                  },
                ]}
              />
            </div>
          ) : filteredUserTemplates.length === 0 ? (
            <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl p-8 text-center text-sm text-gray-500 dark:text-gray-400">
              Ничего не найдено по запросу.
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-4">
              {filteredUserTemplates.map(process => {
                const instances = getProcessInstances(process.id);
                return (
                  <ProcessCard
                    key={process.id}
                    process={process}
                    instances={instances}
                    onClick={() => setSelectedProcessId(process.id)}
                    onEdit={(e) => {
                      e.stopPropagation();
                      handleOpenEdit(process);
                    }}
                  />
                );
              })}
            </div>
          ) : (
            renderTemplatesTable()
          )
          ) : (
            <div>
              {filteredTabInstanceList.length === 0 ? (
                <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl p-12 text-center">
                  {tabInstanceList.length > 0 && bpmSearchQuery.trim() ? (
                    <>
                      <p className="text-gray-500 dark:text-gray-400 text-sm mb-2">Ничего не найдено по запросу.</p>
                      <button
                        type="button"
                        onClick={() => setBpmSearchQuery('')}
                        className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
                      >
                        Сбросить поиск
                      </button>
                    </>
                  ) : (
                    <>
                      {activeTab === 'running' ? (
                        <Play size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                      ) : (
                        <CheckCircle2 size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                      )}
                      <p className="text-gray-500 dark:text-gray-400 text-sm mb-2">
                        {activeTab === 'running'
                          ? 'Нет процессов в работе'
                          : 'Пока нет завершённых экземпляров'}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {activeTab === 'running'
                          ? 'Запустите процесс со страницы шаблона или из карточки процесса.'
                          : 'После прохождения всех шагов экземпляр появится здесь.'}
                      </p>
                    </>
                  )}
                </div>
              ) : viewMode === 'grid' ? (
                <div className="space-y-3">
                  {filteredTabInstanceList.map(({ process, instance, tasks }) => {
                    const currentStep = getStepsForInstance(process, instance).find((s) => s.id === instance.currentStepId);
                    const completedTasks = tasks.filter(t => t.status === 'Выполнено' || t.status === 'Done').length;
                    const totalTasks = tasks.length;
                    
                    return (
                      <div
                        key={instance.id}
                        onClick={() => setSelectedInstanceId(instance.id)}
                        className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl p-5 hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-600 transition-all cursor-pointer group"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-bold text-gray-900 dark:text-white text-base group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                                {process.title}
                              </h3>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                v{instance.processVersion || process.version || 1}
                              </span>
                              {renderStatusPill(instance.status)}
                            </div>
                            {currentStep && instance.status !== 'completed' && (
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                Текущий шаг: {currentStep.title}
                              </p>
                            )}
                          </div>
                          <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 text-sm font-medium flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            Открыть <ChevronRight size={18} />
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                          <div className="flex items-center gap-1">
                            <Calendar size={14} />
                            <span>Запущен {new Date(instance.startedAt).toLocaleString('ru-RU')}</span>
                          </div>
                          {instance.completedAt && (
                            <div className="flex items-center gap-1">
                              <CheckCircle2 size={14} />
                              <span>Завершён {new Date(instance.completedAt).toLocaleString('ru-RU')}</span>
                            </div>
                          )}
                          {totalTasks > 0 && (
                            <div className="flex items-center gap-1">
                              <FileText size={14} />
                              <span>{completedTasks}/{totalTasks} задач выполнено</span>
                            </div>
                          )}
                        </div>
                        
                          {tasks.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-[#333]">
                            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Задачи:</div>
                            <div className="space-y-1.5">
                              {tasks.slice(0, 3).map(task => (
                                <div
                                  key={task.id}
                                  className="flex items-center justify-between p-2 bg-gray-50 dark:bg-[#2a2a2a] rounded-lg"
                                >
                                  <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1">
                                    {task.title}
                                  </span>
                                  <span className={`text-xs px-2 py-0.5 rounded flex-shrink-0 ml-2 ${
                                    task.status === 'Выполнено' || task.status === 'Done'
                                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                      : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                                  }`}>
                                    {task.status}
                                  </span>
                                </div>
                              ))}
                              {tasks.length > 3 && (
                                <div className="text-xs text-gray-500 dark:text-gray-400 text-center py-1">
                                  и ещё {tasks.length - 3} задач
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                renderInstancesTable(filteredTabInstanceList)
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Modal (список процессов — без вкладки «Схема», упрощённый конструктор) */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/50 dark:bg-black/70 backdrop-blur-sm p-0 md:p-4 animate-in fade-in duration-200"
          onClick={handleBackdropClick}
        >
          <div
            className="w-full max-w-2xl overflow-hidden rounded-t-2xl md:rounded-2xl border border-gray-200 dark:border-[#333] bg-white dark:bg-[#191919] shadow-2xl flex flex-col max-h-[95vh] md:max-h-[90vh] animate-in slide-in-from-bottom md:zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 md:p-5 border-b border-gray-200 dark:border-[#333] flex justify-between items-center gap-2 bg-white dark:bg-[#191919] shrink-0">
              <h3 className="font-bold text-base md:text-lg text-gray-900 dark:text-white truncate">{editingProcess ? 'Редактировать процесс' : 'Новый процесс'}</h3>
              <div className="flex items-center gap-1 shrink-0">
                {editingProcess && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                  >
                    <Trash2 size={16} />
                    <span className="hidden sm:inline">Удалить</span>
                  </button>
                )}
                <button type="button" onClick={() => setIsModalOpen(false)} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-[#252525] text-gray-500 dark:text-gray-400" aria-label="Закрыть"><X size={20} /></button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col min-h-0">
              <div className="p-4 md:p-6 overflow-y-auto custom-scrollbar space-y-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Название процесса</label>
                    <input value={title} onChange={e => setTitle(e.target.value)} className="w-full rounded-xl border border-gray-200 dark:border-[#333] bg-gray-50 dark:bg-[#252525] px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 outline-none" placeholder="Например: Согласование договора"/>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Описание</label>
                    <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full h-24 rounded-xl border border-gray-200 dark:border-[#333] bg-gray-50 dark:bg-[#252525] px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 resize-none focus:ring-2 focus:ring-indigo-500/30 outline-none"/>
                  </div>
                </div>

                <div className="border-t border-gray-200 dark:border-[#333] pt-5">
                  <div className="flex justify-between items-center mb-4 gap-2">
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-gray-100 text-sm">Шаги процесса</h4>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Порядок сверху вниз. Кому назначается шаг — справа.</p>
                    </div>
                    <button type="button" onClick={handleAddStep} className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 text-xs font-semibold flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/80 dark:bg-indigo-950/30 shrink-0"><Plus size={14}/> Добавить шаг</button>
                  </div>

                  <div className="space-y-4">
                    {steps.length === 0 && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center border border-dashed border-gray-200 dark:border-[#444] rounded-2xl bg-gray-50/50 dark:bg-[#141414]">
                        Нажмите «Добавить шаг», чтобы собрать цепочку согласований или действий.
                      </p>
                    )}
                    {steps.map((step, index) => (
                      <div key={step.id} className="relative pl-3 border-l-2 border-indigo-300 dark:border-indigo-700 bg-gray-50 dark:bg-[#252525] p-4 rounded-r-2xl border border-gray-200 dark:border-[#333] group">
                        <button type="button" onClick={() => handleRemoveStep(step.id)} className="absolute top-3 right-3 text-gray-400 hover:text-red-500 p-1 rounded-lg hover:bg-white/80 dark:hover:bg-[#333] opacity-80 group-hover:opacity-100 transition-opacity" title="Убрать шаг"><Trash2 size={16}/></button>
                        <div className="flex items-start gap-3 mb-3 pr-10">
                          <span className="text-xs font-bold text-white w-7 h-7 rounded-full bg-indigo-600 dark:bg-indigo-500 flex items-center justify-center shrink-0 shadow-sm">{index + 1}</span>
                          <input
                            value={step.title}
                            onChange={e => handleUpdateStep(step.id, { title: e.target.value })}
                            className="flex-1 min-w-0 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#444] rounded-xl px-3 py-2 text-sm font-medium text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500/30 outline-none"
                            placeholder="Название шага *"
                          />
                        </div>
                        <textarea
                          value={step.description || ''}
                          onChange={e => handleUpdateStep(step.id, { description: e.target.value })}
                          rows={2}
                          className="w-full bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#444] rounded-xl px-3 py-2 text-xs text-gray-600 dark:text-gray-400 placeholder-gray-400 mb-3 resize-none focus:ring-2 focus:ring-indigo-500/30 outline-none"
                          placeholder="Описание действий (необязательно)..."
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1 block">Кому</span>
                            <EntitySearchSelect
                              searchable={false}
                              value={step.assigneeType}
                              onChange={(val) => handleUpdateStep(step.id, { assigneeType: val as any, assigneeId: '' })}
                              options={[
                                { value: 'position', label: 'Должность' },
                                { value: 'user', label: 'Сотрудник' },
                              ]}
                              className="w-full text-xs"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1 block">Выбор</span>
                            <EntitySearchSelect
                              value={step.assigneeId}
                              onChange={(val) => handleUpdateStep(step.id, { assigneeId: val })}
                              options={[
                                { value: '', label: 'Выберите...' },
                                ...(step.assigneeType === 'position'
                                  ? activeOrgPositions.map(p => ({ value: p.id, label: p.title, searchText: p.title }))
                                  : users.map(u => ({ value: u.id, label: u.name, searchText: u.name }))
                                )
                              ]}
                              className="w-full text-xs"
                              searchPlaceholder="Поиск…"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-4 md:p-6 border-t border-gray-200 dark:border-[#333] bg-white dark:bg-[#191919] flex justify-end items-center gap-2 shrink-0">
                <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} size="md">Отмена</Button>
                <Button type="submit" size="md" icon={Save} className="!bg-indigo-600 hover:!bg-indigo-700 !text-white focus:!ring-indigo-500">Сохранить</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {startPickerOpen && (
        <div
          className="fixed inset-0 z-[190] flex items-center justify-center bg-black/50 dark:bg-black/70 backdrop-blur-sm p-4"
          role="presentation"
          onClick={() => setStartPickerOpen(false)}
        >
          <div
            className="bg-white dark:bg-[#252525] rounded-xl shadow-2xl border border-gray-200 dark:border-[#333] w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="start-process-picker-title"
          >
            <div className="px-5 py-4 border-b border-gray-100 dark:border-[#333] flex items-center justify-between gap-3">
              <h2 id="start-process-picker-title" className="text-lg font-bold text-gray-900 dark:text-white">
                Запустить процесс
              </h2>
              <button
                type="button"
                onClick={() => setStartPickerOpen(false)}
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-[#333]"
                aria-label="Закрыть"
              >
                <X size={20} />
              </button>
            </div>
            <p className="px-5 pt-2 text-xs text-gray-500 dark:text-gray-400">
              Выберите шаблон. Для воронки продаж далее выберите сделку.
            </p>
            <div className="p-3 overflow-y-auto custom-scrollbar flex-1 min-h-0 space-y-1">
              {uniqueProcesses.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">Нет доступных шаблонов</p>
              ) : (
                userTemplates.map((proc) => (
                  <button
                    key={proc.id}
                    type="button"
                    onClick={() => startProcessFor(proc, { fromPicker: true })}
                    className="w-full text-left px-4 py-3 rounded-xl border border-gray-100 dark:border-[#333] hover:bg-indigo-50 dark:hover:bg-indigo-950/30 hover:border-indigo-200 dark:hover:border-indigo-800 transition-colors"
                  >
                    <div className="font-medium text-gray-900 dark:text-white">{proc.title}</div>
                    {proc.description ? (
                      <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">{proc.description}</div>
                    ) : null}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <SystemAlertDialog
        open={!!alertText}
        title="Бизнес-процессы"
        message={alertText || ''}
        onClose={() => setAlertText(null)}
      />
    </ModulePageShell>
  );
};

export default BusinessProcessesView;
