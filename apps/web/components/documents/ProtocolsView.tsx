/**
 * Протоколы: выбор сотрудников и единый документ по задачам из их недельных планов.
 */
import React, { useEffect, useState } from 'react';
import { FileText, Plus, Trash2, ChevronDown, ChevronRight, Loader2, Users } from 'lucide-react';
import { weeklyPlansEndpoint, type ProtocolApi } from '../../services/apiClient';
import type { User } from '../../types';
import type { Task } from '../../types';

function formatWeekLabel(weekStart: string): string {
  const d = new Date(weekStart + 'T12:00:00');
  const end = new Date(d);
  end.setDate(end.getDate() + 6);
  return `${d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

interface ProtocolsViewProps {
  users: User[];
  tasks: Task[];
  onOpenTask?: (task: Task) => void;
  layout?: 'full' | 'embedded';
}

export const ProtocolsView: React.FC<ProtocolsViewProps> = ({
  users,
  tasks,
  onOpenTask,
  layout = 'full',
}) => {
  const embedded = layout === 'embedded';
  const [protocols, setProtocols] = useState<ProtocolApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [aggregated, setAggregated] = useState<Record<string, { protocol: ProtocolApi; plans: { userId: string; taskIds: string[] }[]; taskIdsByUser: Record<string, string[]> }>>({});

  const load = async () => {
    setLoading(true);
    try {
      const data = await weeklyPlansEndpoint.getProtocols();
      setProtocols(data);
    } catch {
      setProtocols([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const loadAggregated = async (protocolId: string) => {
    try {
      const data = await weeklyPlansEndpoint.getProtocolAggregated(protocolId);
      setAggregated((prev) => ({
        ...prev,
        [protocolId]: {
          protocol: data.protocol,
          plans: data.plans,
          taskIdsByUser: data.taskIdsByUser,
        },
      }));
    } catch {
      // leave aggregated unchanged on error
    }
  };

  useEffect(() => {
    if (expandedId && !aggregated[expandedId]) {
      loadAggregated(expandedId);
    }
  }, [expandedId]);

  const handleCreateProtocol = async () => {
    const weekStart = getWeekStartMonday();
    const newProtocol: ProtocolApi = {
      id: crypto.randomUUID(),
      title: `Протокол ${formatWeekLabel(weekStart)}`,
      weekStart,
      participantIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    try {
      await weeklyPlansEndpoint.updateProtocols([...protocols, newProtocol]);
      setProtocols((prev) => [...prev, newProtocol]);
      setExpandedId(newProtocol.id);
      loadAggregated(newProtocol.id);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveProtocol = async (protocol: ProtocolApi) => {
    const list = protocols.map((p) => (p.id === protocol.id ? protocol : p));
    try {
      await weeklyPlansEndpoint.updateProtocols(list);
      setProtocols(list);
      await loadAggregated(protocol.id);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteProtocol = async (protocol: ProtocolApi) => {
    if (!confirm('Удалить этот протокол?')) return;
    try {
      await weeklyPlansEndpoint.deleteProtocol(protocol.id);
      setProtocols((prev) => prev.filter((p) => p.id !== protocol.id));
      setAggregated((prev) => {
        const next = { ...prev };
        delete next[protocol.id];
        return next;
      });
      if (expandedId === protocol.id) setExpandedId(null);
    } catch (e) {
      console.error(e);
    }
  };

  function getWeekStartMonday(): string {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - (day === 0 ? 7 : day) + 1;
    const monday = new Date(d);
    monday.setDate(diff);
    return monday.toISOString().slice(0, 10);
  }

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
              <FileText size={22} className="text-[#3337AD]" />
              Протоколы
            </h2>
            <button
              type="button"
              onClick={handleCreateProtocol}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#3337AD] text-white text-sm font-semibold hover:bg-[#292b8a] shadow-sm"
            >
              <Plus size={18} />
              Новый протокол
            </button>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
            Отметьте участников — в протокол подтянутся задачи из их недельных планов на выбранную неделю.
          </p>
        </>
      ) : (
        <div className="rounded-2xl border border-gray-200 dark:border-[#333] bg-gradient-to-br from-violet-50/80 via-white to-white dark:from-violet-950/30 dark:via-[#1e1e1e] dark:to-[#252525] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-sm text-gray-600 dark:text-gray-300 leading-snug">
            Сводка по команде: задачи из недельных планов участников на одну неделю.
          </p>
          <button
            type="button"
            onClick={handleCreateProtocol}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#3337AD] text-white text-sm font-semibold hover:bg-[#292b8a] shadow-md shrink-0"
          >
            <Plus size={18} />
            Новый протокол
          </button>
        </div>
      )}

      {protocols.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-[#333] bg-gray-50/50 dark:bg-[#1a1a1a] p-10 text-center">
          <Users size={44} className="mx-auto mb-3 text-gray-300 dark:text-gray-600" strokeWidth={1.25} />
          <p className="text-gray-700 dark:text-gray-300 font-medium">Протоколов пока нет</p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">Создайте протокол и добавьте участников.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {protocols.map((protocol) => {
            const agg = aggregated[protocol.id];
            const participantCount = (protocol.participantIds || []).length;
            return (
              <div
                key={protocol.id}
                className="rounded-2xl border border-gray-200 dark:border-[#333] overflow-hidden bg-white dark:bg-[#252525] shadow-sm hover:shadow-md transition-shadow"
              >
                <button
                  type="button"
                  className="w-full flex items-center justify-between gap-2 px-4 py-3.5 text-left hover:bg-gray-50/80 dark:hover:bg-[#2a2a2a]/80"
                  onClick={() => setExpandedId(expandedId === protocol.id ? null : protocol.id)}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#3337AD]/10 text-[#3337AD] dark:bg-[#3337AD]/25 dark:text-[#a8abf0] shrink-0">
                      {expandedId === protocol.id ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </span>
                    <span className="min-w-0">
                      <span className="font-semibold text-gray-900 dark:text-white block truncate">{protocol.title}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{formatWeekLabel(protocol.weekStart)}</span>
                    </span>
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    {participantCount > 0 && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-[#333] text-gray-600 dark:text-gray-300">
                        {participantCount} уч.
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteProtocol(protocol);
                      }}
                      className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                      title="Удалить протокол"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </button>

                {expandedId === protocol.id && (
                  <div className="border-t border-gray-100 dark:border-[#333] p-4 sm:p-5 bg-slate-50/60 dark:bg-[#1a1a1a]/80">
                    <div className="mb-5">
                      <label className="block text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                        Участники
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {users.filter((u) => !u.isArchived).map((u) => {
                          const isIn = (protocol.participantIds || []).includes(u.id);
                          return (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => {
                                const next = isIn
                                  ? (protocol.participantIds || []).filter((id) => id !== u.id)
                                  : [...(protocol.participantIds || []), u.id];
                                handleSaveProtocol({ ...protocol, participantIds: next });
                              }}
                              className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                                isIn
                                  ? 'bg-[#3337AD] text-white shadow-sm'
                                  : 'bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#444] text-gray-700 dark:text-gray-300 hover:border-[#3337AD]/40'
                              }`}
                            >
                              {u.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {agg ? (
                      <div className="space-y-4">
                        <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                          Задачи по участникам
                        </h4>
                        {Object.entries(agg.taskIdsByUser || {}).map(([userId, taskIds]) => {
                          const user = users.find((u) => u.id === userId);
                          if (!taskIds || taskIds.length === 0) return null;
                          return (
                            <div key={userId} className="rounded-xl border border-gray-200 dark:border-[#333] overflow-hidden bg-white dark:bg-[#252525] shadow-sm">
                              <div className="px-3 py-2.5 bg-gradient-to-r from-gray-50 to-white dark:from-[#2a2a2a] dark:to-[#252525] text-sm font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                                <Users size={14} className="text-[#3337AD]" />
                                {user?.name ?? userId}
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
                          );
                        })}
                        {Object.keys(agg.taskIdsByUser || {}).length === 0 && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 rounded-xl border border-dashed border-gray-200 dark:border-[#333] px-4 py-6 text-center">
                            Добавьте участников и проверьте, что у них есть недельные планы на эту неделю.
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400 py-8">
                        <Loader2 size={20} className="animate-spin" />
                        Загрузка сводки…
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
