/**
 * Недельные планы сотрудника: список планов, редактирование, подтянуть задачи из задач/контент-плана.
 */
import React, { useEffect, useState } from 'react';
import { Calendar, Plus, Trash2, ChevronDown, ChevronRight, Loader2, ListTodo } from 'lucide-react';
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
}

export const WeeklyPlansView: React.FC<WeeklyPlansViewProps> = ({
  currentUser,
  tasks,
  onOpenTask,
}) => {
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
          <Calendar size={20} />
          Недельные планы
        </h2>
        <button
          type="button"
          onClick={handleCreatePlan}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#3337AD] text-white text-sm font-medium hover:bg-[#292b8a]"
        >
          <Plus size={18} />
          Создать план на эту неделю
        </button>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Здесь вы можете составлять недельный план: добавлять задачи из раздела «Задачи» и контент-плана и убирать лишнее.
      </p>

      {plans.length === 0 ? (
        <div className="border border-dashed border-gray-200 dark:border-[#333] rounded-xl p-8 text-center text-gray-500 dark:text-gray-400">
          <Calendar size={40} className="mx-auto mb-2 opacity-50" />
          <p>Нет недельных планов. Нажмите «Создать план на эту неделю».</p>
        </div>
      ) : (
        <div className="space-y-2">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="border border-gray-200 dark:border-[#333] rounded-xl overflow-hidden bg-white dark:bg-[#252525]"
            >
              <button
                type="button"
                className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-[#2a2a2a]"
                onClick={() => setExpandedId(expandedId === plan.id ? null : plan.id)}
              >
                <span className="flex items-center gap-2">
                  {expandedId === plan.id ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  <span className="font-medium text-gray-800 dark:text-white">
                    {formatWeekLabel(plan.weekStart)}
                  </span>
                </span>
                <div className="flex items-center gap-2">
                  {(plan.taskIds || []).length > 0 && (
                    <span className="text-xs text-gray-500">
                      {(plan.taskIds || []).length} задач
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeletePlan(plan);
                    }}
                    className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                    title="Удалить план"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </button>

              {expandedId === plan.id && (
                <div className="border-t border-gray-200 dark:border-[#333] p-4 bg-gray-50/50 dark:bg-[#1e1e1e]">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Задачи в плане
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPlan(plan);
                        setShowAddTaskModal(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-200 dark:bg-[#333] text-gray-700 dark:text-gray-200 text-sm hover:bg-gray-300 dark:hover:bg-[#404040]"
                    >
                      <ListTodo size={14} />
                      Подтянуть задачи
                    </button>
                  </div>

                  {(plan.taskIds || []).length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Нет задач. Нажмите «Подтянуть задачи», чтобы выбрать из раздела «Задачи» или контент-плана.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {(plan.taskIds || []).map((taskId) => {
                        const task = tasks.find((t) => t.id === taskId);
                        return (
                          <li
                            key={taskId}
                            className="flex items-center justify-between gap-2 py-2 px-3 rounded-lg bg-white dark:bg-[#252525] border border-gray-100 dark:border-[#333]"
                          >
                            <button
                              type="button"
                              onClick={() => task && onOpenTask?.(task)}
                              className="text-left flex-1 min-w-0 truncate text-sm text-gray-800 dark:text-gray-200 hover:underline"
                            >
                              {task ? task.title : `Задача ${taskId}`}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveTask(plan, taskId)}
                              className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                              title="Убрать из плана"
                            >
                              <Trash2 size={14} />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {plan.notes != null && plan.notes !== '' && (
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-[#333]">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Заметки</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                        {plan.notes}
                      </p>
                    </div>
                  )}

                  {editingPlan?.id === plan.id && (
                    <div className="mt-3">
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                        Заметки к плану
                      </label>
                      <textarea
                        value={editingPlan.notes ?? ''}
                        onChange={(e) => setEditingPlan({ ...editingPlan, notes: e.target.value })}
                        onBlur={() => editingPlan && handleSavePlan(editingPlan)}
                        className="w-full px-3 py-2 border border-gray-200 dark:border-[#333] rounded-lg bg-white dark:bg-[#252525] text-sm text-gray-800 dark:text-gray-200"
                        rows={2}
                        placeholder="Текстовые заметки к недельному плану…"
                      />
                    </div>
                  )}
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

  const filtered = tasks.filter((t) => !t.isArchived).slice(0, 200);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#252525] rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col border border-gray-200 dark:border-[#333]">
        <div className="p-4 border-b border-gray-200 dark:border-[#333] flex justify-between items-center">
          <h3 className="font-semibold text-gray-800 dark:text-white">Подтянуть задачи</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-[#333]"
          >
            ✕
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex-1">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            Выберите задачи из списка (задачи и контент-план). Уже добавленные в план отмечены.
          </p>
          <ul className="space-y-1">
            {filtered.map((task) => (
              <li key={task.id}>
                <label className="flex items-center gap-2 py-2 px-2 rounded cursor-pointer hover:bg-gray-50 dark:hover:bg-[#2a2a2a]">
                  <input
                    type="checkbox"
                    checked={chosen.has(task.id)}
                    onChange={() => toggle(task.id)}
                    className="rounded border-gray-300 dark:border-[#444]"
                  />
                  <span className="text-sm text-gray-800 dark:text-gray-200 truncate">
                    {task.title}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {filtered.length === 0 && (
            <p className="text-sm text-gray-500">Нет доступных задач.</p>
          )}
        </div>
        <div className="p-4 border-t border-gray-200 dark:border-[#333] flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-200 dark:border-[#333] text-gray-700 dark:text-gray-300 text-sm"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={addSelected}
            className="px-4 py-2 rounded-lg bg-[#3337AD] text-white text-sm font-medium"
          >
            Сохранить {chosen.size > 0 ? `(${chosen.size} задач)` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
