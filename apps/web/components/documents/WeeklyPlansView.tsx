/**
 * Недельные планы сотрудника: список планов, редактирование, подтянуть задачи из задач/контент-плана.
 */
import React, { useEffect, useState } from 'react';
import { Calendar, Trash2, ChevronDown, ChevronRight, Loader2, ListTodo, Search, X } from 'lucide-react';
import { ModuleCreateIconButton } from '../ui/ModuleCreateIconButton';
import { weeklyPlansEndpoint, type WeeklyPlanApi } from '../../services/apiClient';
import type { User } from '../../types';
import type { Task } from '../../types';

const MONDAY = 1;

function getWeekStart(d: Date): string {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : MONDAY - 1);
  const monday = new Date(d);
  monday.setDate(diff);
  return monday.toISOString().slice(0, 10);
}

function formatWeekLabel(weekStart: string): string {
  const d = new Date(weekStart + 'T12:00:00');
  const end = new Date(d);
  end.setDate(end.getDate() + 6);
  return `${d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

interface WeeklyPlansViewProps {
  currentUser: User;
  tasks: Task[];
  onOpenTask?: (task: Task) => void;
  /** В модалке — без дублирующего заголовка страницы */
  layout?: 'full' | 'embedded';
}

export const WeeklyPlansView: React.FC<WeeklyPlansViewProps> = ({
  currentUser,
  tasks,
  onOpenTask,
  layout = 'full',
}) => {
  const embedded = layout === 'embedded';
  const [plans, setPlans] = useState<WeeklyPlanApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingPlan, setEditingPlan] = useState<WeeklyPlanApi | null>(null);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await weeklyPlansEndpoint.getPlans({ userId: currentUser.id });
      setPlans(data);
    } catch {
      setPlans([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [currentUser.id]);

  const handleCreatePlan = async () => {
    const weekStart = getWeekStart(new Date());
    const existing = plans.find((p) => p.weekStart === weekStart);
    if (existing) {
      setEditingPlan(existing);
      setExpandedId(existing.id);
      return;
    }
    const newPlan: WeeklyPlanApi = {
      id: crypto.randomUUID(),
      userId: currentUser.id,
      weekStart: weekStart,
      taskIds: [],
      notes: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    try {
      await weeklyPlansEndpoint.updatePlans([...plans, newPlan]);
      setPlans((prev) => [...prev, newPlan]);
      setEditingPlan(newPlan);
      setExpandedId(newPlan.id);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSavePlan = async (plan: WeeklyPlanApi) => {
    const list = plans.map((p) => (p.id === plan.id ? plan : p));
    try {
      await weeklyPlansEndpoint.updatePlans(list);
      setPlans(list);
      setEditingPlan(null);
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

  const handleDeletePlan = async (plan: WeeklyPlanApi) => {
    if (!confirm('Удалить этот недельный план?')) return;
    try {
      await weeklyPlansEndpoint.deletePlan(plan.id);
      setPlans((prev) => prev.filter((p) => p.id !== plan.id));
      if (editingPlan?.id === plan.id) setEditingPlan(null);
      if (expandedId === plan.id) setExpandedId(null);
    } catch (e) {
      console.error(e);
    }
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
            <ModuleCreateIconButton accent="indigo" label="План на эту неделю" onClick={handleCreatePlan} />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
            Составляйте план недели: добавляйте задачи из раздела «Задачи» и контент-плана, убирайте лишнее.
          </p>
        </>
      ) : (
        <div className="rounded-2xl border border-gray-200 dark:border-[#333] bg-gradient-to-br from-[#3337AD]/8 via-white to-violet-50/40 dark:from-[#3337AD]/20 dark:via-[#1e1e1e] dark:to-[#252525] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-sm text-gray-600 dark:text-gray-300 leading-snug">
            Добавьте задачи в план и ведите заметки по неделе. Всё сохраняется автоматически.
          </p>
          <ModuleCreateIconButton accent="indigo" label="План на эту неделю" onClick={handleCreatePlan} className="shrink-0" />
        </div>
      )}

      {plans.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-[#333] bg-gray-50/50 dark:bg-[#1a1a1a] p-10 text-center">
          <Calendar size={44} className="mx-auto mb-3 text-gray-300 dark:text-gray-600" strokeWidth={1.25} />
          <p className="text-gray-700 dark:text-gray-300 font-medium">Пока нет планов</p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">Создайте план на текущую неделю — появится список задач.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="rounded-2xl border border-gray-200 dark:border-[#333] overflow-hidden bg-white dark:bg-[#252525] shadow-sm hover:shadow-md transition-shadow"
            >
              <button
                type="button"
                className="w-full flex items-center justify-between gap-2 px-4 py-3.5 text-left hover:bg-gray-50/80 dark:hover:bg-[#2a2a2a]/80 transition-colors"
                onClick={() => setExpandedId(expandedId === plan.id ? null : plan.id)}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#3337AD]/10 text-[#3337AD] dark:bg-[#3337AD]/25 dark:text-[#a8abf0] shrink-0">
                    {expandedId === plan.id ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white truncate">
                    {formatWeekLabel(plan.weekStart)}
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
                      handleDeletePlan(plan);
                    }}
                    className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                    title="Удалить план"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </button>

              {expandedId === plan.id && (
                <div className="border-t border-gray-100 dark:border-[#333] p-4 sm:p-5 bg-slate-50/60 dark:bg-[#1a1a1a]/80">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                      Задачи в плане
                    </span>
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

                  {(plan.taskIds || []).length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 rounded-xl bg-white/60 dark:bg-[#252525]/60 border border-dashed border-gray-200 dark:border-[#333] px-4 py-6 text-center">
                      Нет задач. Нажмите «Подтянуть задачи», чтобы выбрать из списка задач.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {(plan.taskIds || []).map((taskId) => {
                        const task = tasks.find((t) => t.id === taskId);
                        return (
                          <li
                            key={taskId}
                            className="flex items-center justify-between gap-2 py-2.5 px-3 rounded-xl bg-white dark:bg-[#252525] border border-gray-100 dark:border-[#333] shadow-sm"
                          >
                            <button
                              type="button"
                              onClick={() => task && onOpenTask?.(task)}
                              className="text-left flex-1 min-w-0 truncate text-sm font-medium text-gray-800 dark:text-gray-100 hover:text-[#3337AD] dark:hover:text-[#8b8ee0]"
                            >
                              {task ? task.title : `Задача ${taskId}`}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveTask(plan, taskId)}
                              className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                              title="Убрать из плана"
                            >
                              <Trash2 size={14} />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-[#333]">
                    <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">
                      Заметки к плану
                    </label>
                    <textarea
                      key={`${plan.id}-${plan.updatedAt ?? ''}`}
                      defaultValue={plan.notes ?? ''}
                      onBlur={(e) => {
                        const v = e.target.value;
                        if (v !== (plan.notes ?? '')) handleSavePlan({ ...plan, notes: v });
                      }}
                      className="w-full px-3 py-2.5 border border-gray-200 dark:border-[#333] rounded-xl bg-white dark:bg-[#252525] text-sm text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-[#3337AD]/25 outline-none"
                      rows={3}
                      placeholder="Договорённости, фокус недели, напоминания…"
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
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
    </div>
  );
};

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
      className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/50 dark:bg-black/70 backdrop-blur-sm p-4"
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
