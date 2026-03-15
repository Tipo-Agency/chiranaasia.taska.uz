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
}

export const ProtocolsView: React.FC<ProtocolsViewProps> = ({
  users,
  tasks,
  onOpenTask,
}) => {
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
          <FileText size={20} />
          Протоколы
        </h2>
        <button
          type="button"
          onClick={handleCreateProtocol}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#3337AD] text-white text-sm font-medium hover:bg-[#292b8a]"
        >
          <Plus size={18} />
          Создать протокол
        </button>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Выберите сотрудников — в протоколе отображаются задачи из их недельных планов на выбранную неделю.
      </p>

      {protocols.length === 0 ? (
        <div className="border border-dashed border-gray-200 dark:border-[#333] rounded-xl p-8 text-center text-gray-500 dark:text-gray-400">
          <Users size={40} className="mx-auto mb-2 opacity-50" />
          <p>Нет протоколов. Нажмите «Создать протокол».</p>
        </div>
      ) : (
        <div className="space-y-2">
          {protocols.map((protocol) => {
            const agg = aggregated[protocol.id];
            const participantCount = (protocol.participantIds || []).length;
            return (
              <div
                key={protocol.id}
                className="border border-gray-200 dark:border-[#333] rounded-xl overflow-hidden bg-white dark:bg-[#252525]"
              >
                <button
                  type="button"
                  className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-[#2a2a2a]"
                  onClick={() => setExpandedId(expandedId === protocol.id ? null : protocol.id)}
                >
                  <span className="flex items-center gap-2">
                    {expandedId === protocol.id ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    <span className="font-medium text-gray-800 dark:text-white">
                      {protocol.title}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatWeekLabel(protocol.weekStart)}
                    </span>
                  </span>
                  <div className="flex items-center gap-2">
                    {participantCount > 0 && (
                      <span className="text-xs text-gray-500">{participantCount} участн.</span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteProtocol(protocol);
                      }}
                      className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                      title="Удалить протокол"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </button>

                {expandedId === protocol.id && (
                  <div className="border-t border-gray-200 dark:border-[#333] p-4 bg-gray-50/50 dark:bg-[#1e1e1e]">
                    <div className="mb-4">
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                        Участники (сотрудники)
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
                              className={`px-3 py-1.5 rounded-lg text-sm ${
                                isIn
                                  ? 'bg-[#3337AD] text-white'
                                  : 'bg-gray-200 dark:bg-[#333] text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-[#404040]'
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
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Задачи по участникам (из их недельных планов)
                        </h4>
                        {Object.entries(agg.taskIdsByUser || {}).map(([userId, taskIds]) => {
                          const user = users.find((u) => u.id === userId);
                          if (!taskIds || taskIds.length === 0) return null;
                          return (
                            <div key={userId} className="rounded-lg border border-gray-200 dark:border-[#333] overflow-hidden bg-white dark:bg-[#252525]">
                              <div className="px-3 py-2 bg-gray-100 dark:bg-[#2a2a2a] text-sm font-medium text-gray-800 dark:text-gray-200">
                                {user?.name ?? userId}
                              </div>
                              <ul className="divide-y divide-gray-100 dark:divide-[#333]">
                                {taskIds.map((taskId) => {
                                  const task = tasks.find((t) => t.id === taskId);
                                  return (
                                    <li key={taskId} className="px-3 py-2">
                                      <button
                                        type="button"
                                        onClick={() => task && onOpenTask?.(task)}
                                        className="text-left w-full text-sm text-gray-800 dark:text-gray-200 hover:underline truncate block"
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
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Добавьте участников и убедитесь, что у них есть недельные планы на эту неделю.
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                        <Loader2 size={18} className="animate-spin" />
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
