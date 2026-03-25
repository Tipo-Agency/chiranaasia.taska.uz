/**
 * Протоколы подразделений: отдельная модалка с периодом, участниками, задачами и финансовой статистикой.
 */
import React, { useEffect, useState, useCallback, forwardRef, useImperativeHandle, useMemo } from 'react';
import { FileText, Trash2, Loader2, Users, Building2, X, Save } from 'lucide-react';
import { ModuleCreateIconButton } from '../ui/ModuleCreateIconButton';
import { SystemConfirmDialog } from '../ui';
import { DateRangeInput } from '../ui/DateInput';
import { weeklyPlansEndpoint, financeEndpoint, type ProtocolApi, type WeeklyPlanApi, type IncomeReportApi } from '../../services/apiClient';
import type { User, Task, Department, EmployeeInfo } from '../../types';

function formatPeriodLabel(weekStart: string, weekEnd?: string): string {
  const d = new Date(`${weekStart}T12:00:00`);
  const end = new Date(`${(weekEnd || weekStart)}T12:00:00`);
  return `${d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

function getWeekStartMonday(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - (day === 0 ? 7 : day) + 1;
  const monday = new Date(d);
  monday.setDate(diff);
  return monday.toISOString().slice(0, 10);
}

interface ProtocolsViewProps {
  users: User[];
  tasks: Task[];
  departments?: Department[];
  employees?: EmployeeInfo[];
  onOpenTask?: (task: Task) => void;
  layout?: 'full' | 'embedded';
  hideEmbeddedToolbar?: boolean;
}

export interface ProtocolsViewHandle {
  createProtocol: () => void;
  toggleFilters: () => void;
}

export const ProtocolsView = forwardRef<ProtocolsViewHandle, ProtocolsViewProps>(function ProtocolsView(
  {
    users,
    tasks,
    departments = [],
    employees = [],
    onOpenTask,
    layout = 'full',
    hideEmbeddedToolbar = false,
  },
  ref
) {
  const embedded = layout === 'embedded';
  const [protocols, setProtocols] = useState<ProtocolApi[]>([]);
  const [weeklyPlans, setWeeklyPlans] = useState<WeeklyPlanApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [openedProtocolId, setOpenedProtocolId] = useState<string | null>(null);
  const [editingProtocol, setEditingProtocol] = useState<ProtocolApi | null>(null);
  const [protocolToDelete, setProtocolToDelete] = useState<ProtocolApi | null>(null);
  const [userFilter, setUserFilter] = useState<'all' | string>('all');
  const [showFilters, setShowFilters] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [protocolsData, plansData] = await Promise.all([
        weeklyPlansEndpoint.getProtocols(),
        weeklyPlansEndpoint.getPlans(),
      ]);
      setProtocols(protocolsData);
      setWeeklyPlans(plansData);
    } catch {
      setProtocols([]);
      setWeeklyPlans([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const createProtocolDraft = useCallback((): ProtocolApi => {
    const weekStart = getWeekStartMonday();
    const end = new Date(`${weekStart}T12:00:00`);
    end.setDate(end.getDate() + 6);
    return {
      id: crypto.randomUUID(),
      title: `Протокол ${formatPeriodLabel(weekStart, end.toISOString().slice(0, 10))}`,
      weekStart,
      weekEnd: end.toISOString().slice(0, 10),
      departmentId: '',
      participantIds: [],
      plannedIncome: 0,
      actualIncome: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }, []);

  const openCreateModal = useCallback(() => {
    const draft = createProtocolDraft();
    setEditingProtocol(draft);
    setOpenedProtocolId(draft.id);
  }, [createProtocolDraft]);

  useImperativeHandle(ref, () => ({
    createProtocol: () => openCreateModal(),
    toggleFilters: () => setShowFilters((v) => !v),
  }), [openCreateModal]);

  const handleSaveProtocol = async (protocol: ProtocolApi) => {
    const exists = protocols.some((p) => p.id === protocol.id);
    const payload = { ...protocol, updatedAt: new Date().toISOString() };
    const list = exists ? protocols.map((p) => (p.id === protocol.id ? payload : p)) : [...protocols, payload];
    try {
      await weeklyPlansEndpoint.updateProtocols(list);
      setProtocols(list);
      setEditingProtocol(null);
      setOpenedProtocolId(null);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteProtocol = async (protocol: ProtocolApi) => {
    try {
      await weeklyPlansEndpoint.deleteProtocol(protocol.id);
      setProtocols((prev) => prev.filter((p) => p.id !== protocol.id));
      if (openedProtocolId === protocol.id) {
        setOpenedProtocolId(null);
        setEditingProtocol(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const selectedProtocol = useMemo(() => {
    if (!openedProtocolId) return null;
    if (editingProtocol?.id === openedProtocolId) return editingProtocol;
    return protocols.find((p) => p.id === openedProtocolId) || null;
  }, [openedProtocolId, editingProtocol, protocols]);

  const userDepartmentMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const emp of employees) {
      if (emp.userId && emp.departmentId) map.set(emp.userId, emp.departmentId);
    }
    return map;
  }, [employees]);

  const participantsPool = useMemo(() => {
    if (!selectedProtocol?.departmentId) return users.filter((u) => !u.isArchived);
    return users.filter((u) => !u.isArchived && userDepartmentMap.get(u.id) === selectedProtocol.departmentId);
  }, [users, selectedProtocol?.departmentId, userDepartmentMap]);

  const taskIdsByUser = useMemo(() => {
    if (!selectedProtocol) return {} as Record<string, string[]>;
    const start = selectedProtocol.weekStart;
    const end = selectedProtocol.weekEnd || selectedProtocol.weekStart;
    const map: Record<string, string[]> = {};
    weeklyPlans.forEach((plan) => {
      if (!(selectedProtocol.participantIds || []).includes(plan.userId)) return;
      if (plan.weekStart < start || plan.weekStart > end) return;
      const existing = map[plan.userId] || [];
      map[plan.userId] = [...new Set([...existing, ...(plan.taskIds || [])])];
    });
    return map;
  }, [selectedProtocol, weeklyPlans]);

  const filteredProtocols = useMemo(() => {
    if (userFilter === 'all') return protocols;
    return protocols.filter((p) => (p.participantIds || []).includes(userFilter));
  }, [protocols, userFilter]);

  const groupedByDepartment = useMemo(() => {
    const map = new Map<string, ProtocolApi[]>();
    filteredProtocols.forEach((p) => {
      const key = p.departmentId || '__no_dept__';
      const arr = map.get(key) || [];
      arr.push(p);
      map.set(key, arr);
    });
    return [...map.entries()].map(([depId, list]) => ({
      depId,
      depName: depId === '__no_dept__' ? 'Без подразделения' : (departments.find((d) => d.id === depId)?.name || 'Подразделение'),
      list: list.sort((a, b) => (b.weekStart || '').localeCompare(a.weekStart || '')),
    }));
  }, [filteredProtocols, departments]);

  const pullActualFromFinance = async () => {
    if (!selectedProtocol) return;
    try {
      const reports = await financeEndpoint.getIncomeReports();
      const start = selectedProtocol.weekStart;
      const end = selectedProtocol.weekEnd || selectedProtocol.weekStart;
      const total = reports
        .filter((r) => r.period >= start.slice(0, 7) && r.period <= end.slice(0, 7))
        .reduce((sum, r) => sum + Object.values((r as IncomeReportApi).data || {}).reduce((s, n) => s + (Number(n) || 0), 0), 0);
      setEditingProtocol({ ...selectedProtocol, actualIncome: total });
    } catch (e) {
      console.error(e);
    }
  };

  const sumNumericDeep = (value: unknown): number => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (Array.isArray(value)) return value.reduce((s: number, v) => s + sumNumericDeep(v), 0);
    if (value && typeof value === 'object') {
      return Object.values(value as Record<string, unknown>).reduce<number>((s, v) => s + sumNumericDeep(v), 0);
    }
    return 0;
  };

  const pullPlannedFromFinance = async () => {
    if (!selectedProtocol) return;
    try {
      const plan = await financeEndpoint.getPlan();
      const totalPlan = sumNumericDeep(plan);
      setEditingProtocol({ ...selectedProtocol, plannedIncome: Math.round(totalPlan) });
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 p-4">
        <Loader2 size={18} className="animate-spin" />
        Загрузка...
      </div>
    );
  }

  return (
    <>
      <div className={embedded ? 'space-y-5' : 'space-y-4'}>
        {!embedded ? (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2 className="font-bold text-gray-800 dark:text-white flex items-center gap-2 text-lg">
              <FileText size={22} className="text-[#3337AD]" />
              Протоколы подразделений
            </h2>
            <ModuleCreateIconButton accent="indigo" label="Новый протокол" onClick={openCreateModal} />
          </div>
        ) : hideEmbeddedToolbar ? null : (
          <div className="rounded-2xl border border-gray-200 dark:border-[#333] bg-gradient-to-br from-violet-50/80 via-white to-white dark:from-violet-950/30 dark:via-[#1e1e1e] dark:to-[#252525] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-snug">
              Протокол по подразделению: период, участники, задачи из недельных планов и финансовая статистика.
            </p>
            <ModuleCreateIconButton accent="indigo" label="Новый протокол" onClick={openCreateModal} className="shrink-0" />
          </div>
        )}
        {showFilters && (
        <div className="rounded-2xl border border-gray-200 dark:border-[#333] bg-white dark:bg-[#252525] p-3">
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Фильтр по участнику</label>
          <select
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="w-full sm:w-72 px-3 py-2 rounded-xl border border-gray-200 dark:border-[#444] bg-white dark:bg-[#1f1f1f] text-sm"
          >
            <option value="all">Все сотрудники</option>
            {users.filter((u) => !u.isArchived).map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
        )}

        {groupedByDepartment.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-[#333] bg-gray-50/50 dark:bg-[#1a1a1a] p-10 text-center">
            <Users size={44} className="mx-auto mb-3 text-gray-300 dark:text-gray-600" strokeWidth={1.25} />
            <p className="text-gray-700 dark:text-gray-300 font-medium">Протоколов пока нет</p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">Создайте первый протокол.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {groupedByDepartment.map((group) => (
              <div key={group.depId} className="rounded-2xl border border-gray-200 dark:border-[#333] overflow-hidden bg-white dark:bg-[#252525]">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-[#333] bg-gray-50/70 dark:bg-[#2a2a2a]/70 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                    <Building2 size={15} className="text-[#3337AD]" />
                    {group.depName}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-[#333] text-gray-600 dark:text-gray-300">{group.list.length}</span>
                </div>
                <div className="p-2 space-y-2">
                  {group.list.map((protocol) => (
                    <div key={protocol.id} className="rounded-xl border border-gray-200 dark:border-[#333] bg-white dark:bg-[#252525] hover:shadow-sm">
                      <button
                        type="button"
                        className="w-full px-4 py-3 flex items-center justify-between text-left"
                        onClick={() => {
                          setOpenedProtocolId(protocol.id);
                          setEditingProtocol(protocol);
                        }}
                      >
                        <div>
                          <div className="text-sm font-semibold text-gray-900 dark:text-white">{protocol.title}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{formatPeriodLabel(protocol.weekStart, protocol.weekEnd)}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-[#333] text-gray-600 dark:text-gray-300">{(protocol.participantIds || []).length} уч.</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setProtocolToDelete(protocol);
                            }}
                            className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedProtocol && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 dark:bg-black/70 backdrop-blur-sm p-4" onClick={() => setOpenedProtocolId(null)}>
          <div className="w-full max-w-4xl max-h-[88vh] overflow-hidden rounded-2xl bg-white dark:bg-[#191919] border border-gray-200 dark:border-[#333] shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 dark:border-[#333] flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">Протокол подразделения</h3>
              <button type="button" onClick={() => setOpenedProtocolId(null)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-[#333]"><X size={18} /></button>
            </div>
            <div className="p-4 overflow-y-auto custom-scrollbar space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">Название протокола</label>
                  <input
                    value={selectedProtocol.title}
                    onChange={(e) => setEditingProtocol({ ...selectedProtocol, title: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-[#333] bg-white dark:bg-[#252525] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">Подразделение</label>
                  <select
                    value={selectedProtocol.departmentId || ''}
                    onChange={(e) => {
                      const depId = e.target.value;
                      const nextParticipants = (selectedProtocol.participantIds || []).filter((uid) => !depId || userDepartmentMap.get(uid) === depId);
                      setEditingProtocol({ ...selectedProtocol, departmentId: depId, participantIds: nextParticipants });
                    }}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-[#333] bg-white dark:bg-[#252525] text-sm"
                  >
                    <option value="">Без подразделения</option>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">Период</label>
                <DateRangeInput
                  startDate={selectedProtocol.weekStart}
                  endDate={selectedProtocol.weekEnd || selectedProtocol.weekStart}
                  autoRangeDays={7}
                  onChange={(start, end) => setEditingProtocol({ ...selectedProtocol, weekStart: start, weekEnd: end || start })}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">Состав участников</label>
                <div className="flex flex-wrap gap-2">
                  {participantsPool.map((u) => {
                    const isIn = (selectedProtocol.participantIds || []).includes(u.id);
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          const next = isIn
                            ? (selectedProtocol.participantIds || []).filter((id) => id !== u.id)
                            : [...(selectedProtocol.participantIds || []), u.id];
                          setEditingProtocol({ ...selectedProtocol, participantIds: next });
                        }}
                        className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                          isIn ? 'bg-[#3337AD] text-white shadow-sm' : 'bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#444] text-gray-700 dark:text-gray-300 hover:border-[#3337AD]/40'
                        }`}
                      >
                        {u.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 dark:border-[#333] bg-white dark:bg-[#252525] p-3">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Статистика по выручке</h4>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => void pullPlannedFromFinance()} className="text-xs text-[#3337AD] hover:underline">
                      Подтянуть план из фин.планирования
                    </button>
                    <button type="button" onClick={() => void pullActualFromFinance()} className="text-xs text-[#3337AD] hover:underline">
                      Подтянуть факт из фин.планирования
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">План заработать</label>
                    <input
                      type="number"
                      value={selectedProtocol.plannedIncome ?? 0}
                      onChange={(e) => setEditingProtocol({ ...selectedProtocol, plannedIncome: Number(e.target.value || 0) })}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1f1f1f] text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Заработали по факту</label>
                    <input
                      type="number"
                      value={selectedProtocol.actualIncome ?? 0}
                      onChange={(e) => setEditingProtocol({ ...selectedProtocol, actualIncome: Number(e.target.value || 0) })}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1f1f1f] text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Задачи из недельных планов участников</h4>
                {Object.entries(taskIdsByUser).length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 rounded-xl border border-dashed border-gray-200 dark:border-[#333] px-4 py-6 text-center">
                    В выбранном периоде у участников нет задач в недельных планах.
                  </p>
                ) : (
                  (Object.entries(taskIdsByUser) as [string, string[]][]).map(([uid, taskIds]) => (
                    <div key={uid} className="rounded-xl border border-gray-200 dark:border-[#333] overflow-hidden bg-white dark:bg-[#252525] shadow-sm">
                      <div className="px-3 py-2.5 bg-gradient-to-r from-gray-50 to-white dark:from-[#2a2a2a] dark:to-[#252525] text-sm font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                        <Users size={14} className="text-[#3337AD]" />
                        {users.find((u) => u.id === uid)?.name || uid}
                      </div>
                      <ul className="divide-y divide-gray-100 dark:divide-[#333]">
                        {taskIds.map((taskId) => {
                          const task = tasks.find((t) => t.id === taskId);
                          return (
                            <li key={taskId} className="px-3 py-2.5">
                              <button
                                type="button"
                                onClick={() => task && onOpenTask?.(task)}
                                className="text-left w-full text-sm font-medium text-gray-800 dark:text-gray-200 hover:text-[#3337AD] dark:hover:text-[#8b8ee0] truncate"
                              >
                                {task ? task.title : `Задача ${taskId}`}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-[#333] flex justify-end gap-2">
              <button type="button" onClick={() => setOpenedProtocolId(null)} className="px-4 py-2 rounded-xl border border-gray-200 dark:border-[#333] text-sm">
                Отмена
              </button>
              <button
                type="button"
                onClick={() => void handleSaveProtocol(selectedProtocol)}
                className="px-4 py-2 rounded-xl bg-[#3337AD] text-white text-sm font-semibold inline-flex items-center gap-2"
              >
                <Save size={14} />
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      <SystemConfirmDialog
        open={Boolean(protocolToDelete)}
        title="Удалить протокол"
        message="Вы уверены, что хотите удалить этот протокол?"
        danger
        confirmText="Удалить"
        cancelText="Отмена"
        onCancel={() => setProtocolToDelete(null)}
        onConfirm={() => {
          if (protocolToDelete) {
            void handleDeleteProtocol(protocolToDelete);
          }
          setProtocolToDelete(null);
        }}
      />
    </>
  );
});
