/**
 * Недельные планы сотрудника: список планов, редактирование, подтянуть задачи из задач/контент-плана.
 */
import React, { useEffect, useState, useCallback, forwardRef, useImperativeHandle, useMemo } from 'react';
import { Calendar, Trash2, FileText, Loader2, ListTodo, Search, X, Plus } from 'lucide-react';
import { ModuleCreateIconButton } from '../ui/ModuleCreateIconButton';
import { SystemConfirmDialog } from '../ui';
import { weeklyPlansEndpoint, type WeeklyPlanApi } from '../../services/apiClient';
import type { User } from '../../types';
import type { Task } from '../../types';
import { DateRangeInput } from '../ui/DateInput';

const MONDAY = 1;

function getWeekStart(d: Date): string {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : MONDAY - 1);
  const monday = new Date(d);
  monday.setDate(diff);
  return monday.toISOString().slice(0, 10);
}

function formatWeekLabel(weekStart: string, weekEnd?: string): string {
  const d = new Date(weekStart + 'T12:00:00');
  const end = weekEnd ? new Date(weekEnd + 'T12:00:00') : new Date(d);
  if (!weekEnd) end.setDate(end.getDate() + 6);
  return `${d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

interface WeeklyPlansViewProps {
  currentUser: User;
  tasks: Task[];
  users?: User[];
  scope?: 'mine' | 'all';
  onOpenTask?: (task: Task) => void;
  onCreateTask?: (title: string) => Promise<{ id: string; label: string } | null> | { id: string; label: string } | null;
  onUpdateTask?: (taskId: string, updates: Partial<Task>) => Promise<void> | void;
  /** В модалке — без дублирующего заголовка страницы */
  layout?: 'full' | 'embedded';
  /** В модуле «Документы» кнопка создания в шапке — скрыть внутренний блок с плюсом */
  hideEmbeddedToolbar?: boolean;
}

export interface WeeklyPlansViewHandle {
  createPlanForCurrentWeek: () => void;
  openCreateModal: () => void;
  toggleFilters: () => void;
}

export const WeeklyPlansView = forwardRef<WeeklyPlansViewHandle, WeeklyPlansViewProps>(function WeeklyPlansView(
  {
  currentUser,
  tasks,
  users = [],
  scope = 'mine',
  onOpenTask,
  onCreateTask,
  onUpdateTask,
  layout = 'full',
  hideEmbeddedToolbar = false,
},
  ref
) {
  const embedded = layout === 'embedded';
  const [plans, setPlans] = useState<WeeklyPlanApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [openedPlanId, setOpenedPlanId] = useState<string | null>(null);
  const [editingPlan, setEditingPlan] = useState<WeeklyPlanApi | null>(null);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [planToDelete, setPlanToDelete] = useState<WeeklyPlanApi | null>(null);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [userFilter, setUserFilter] = useState<'all' | string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [expandedUsers, setExpandedUsers] = useState<Record<string, boolean>>({});

  const load = async () => {
    setLoading(true);
    try {
      const data = scope === 'all'
        ? await weeklyPlansEndpoint.getPlans()
        : await weeklyPlansEndpoint.getPlans({ userId: currentUser.id });
      setPlans(data);
    } catch {
      setPlans([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [currentUser.id, scope]);

  const sortedPlans = useMemo(
    () => [...plans].sort((a, b) => (b.weekStart || '').localeCompare(a.weekStart || '')),
    [plans]
  );
  const visiblePlans = useMemo(() => {
    if (scope !== 'all' || userFilter === 'all') return sortedPlans;
    return sortedPlans.filter((p) => p.userId === userFilter);
  }, [scope, sortedPlans, userFilter]);
  const plansByUser = useMemo(() => {
    const map = new Map<string, WeeklyPlanApi[]>();
    visiblePlans.forEach((p) => {
      const arr = map.get(p.userId) || [];
      arr.push(p);
      map.set(p.userId, arr);
    });
    return map;
  }, [visiblePlans]);
  const userLabel = (uid: string) => users.find((u) => u.id === uid)?.name || (uid === currentUser.id ? 'Вы' : 'Сотрудник');
  const taskById = useMemo(() => {
    const map = new Map<string, Task>();
    for (const t of tasks) map.set(t.id, t);
    return map;
  }, [tasks]);
  const statusOptions = useMemo(() => {
    const defaults = ['Не начато', 'В работе', 'На проверке', 'Выполнено'];
    const fromTasks = tasks.map((t) => t.status).filter((s): s is string => Boolean(s && s.trim()));
    return [...new Set([...defaults, ...fromTasks])];
  }, [tasks]);

  const openCreateModal = useCallback(() => {
    setOpenedPlanId(null);
    const basePool = scope === 'all' ? plans.filter((p) => p.userId === currentUser.id) : plans;
    const latest = [...basePool].sort((a, b) => (b.weekStart || '').localeCompare(a.weekStart || ''))[0];
    const base = latest
      ? new Date(`${(latest.weekEnd || latest.weekStart)}T12:00:00`)
      : new Date();
    if (latest) base.setDate(base.getDate() + 1);
    const start = base.toISOString().slice(0, 10);
    const end = new Date(`${start}T12:00:00`);
    end.setDate(end.getDate() + 6);
    setNewStartDate(start);
    setNewEndDate(end.toISOString().slice(0, 10));
    setCreateOpen(true);
  }, [plans, scope, currentUser.id]);

  const handleCreatePlan = useCallback(async (forcedWeekStart?: string, forcedWeekEnd?: string) => {
    const weekStart = forcedWeekStart || getWeekStart(new Date());
    const existing = plans.find((p) => p.weekStart === weekStart);
    if (existing) {
      setEditingPlan(existing);
      setOpenedPlanId(existing.id);
      setCreateOpen(false);
      return;
    }
    const newPlan: WeeklyPlanApi = {
      id: crypto.randomUUID(),
      userId: currentUser.id,
      weekStart: weekStart,
      weekEnd: forcedWeekEnd,
      taskIds: [],
      notes: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    try {
      await weeklyPlansEndpoint.updatePlans([...plans, newPlan]);
      setPlans((prev) => [...prev, newPlan]);
      setEditingPlan(newPlan);
      setOpenedPlanId(newPlan.id);
      setCreateOpen(false);
    } catch (e) {
      console.error(e);
    }
  }, [plans, currentUser.id]);

  useImperativeHandle(ref, () => ({
    createPlanForCurrentWeek: () => {
      openCreateModal();
    },
    openCreateModal,
    toggleFilters: () => setShowFilters((v) => !v),
  }), [openCreateModal]);

  const handleSavePlan = async (plan: WeeklyPlanApi, opts?: { closeAfterSave?: boolean }) => {
    const list = plans.map((p) => (p.id === plan.id ? plan : p));
    try {
      await weeklyPlansEndpoint.updatePlans(list);
      setPlans(list);
      setEditingPlan(null);
      if (opts?.closeAfterSave) {
        setOpenedPlanId(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemoveTask = (plan: WeeklyPlanApi, taskId: string) => {
    const next = { ...plan, taskIds: (plan.taskIds || []).filter((id) => id !== taskId) };
    handleSavePlan(next);
  };

  const handleAddTasks = (plan: WeeklyPlanApi, selectedIds: string[]) => {
    const next = { ...plan, taskIds: selectedIds };
    handleSavePlan(next);
    setShowAddTaskModal(false);
  };

  const handleCreateTaskFromPlan = async (plan: WeeklyPlanApi) => {
    const title = newTaskTitle.trim();
    if (!title || !onCreateTask) return;
    const created = await onCreateTask(title);
    if (!created?.id) return;
    const currentIds = plan.taskIds || [];
    if (!currentIds.includes(created.id)) {
      await handleSavePlan({ ...plan, taskIds: [...currentIds, created.id] });
    }
    setNewTaskTitle('');
  };

  const handleTaskStatusChange = async (taskId: string, status: string) => {
    if (!onUpdateTask) return;
    try {
      await onUpdateTask(taskId, { status });
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeletePlan = async (plan: WeeklyPlanApi) => {
    try {
      await weeklyPlansEndpoint.deletePlan(plan.id);
      setPlans((prev) => prev.filter((p) => p.id !== plan.id));
      if (editingPlan?.id === plan.id) setEditingPlan(null);
      if (openedPlanId === plan.id) setOpenedPlanId(null);
    } catch (e) {
      console.error(e);
    }
  };

  const planHasUnsavedChanges = (basePlan: WeeklyPlanApi, draftPlan: WeeklyPlanApi) => {
    const baseTaskIds = [...(basePlan.taskIds || [])].sort();
    const draftTaskIds = [...(draftPlan.taskIds || [])].sort();
    return (
      (basePlan.weekStart || '') !== (draftPlan.weekStart || '') ||
      (basePlan.weekEnd || '') !== (draftPlan.weekEnd || '') ||
      (basePlan.notes || '') !== (draftPlan.notes || '') ||
      baseTaskIds.join(',') !== draftTaskIds.join(',')
    );
  };

  const requestCloseOpenedPlan = () => {
    if (!openedPlanId) return;
    const basePlan = plans.find((p) => p.id === openedPlanId);
    const draftPlan = editingPlan?.id === openedPlanId ? editingPlan : basePlan;
    if (!basePlan || !draftPlan) {
      setOpenedPlanId(null);
      setEditingPlan(null);
      return;
    }
    if (planHasUnsavedChanges(basePlan, draftPlan)) {
      setCloseConfirmOpen(true);
      return;
    }
    setOpenedPlanId(null);
    setEditingPlan(null);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 p-4">
        <Loader2 size={18} className="animate-spin" />
        Загрузка…
      </div>
    );
  }

  return (
    <div className={embedded ? 'space-y-5' : 'space-y-4'}>
      {!embedded ? (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2 className="font-bold text-gray-800 dark:text-white flex items-center gap-2 text-lg">
              <Calendar size={22} className="text-[#3337AD]" />
              Недельные планы
            </h2>
            <ModuleCreateIconButton accent="indigo" label="Новый недельный план" onClick={openCreateModal} />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
            Составляйте план недели: добавляйте задачи из раздела «Задачи» и контент-плана, убирайте лишнее.
          </p>
        </>
      ) : hideEmbeddedToolbar ? null : (
        <div className="rounded-2xl border border-gray-200 dark:border-[#333] bg-gradient-to-br from-[#3337AD]/8 via-white to-violet-50/40 dark:from-[#3337AD]/20 dark:via-[#1e1e1e] dark:to-[#252525] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-sm text-gray-600 dark:text-gray-300 leading-snug">
            Добавьте задачи в план и ведите заметки по неделе. Всё сохраняется автоматически.
          </p>
          <ModuleCreateIconButton accent="indigo" label="План на эту неделю" onClick={handleCreatePlan} className="shrink-0" />
        </div>
      )}
      {visiblePlans.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-[#333] bg-gray-50/50 dark:bg-[#1a1a1a] p-10 text-center">
          <Calendar size={44} className="mx-auto mb-3 text-gray-300 dark:text-gray-600" strokeWidth={1.25} />
          <p className="text-gray-700 dark:text-gray-300 font-medium">Пока нет планов</p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">Создайте план на текущую неделю — появится список задач.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {scope === 'all' && showFilters && (
            <div className="rounded-2xl border border-gray-200 dark:border-[#333] bg-white dark:bg-[#252525] p-3">
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Сотрудник</label>
              <select
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                className="w-full sm:w-72 px-3 py-2 rounded-xl border border-gray-200 dark:border-[#444] bg-white dark:bg-[#1f1f1f] text-sm"
              >
                <option value="all">Все сотрудники</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          )}
          {[...plansByUser.entries()].map(([uid, userPlans]) => {
            const isOpen = expandedUsers[uid] ?? true;
            return (
              <div key={uid} className="rounded-2xl border border-gray-200 dark:border-[#333] overflow-hidden bg-white dark:bg-[#252525] shadow-sm">
                <button
                  type="button"
                  onClick={() => setExpandedUsers((prev) => ({ ...prev, [uid]: !isOpen }))}
                  className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50/80 dark:hover:bg-[#2a2a2a]/80"
                >
                  <span className="font-semibold text-gray-900 dark:text-white">{userLabel(uid)}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-[#333] text-gray-600 dark:text-gray-300">{userPlans.length} планов</span>
                </button>
                {isOpen && (
                  <div className="border-t border-gray-100 dark:border-[#333] p-2 space-y-2">
                    {userPlans.map((plan) => (
                      <div
                        key={plan.id}
                        className="rounded-xl border border-gray-200 dark:border-[#333] overflow-hidden bg-white dark:bg-[#252525] hover:shadow-md transition-shadow"
                      >
                        <div
                          role="button"
                          tabIndex={0}
                          className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-gray-50/80 dark:hover:bg-[#2a2a2a]/80 transition-colors cursor-pointer"
                          onClick={() => setOpenedPlanId(plan.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setOpenedPlanId(plan.id);
                            }
                          }}
                        >
                          <span className="flex items-center gap-3 min-w-0">
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3337AD]/10 text-[#3337AD] dark:bg-[#3337AD]/25 dark:text-[#a8abf0] shrink-0">
                              <FileText size={16} />
                            </span>
                            <span className="font-medium text-gray-900 dark:text-white truncate">
                              {formatWeekLabel(plan.weekStart, plan.weekEnd)}
                            </span>
                          </span>
                          <div className="flex items-center gap-2 shrink-0">
                            {(plan.taskIds || []).length > 0 && (
                              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-[#333] text-gray-600 dark:text-gray-300">
                                {(plan.taskIds || []).length} задач
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPlanToDelete(plan);
                              }}
                              className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                              title="Удалить план"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showAddTaskModal && editingPlan && (
        <AddTasksModal
          tasks={tasks}
          selectedIds={editingPlan.taskIds || []}
          onConfirm={(selectedIds) => handleAddTasks(editingPlan, selectedIds)}
          onClose={() => {
            setShowAddTaskModal(false);
            setEditingPlan(null);
          }}
        />
      )}
      <SystemConfirmDialog
        open={Boolean(planToDelete)}
        title="Удалить недельный план"
        message="Вы уверены, что хотите удалить этот недельный план?"
        danger
        confirmText="Удалить"
        cancelText="Отмена"
        onCancel={() => setPlanToDelete(null)}
        onConfirm={() => {
          if (planToDelete) {
            handleDeletePlan(planToDelete);
          }
          setPlanToDelete(null);
        }}
      />
      <SystemConfirmDialog
        open={closeConfirmOpen}
        title="Сохранить изменения?"
        message="В недельном плане есть несохраненные изменения. Сохранить перед закрытием?"
        confirmText="Сохранить"
        cancelText="Не сохранять"
        onCancel={() => {
          setCloseConfirmOpen(false);
          setOpenedPlanId(null);
          setEditingPlan(null);
        }}
        onConfirm={() => {
          const opened = openedPlanId ? plans.find((p) => p.id === openedPlanId) : null;
          const toSave = opened && editingPlan?.id === opened.id ? editingPlan : opened;
          if (toSave) {
            void handleSavePlan(toSave, { closeAfterSave: true });
          } else {
            setOpenedPlanId(null);
            setEditingPlan(null);
          }
          setCloseConfirmOpen(false);
        }}
      />
      {createOpen && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 dark:bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#191919] border border-gray-200 dark:border-[#333] shadow-2xl">
            <div className="p-4 border-b border-gray-200 dark:border-[#333] flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">Новый недельный план</h3>
              <button type="button" onClick={() => setCreateOpen(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-[#333]">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Период</label>
                <DateRangeInput
                  startDate={newStartDate}
                  endDate={newEndDate}
                  autoRangeDays={7}
                  onChange={(start, end) => {
                    setNewStartDate(start);
                    setNewEndDate(end);
                  }}
                />
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-[#333] flex justify-end gap-2">
              <button type="button" onClick={() => setCreateOpen(false)} className="px-4 py-2 rounded-xl border border-gray-200 dark:border-[#333] text-sm">
                Отмена
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!newStartDate) return;
                  const safeEnd = newEndDate || newStartDate;
                  void handleCreatePlan(newStartDate, safeEnd);
                }}
                className="px-4 py-2 rounded-xl bg-[#3337AD] text-white text-sm font-semibold"
              >
                Создать
              </button>
            </div>
          </div>
        </div>
      )}
      {openedPlanId && (() => {
        const plan = plans.find((p) => p.id === openedPlanId);
        if (!plan) return null;
        const activePlan = editingPlan?.id === plan.id ? editingPlan : plan;
        return (
          <div
            className="fixed inset-0 z-[125] flex items-center justify-center bg-black/50 dark:bg-black/70 backdrop-blur-sm p-4"
            onClick={requestCloseOpenedPlan}
          >
          <div
            className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl bg-white dark:bg-[#191919] border border-gray-200 dark:border-[#333] ring-1 ring-black/5 dark:ring-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.35)] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
              <div className="p-4 border-b border-gray-200 dark:border-[#333] flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">{formatWeekLabel(plan.weekStart, plan.weekEnd)}</h3>
                <button type="button" onClick={requestCloseOpenedPlan} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-[#333]"><X size={18} /></button>
              </div>
              <div className="p-4 overflow-y-auto custom-scrollbar space-y-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">Период</label>
                  <DateRangeInput
                    startDate={activePlan.weekStart || ''}
                    endDate={activePlan.weekEnd || ''}
                    onChange={(start, end) => setEditingPlan({ ...activePlan, weekStart: start, weekEnd: end })}
                  />
                </div>
                <div className="flex justify-between items-center gap-3">
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Задачи в плане</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPlan(plan);
                        setShowAddTaskModal(true);
                      }}
                      className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#444] text-gray-800 dark:text-gray-100 text-sm font-medium hover:border-[#3337AD]/50 hover:bg-[#3337AD]/5 dark:hover:bg-[#3337AD]/10"
                    >
                      <ListTodo size={16} className="text-[#3337AD]" />
                      Подтянуть задачи
                    </button>
                  </div>
                </div>
                {onCreateTask && (
                  <div className="flex items-center gap-2">
                    <input
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      placeholder="Новая задача для этого плана"
                      className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-[#333] bg-white dark:bg-[#252525] text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => void handleCreateTaskFromPlan(plan)}
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-[#3337AD] text-white text-sm font-semibold"
                    >
                      <Plus size={14} /> Создать
                    </button>
                  </div>
                )}
                {(plan.taskIds || []).length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 rounded-xl bg-white/60 dark:bg-[#252525]/60 border border-dashed border-gray-200 dark:border-[#333] px-4 py-6 text-center">
                    Нет задач. Нажмите «Подтянуть задачи», чтобы выбрать из списка задач.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {(plan.taskIds || []).map((taskId) => {
                      const task = taskById.get(taskId);
                      return (
                        <li key={taskId} className="py-2.5 px-3 rounded-xl bg-white dark:bg-[#252525] border border-gray-100 dark:border-[#333] shadow-sm">
                          <div className="flex items-start gap-2">
                            <button type="button" onClick={() => task && onOpenTask?.(task)} className="text-left flex-1 min-w-0 truncate text-sm font-medium text-gray-800 dark:text-gray-100 hover:text-[#3337AD] dark:hover:text-[#8b8ee0]">
                              {task ? task.title : `Задача ${taskId}`}
                            </button>
                            <button type="button" onClick={() => handleRemoveTask(plan, taskId)} className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" title="Убрать из плана">
                              <Trash2 size={14} />
                            </button>
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <span className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Статус</span>
                            <select
                              value={task?.status || 'Не начато'}
                              onChange={(e) => void handleTaskStatusChange(taskId, e.target.value)}
                              disabled={!task || !onUpdateTask}
                              className="min-w-[170px] max-w-[220px] px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-[#444] bg-white dark:bg-[#1f1f1f] text-xs text-gray-800 dark:text-gray-200 disabled:opacity-60"
                            >
                              {statusOptions.map((status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ))}
                            </select>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <div className="pt-2">
                  <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">Заметки к плану</label>
                  <textarea
                    value={activePlan.notes ?? ''}
                    onChange={(e) => setEditingPlan({ ...(editingPlan?.id === plan.id ? editingPlan : plan), notes: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-200 dark:border-[#333] rounded-xl bg-white dark:bg-[#252525] text-sm text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-[#3337AD]/25 outline-none"
                    rows={4}
                    placeholder="Договорённости, фокус недели, напоминания…"
                  />
                </div>
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const toSave = editingPlan?.id === plan.id ? editingPlan : plan;
                      void handleSavePlan({
                        ...plan,
                        weekStart: toSave?.weekStart || plan.weekStart,
                        weekEnd: toSave?.weekEnd || plan.weekEnd,
                        notes: toSave?.notes ?? '',
                        taskIds: toSave?.taskIds || plan.taskIds || [],
                      }, { closeAfterSave: true });
                    }}
                    className="px-4 py-2 rounded-xl bg-[#3337AD] text-white text-sm font-semibold hover:bg-[#292b8a]"
                  >
                    Сохранить
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
});

function AddTasksModal({
  tasks,
  selectedIds,
  onConfirm,
  onClose,
}: {
  tasks: Task[];
  selectedIds: string[];
  onConfirm: (ids: string[]) => void;
  onClose: () => void;
}) {
  const [chosen, setChosen] = useState<Set<string>>(new Set(selectedIds));
  const [query, setQuery] = useState('');

  const toggle = (id: string) => {
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addSelected = () => {
    onConfirm([...chosen]);
  };

  const pool = tasks.filter((t) => !t.isArchived);
  const filtered = pool
    .filter((t) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return (t.title || '').toLowerCase().includes(q);
    })
    .slice(0, 300);

  return (
    <div
      className="fixed inset-0 z-[140] flex items-end md:items-center justify-center bg-black/50 dark:bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl bg-white dark:bg-[#191919] shadow-2xl border border-gray-200 dark:border-[#333] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-tasks-title"
      >
        <div className="flex items-center justify-between gap-3 p-4 md:p-5 border-b border-gray-200 dark:border-[#333] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#3337AD]/10 text-[#3337AD]">
              <ListTodo size={20} />
            </div>
            <div>
              <h3 id="add-tasks-title" className="font-bold text-gray-900 dark:text-white text-base">
                Подтянуть задачи
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Поиск и выбор из ваших задач</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-[#252525] shrink-0"
            aria-label="Закрыть"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-4 md:p-5 overflow-y-auto flex-1 custom-scrollbar min-h-0">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по названию…"
              className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-gray-200 dark:border-[#333] bg-gray-50 dark:bg-[#252525] text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-[#3337AD]/25 outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg text-gray-400 hover:bg-gray-200 dark:hover:bg-[#333]"
                aria-label="Очистить"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <ul className="space-y-1">
            {filtered.map((task) => (
              <li key={task.id}>
                <label className="flex items-center gap-3 py-2.5 px-3 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-[#2a2a2a] border border-transparent hover:border-gray-100 dark:hover:border-[#333]">
                  <input
                    type="checkbox"
                    checked={chosen.has(task.id)}
                    onChange={() => toggle(task.id)}
                    className="rounded border-gray-300 dark:border-[#444] text-[#3337AD] focus:ring-[#3337AD]"
                  />
                  <span className="text-sm text-gray-800 dark:text-gray-200 truncate flex-1">{task.title || 'Без названия'}</span>
                </label>
              </li>
            ))}
          </ul>
          {filtered.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
              {pool.length === 0 ? 'Нет доступных задач.' : 'Ничего не найдено.'}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 p-4 md:p-5 border-t border-gray-200 dark:border-[#333] shrink-0 bg-gray-50/80 dark:bg-[#141414]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-[#333] text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-white dark:hover:bg-[#252525]"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={addSelected}
            className="px-4 py-2.5 rounded-xl bg-[#3337AD] text-white text-sm font-semibold hover:bg-[#292b8a] shadow-sm"
          >
            Сохранить{chosen.size > 0 ? ` (${chosen.size})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
