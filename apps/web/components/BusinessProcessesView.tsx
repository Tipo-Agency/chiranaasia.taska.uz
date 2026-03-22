
import React, { useState, useEffect, useMemo } from 'react';
import { BusinessProcess, ProcessStep, ProcessStepBranch, OrgPosition, User, Task, ProcessInstance, TableCollection } from '../types';
import { Network, Plus, Edit2, Trash2, ChevronRight, User as UserIcon, Building2, Save, X, ArrowDown, Play, CheckCircle2, Clock, FileText, ArrowLeft, Calendar, Users, Layers3, PauseCircle } from 'lucide-react';
import { TaskSelect } from './TaskSelect';
import { ProcessCard } from './features/processes/ProcessCard';
import { ModuleCreateDropdown, ModulePageShell, ModulePageHeader, ModuleSegmentedControl, MODULE_PAGE_GUTTER } from './ui';

interface BusinessProcessesViewProps {
  processes: BusinessProcess[];
  orgPositions: OrgPosition[];
  users: User[];
  tasks: Task[];
  tables: TableCollection[];
  currentUser?: User | null;
  onSaveProcess: (proc: BusinessProcess) => void;
  onDeleteProcess: (id: string) => void;
  onSaveTask: (task: Partial<Task>) => void;
  onOpenTask: (task: Task) => void;
  /** Быстрое создание задачи из меню «Создать» (как на главной) */
  onQuickCreateTask?: () => void;
  onCompleteProcessStepWithBranch?: (instanceId: string, nextStepId: string) => void;
  autoOpenCreateModal?: boolean;
}

const BusinessProcessesView: React.FC<BusinessProcessesViewProps> = ({ 
    processes, orgPositions, users, tasks, tables, currentUser, onSaveProcess, onDeleteProcess, onSaveTask, onOpenTask, onQuickCreateTask, onCompleteProcessStepWithBranch, autoOpenCreateModal = false
}) => {
  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(null);
  /** Шаблоны = описания процессов; В работе = active + paused; Завершённые = completed */
  const [activeTab, setActiveTab] = useState<'templates' | 'running' | 'completed'>('templates');
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProcess, setEditingProcess] = useState<BusinessProcess | null>(null);
  const [editModalTab, setEditModalTab] = useState<'steps' | 'schema'>('steps');
  
  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState<ProcessStep[]>([]);

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

  const selectedProcess = uniqueProcesses.find(p => p.id === selectedProcessId);

  // Автоматически открываем модалку создания при монтировании, если autoOpenCreateModal = true
  useEffect(() => {
    if (autoOpenCreateModal) {
      handleOpenCreate();
    }
  }, [autoOpenCreateModal]);

  // Слушаем событие для открытия модалки из HomeView
  useEffect(() => {
    const handleOpenModal = () => {
      handleOpenCreate();
    };
    window.addEventListener('openCreateProcessModal', handleOpenModal);
    return () => window.removeEventListener('openCreateProcessModal', handleOpenModal);
  }, []);

  const handleOpenCreate = () => {
      setEditingProcess(null);
      setTitle(''); setDescription(''); setSteps([]);
      setEditModalTab('steps');
      setIsModalOpen(true);
  };

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
          alert('Укажите название процесса.');
          return;
      }

      const emptyStep = steps.find(s => !String(s.title || '').trim());
      if (steps.length > 0 && emptyStep) {
          alert('Укажите название у каждого шага процесса.');
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
          return position?.holderUserId || null;
      } else {
          return step.assigneeId || null;
      }
  };

  const handleStartProcess = () => {
      if (!selectedProcess || selectedProcess.steps.length === 0) return;
      
      const firstStep = selectedProcess.steps[0];
      const assigneeId = getAssigneeId(firstStep);
      
      if (!assigneeId) {
          alert('Не назначен исполнитель для первого шага');
          return;
      }

      const instanceId = `inst-${Date.now()}`;
      const instance: ProcessInstance = {
          id: instanceId,
          processId: selectedProcess.id,
          processVersion: selectedProcess.version || 1,
          currentStepId: firstStep.id,
          status: 'active',
          startedAt: new Date().toISOString(),
          taskIds: []
      };

      const taskId = `task-${Date.now()}`;
      const newTask: Partial<Task> = {
          id: taskId,
          entityType: 'task',
          tableId: '', // Задачи из бизнес-процессов не привязаны к конкретной таблице
          title: `${selectedProcess.title}: ${firstStep.title}`,
          description: firstStep.description || '',
          status: 'Не начато',
          priority: 'Средний',
          assigneeId: assigneeId,
          source: 'Процесс',
          startDate: new Date().toISOString().split('T')[0],
          endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          processId: selectedProcess.id,
          processInstanceId: instanceId,
          stepId: firstStep.id,
          createdAt: new Date().toISOString(),
          createdByUserId: currentUser?.id // Постановщик - пользователь, который запустил процесс
      };

      instance.taskIds = [taskId];
      
      // Находим последнюю версию процесса для обновления экземпляров
      const latestVersion = processes
        .filter(p => p.id === selectedProcess.id)
        .sort((a, b) => (b.version || 1) - (a.version || 1))[0] || selectedProcess;
      
      const updatedProcess: BusinessProcess = {
          ...latestVersion,
          instances: [...(latestVersion.instances || []), instance]
      };

      onSaveProcess(updatedProcess);
      // Сохраняем задачу без tableId - она будет видна в модуле задач
      onSaveTask(newTask);
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
                  <div className="max-w-7xl mx-auto flex items-center justify-between">
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
                  <div className="max-w-7xl mx-auto px-6 py-6">
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
                  <div className="max-w-7xl mx-auto flex items-center justify-between">
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
                  <div className="max-w-7xl mx-auto px-6 py-6">
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
                                          const currentStep = selectedProcess.steps.find(s => s.id === instance.currentStepId);
                                          
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
                  <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[90] animate-in fade-in duration-200" onClick={handleBackdropClick}>
                      <div className="bg-white dark:bg-[#252525] rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-200 dark:border-[#333] flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                          <div className="p-4 border-b border-gray-100 dark:border-[#333] flex justify-between items-center gap-2 bg-white dark:bg-[#252525] shrink-0">
                              <h3 className="font-bold text-gray-800 dark:text-white truncate">{editingProcess ? 'Редактировать процесс' : 'Новый процесс'}</h3>
                              <div className="flex items-center gap-1 shrink-0">
                                {editingProcess && (
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                                  >
                                    <Trash2 size={16} />
                                    <span className="hidden sm:inline">Удалить</span>
                                  </button>
                                )}
                                <button type="button" onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-[#333]"><X size={18} /></button>
                              </div>
                          </div>
                          <div className="flex border-b border-gray-100 dark:border-[#333] px-4">
                              <button type="button" onClick={() => setEditModalTab('steps')} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${editModalTab === 'steps' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                                  Шаги
                              </button>
                              <button type="button" onClick={() => setEditModalTab('schema')} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${editModalTab === 'schema' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                                  Схема
                              </button>
                          </div>
                          
                          <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
                              <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
                                  <div className="space-y-4">
                                      <div>
                                          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Название процесса</label>
                                          <input value={title} onChange={e => setTitle(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100" placeholder="Например: Согласование договора"/>
                                      </div>
                                      <div>
                                          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Описание</label>
                                          <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full h-20 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100 resize-none"/>
                                      </div>
                                  </div>

                                  {editModalTab === 'schema' && (
                                      <div className="border border-gray-200 dark:border-[#333] rounded-lg p-4 bg-gray-50 dark:bg-[#202020]">
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
                                      <div className="flex justify-between items-center mb-4">
                                          <h4 className="font-bold text-gray-700 dark:text-gray-200 text-sm">Шаги процесса</h4>
                                          <button type="button" onClick={handleAddStep} className="text-indigo-600 hover:text-indigo-700 text-xs font-medium flex items-center gap-1"><Plus size={14}/> Добавить шаг</button>
                                      </div>
                                      
                                      <div className="space-y-4">
                                          {steps.map((step, index) => (
                                              <div key={step.id} className="bg-gray-50 dark:bg-[#303030] p-4 rounded-lg border border-gray-200 dark:border-[#444] relative group">
                                                  <button type="button" onClick={() => handleRemoveStep(step.id)} className="absolute top-2 right-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14}/></button>
                                                  <div className="flex items-center gap-2 mb-3">
                                                      <span className="text-xs font-bold text-gray-400 w-6 h-6 rounded-full bg-white dark:bg-[#252525] flex items-center justify-center border border-gray-200 dark:border-[#444] shrink-0">{index + 1}</span>
                                                      <input 
                                                          value={step.title} 
                                                          onChange={e => handleUpdateStep(step.id, { title: e.target.value })}
                                                          className="flex-1 bg-white dark:bg-[#252525] border border-gray-300 dark:border-[#555] rounded px-3 py-2 text-sm font-medium text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                                          placeholder="Название шага *"
                                                      />
                                                  </div>
                                                  <textarea 
                                                      value={step.description || ''}
                                                      onChange={e => handleUpdateStep(step.id, { description: e.target.value })}
                                                      rows={2}
                                                      className="w-full bg-white dark:bg-[#252525] border border-gray-300 dark:border-[#555] rounded px-3 py-2 text-xs text-gray-600 dark:text-gray-400 placeholder-gray-400 mb-3 resize-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                                      placeholder="Описание действий..."
                                                  />
                                                  <div className="flex gap-2">
                                                      <TaskSelect
                                                          value={step.assigneeType}
                                                          onChange={(val) => handleUpdateStep(step.id, { assigneeType: val as any, assigneeId: '' })}
                                                          options={[
                                                              { value: 'position', label: 'Должность' },
                                                              { value: 'user', label: 'Сотрудник' }
                                                          ]}
                                                          className="w-1/3 text-xs"
                                                      />
                                                      <TaskSelect
                                                          value={step.assigneeId}
                                                          onChange={(val) => handleUpdateStep(step.id, { assigneeId: val })}
                                                          options={[
                                                              { value: '', label: 'Выберите...' },
                                                              ...(step.assigneeType === 'position' 
                                                                  ? orgPositions.map(p => ({ value: p.id, label: p.title }))
                                                                  : users.map(u => ({ value: u.id, label: u.name }))
                                                              )
                                                          ]}
                                                          className="flex-1 text-xs"
                                                      />
                                                  </div>
                                                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-[#444]">
                                                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2">Тип шага</label>
                                                      <TaskSelect
                                                          value={step.stepType || 'normal'}
                                                          onChange={(val) => handleUpdateStep(step.id, { stepType: val as 'normal' | 'variant', branches: val === 'variant' ? (step.branches || [{ id: `br-${Date.now()}`, label: 'Вариант 1', nextStepId: steps[0]?.id || '' }]) : undefined })}
                                                          options={[
                                                              { value: 'normal', label: 'Обычный (линейный переход)' },
                                                              { value: 'variant', label: 'Вариант (ветвление процесса)' }
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
                                                                      <TaskSelect
                                                                          value={br.nextStepId}
                                                                          onChange={(val) => handleUpdateBranch(step.id, br.id, { nextStepId: val })}
                                                                          options={[
                                                                              { value: '', label: 'След. шаг...' },
                                                                              ...steps.filter(s => s.id !== step.id).map(s => ({ value: s.id, label: s.title || '(без названия)' }))
                                                                          ]}
                                                                          className="w-40 text-xs"
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

                              <div className="p-4 border-t border-gray-100 dark:border-[#333] bg-white dark:bg-[#252525] flex justify-end items-center gap-2 shrink-0">
                                   <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#303030] rounded-lg">Отмена</button>
                                   <button type="submit" className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg shadow-sm flex items-center gap-2"><Save size={16}/> Сохранить</button>
                              </div>
                          </form>
                      </div>
                  </div>
              )}
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
                  <div className="max-w-7xl mx-auto flex items-center justify-between">
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
                  <div className="max-w-7xl mx-auto px-6 py-6">
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
      <div className={`${MODULE_PAGE_GUTTER} pt-6 md:pt-8 flex-shrink-0`}>
        <div className="mb-6 space-y-5">
          <ModulePageHeader
            accent="indigo"
            icon={<Network size={24} strokeWidth={2} />}
            title="Бизнес-процессы"
            description="Шаблоны, запуски в работе и завершённые экземпляры — на отдельных вкладках"
            actions={
              <ModuleCreateDropdown
                accent="indigo"
                items={[
                  {
                    id: 'template',
                    label: 'Шаблон процесса',
                    icon: Layers3,
                    onClick: handleOpenCreate,
                    iconClassName: 'text-indigo-600 dark:text-indigo-400',
                  },
                  ...(onQuickCreateTask
                    ? [
                        {
                          id: 'task',
                          label: 'Задача',
                          icon: CheckCircle2,
                          onClick: onQuickCreateTask,
                          iconClassName: 'text-indigo-600 dark:text-indigo-400',
                        },
                      ]
                    : []),
                ]}
              />
            }
          />

          <ModuleSegmentedControl
            variant="neutral"
            value={activeTab}
            onChange={(v) => setActiveTab(v as 'templates' | 'running' | 'completed')}
            options={[
              { value: 'templates', label: 'Шаблоны', icon: <Layers3 size={14} /> },
              { value: 'running', label: 'В работе', icon: <Play size={14} /> },
              { value: 'completed', label: 'Завершённые', icon: <CheckCircle2 size={14} /> },
            ]}
          />

            <div className="flex flex-wrap items-center gap-2 text-[11px] sm:text-xs text-gray-600 dark:text-gray-400">
              {activeTab === 'templates' && (
                <>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-[#2a2a2a] border border-gray-200/80 dark:border-[#444]">
                    <Network size={13} className="text-indigo-500 shrink-0" />
                    Шаблонов: <strong className="text-gray-900 dark:text-white">{uniqueProcesses.filter(p => !p.isArchived).length}</strong>
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50 text-blue-800 dark:text-blue-200">
                    <Play size={13} className="shrink-0" />
                    Активных запусков: <strong>{runningInstances.length}</strong>
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-200">
                    <CheckCircle2 size={13} className="shrink-0" />
                    Завершено: <strong>{completedInstancesList.length}</strong>
                  </span>
                </>
              )}
              {activeTab === 'running' && (
                <>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50 text-blue-800 dark:text-blue-200">
                    <Play size={13} />
                    Активны: <strong>{allInstances.filter(({ instance: i }) => i.status === 'active').length}</strong>
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40 text-amber-900 dark:text-amber-200">
                    <PauseCircle size={13} />
                    На паузе: <strong>{allInstances.filter(({ instance: i }) => i.status === 'paused').length}</strong>
                  </span>
                </>
              )}
              {activeTab === 'completed' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-200">
                  <CheckCircle2 size={13} />
                  Всего завершённых экземпляров: <strong>{completedInstancesList.length}</strong>
                </span>
              )}
            </div>
        </div>
      </div>
      
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className={`${MODULE_PAGE_GUTTER} pb-20 h-full overflow-y-auto custom-scrollbar`}>
          {activeTab === 'templates' ? (
            processes.length === 0 ? (
            <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl p-12 text-center">
              <Network size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-2">Нет бизнес-процессов</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Выберите действие в меню «Создать» выше или создайте шаблон здесь</p>
              <ModuleCreateDropdown
                accent="indigo"
                align="left"
                items={[
                  {
                    id: 'template',
                    label: 'Шаблон процесса',
                    icon: Layers3,
                    onClick: handleOpenCreate,
                    iconClassName: 'text-indigo-600 dark:text-indigo-400',
                  },
                  ...(onQuickCreateTask
                    ? [
                        {
                          id: 'task',
                          label: 'Задача',
                          icon: CheckCircle2,
                          onClick: onQuickCreateTask,
                          iconClassName: 'text-indigo-600 dark:text-indigo-400',
                        },
                      ]
                    : []),
                ]}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {uniqueProcesses.filter(p => !p.isArchived).map(process => {
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
          )
          ) : (
            <div>
              <div className="mb-4">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                  {activeTab === 'running' ? 'Процессы в работе' : 'Завершённые процессы'}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {activeTab === 'running'
                    ? 'Активные и приостановленные экземпляры. Завершённые — во вкладке «Завершённые».'
                    : 'История завершённых запусков.'}
                </p>
              </div>

              {tabInstanceList.length === 0 ? (
                <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl p-12 text-center">
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
                </div>
              ) : (
                <div className="space-y-3">
                  {tabInstanceList.map(({ process, instance, tasks }) => {
                    const currentStep = process.steps.find(s => s.id === instance.currentStepId);
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
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                instance.status === 'completed'
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                  : instance.status === 'paused'
                                    ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                              }`}>
                                {instance.status === 'active' && 'Активен'}
                                {instance.status === 'completed' && 'Завершён'}
                                {instance.status === 'paused' && 'Приостановлен'}
                              </span>
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
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Modal (список процессов — без вкладки «Схема», упрощённый конструктор) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[90] animate-in fade-in duration-200" onClick={handleBackdropClick}>
          <div className="bg-white dark:bg-[#252525] rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-200 dark:border-[#333] flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-100 dark:border-[#333] flex justify-between items-center gap-2 bg-white dark:bg-[#252525] shrink-0">
              <h3 className="font-bold text-gray-800 dark:text-white truncate">{editingProcess ? 'Редактировать процесс' : 'Новый процесс'}</h3>
              <div className="flex items-center gap-1 shrink-0">
                {editingProcess && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                  >
                    <Trash2 size={16} />
                    <span className="hidden sm:inline">Удалить</span>
                  </button>
                )}
                <button type="button" onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-[#333]"><X size={18} /></button>
              </div>
            </div>
            
            <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
              <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Название процесса</label>
                    <input value={title} onChange={e => setTitle(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100" placeholder="Например: Согласование договора"/>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Описание</label>
                    <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full h-24 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100 resize-none"/>
                  </div>
                </div>

                <div className="border-t border-gray-200 dark:border-[#333] pt-5">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h4 className="font-bold text-gray-800 dark:text-gray-100 text-sm">Шаги процесса</h4>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Порядок сверху вниз. Кому назначается шаг — справа.</p>
                    </div>
                    <button type="button" onClick={handleAddStep} className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 text-xs font-semibold flex items-center gap-1 px-2 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/30"><Plus size={14}/> Добавить шаг</button>
                  </div>
                  
                  <div className="space-y-4">
                    {steps.length === 0 && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center border border-dashed border-gray-200 dark:border-[#444] rounded-xl">
                        Нажмите «Добавить шаг», чтобы собрать цепочку согласований или действий.
                      </p>
                    )}
                    {steps.map((step, index) => (
                      <div key={step.id} className="relative pl-3 border-l-2 border-indigo-200 dark:border-indigo-800 bg-gray-50/80 dark:bg-[#2a2a2a] p-4 rounded-r-xl border border-gray-200/80 dark:border-[#444] group">
                        <button type="button" onClick={() => handleRemoveStep(step.id)} className="absolute top-3 right-3 text-gray-400 hover:text-red-500 p-1 rounded-md hover:bg-white/80 dark:hover:bg-[#333] opacity-80 group-hover:opacity-100 transition-opacity" title="Убрать шаг"><Trash2 size={16}/></button>
                        <div className="flex items-start gap-3 mb-3 pr-10">
                          <span className="text-xs font-bold text-white w-7 h-7 rounded-full bg-indigo-600 dark:bg-indigo-500 flex items-center justify-center shrink-0 shadow-sm">{index + 1}</span>
                          <input 
                            value={step.title} 
                            onChange={e => handleUpdateStep(step.id, { title: e.target.value })}
                            className="flex-1 min-w-0 bg-white dark:bg-[#252525] border border-gray-300 dark:border-[#555] rounded-lg px-3 py-2 text-sm font-medium text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="Название шага *"
                          />
                        </div>
                        <textarea 
                          value={step.description || ''}
                          onChange={e => handleUpdateStep(step.id, { description: e.target.value })}
                          rows={2}
                          className="w-full bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#555] rounded-lg px-3 py-2 text-xs text-gray-600 dark:text-gray-400 placeholder-gray-400 mb-3 resize-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          placeholder="Описание действий (необязательно)..."
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1 block">Кому</span>
                            <TaskSelect
                              value={step.assigneeType}
                              onChange={(val) => handleUpdateStep(step.id, { assigneeType: val as any, assigneeId: '' })}
                              options={[
                                { value: 'position', label: 'Должность' },
                                { value: 'user', label: 'Сотрудник' }
                              ]}
                              className="w-full text-xs"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1 block">Выбор</span>
                            <TaskSelect
                              value={step.assigneeId}
                              onChange={(val) => handleUpdateStep(step.id, { assigneeId: val })}
                              options={[
                                { value: '', label: 'Выберите...' },
                                ...(step.assigneeType === 'position' 
                                  ? orgPositions.map(p => ({ value: p.id, label: p.title }))
                                  : users.map(u => ({ value: u.id, label: u.name }))
                                )
                              ]}
                              className="w-full text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-gray-100 dark:border-[#333] bg-white dark:bg-[#252525] flex justify-end items-center gap-2 shrink-0">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#303030] rounded-lg">Отмена</button>
                <button type="submit" className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg shadow-sm flex items-center gap-2"><Save size={16}/> Сохранить</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ModulePageShell>
  );
};

export default BusinessProcessesView;
