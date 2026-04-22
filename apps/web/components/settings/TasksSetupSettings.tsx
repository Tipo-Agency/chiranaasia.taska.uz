import React, { useMemo, useState } from 'react';
import { Edit2, Plus, Trash2, X } from 'lucide-react';
import type { PriorityOption, StatusOption } from '../../types';
import { SystemConfirmDialog } from '../ui';
import { TaskBadgeInline } from '../ui/TaskBadgeInline';
import { DEFAULT_PRIORITY_BADGE_INDEX, TASK_BADGE_PRESETS } from '../../utils/taskBadgePresets';

interface TasksSetupSettingsProps {
  statuses: StatusOption[];
  priorities: PriorityOption[];
  onUpdateStatuses: (statuses: StatusOption[]) => void;
  onUpdatePriorities: (priorities: PriorityOption[]) => void;
}

const defaultStatusColorValue = 'badge:0';
const defaultPriorityColorValue = `badge:${DEFAULT_PRIORITY_BADGE_INDEX}`;

export const TasksSetupSettings: React.FC<TasksSetupSettingsProps> = ({
  statuses,
  priorities,
  onUpdateStatuses,
  onUpdatePriorities,
}) => {
  const activeStatuses = useMemo(() => statuses.filter((s) => !s.isArchived), [statuses]);
  const activePriorities = useMemo(() => priorities.filter((p) => !p.isArchived), [priorities]);

  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [editingStatus, setEditingStatus] = useState<StatusOption | null>(null);
  const [statusName, setStatusName] = useState('');
  const [statusColor, setStatusColor] = useState(defaultStatusColorValue);
  const [deleteStatusId, setDeleteStatusId] = useState<string | null>(null);

  const [priorityModalOpen, setPriorityModalOpen] = useState(false);
  const [editingPriority, setEditingPriority] = useState<PriorityOption | null>(null);
  const [priorityName, setPriorityName] = useState('');
  const [priorityColor, setPriorityColor] = useState(defaultPriorityColorValue);
  const [deletePriorityId, setDeletePriorityId] = useState<string | null>(null);

  const openStatusCreate = () => {
    setEditingStatus(null);
    setStatusName('');
    setStatusColor(defaultStatusColorValue);
    setStatusModalOpen(true);
  };
  const openStatusEdit = (s: StatusOption) => {
    setEditingStatus(s);
    setStatusName(s.name);
    setStatusColor(s.color);
    setStatusModalOpen(true);
  };
  const saveStatus = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const name = statusName.trim();
    if (!name) return;
    const payload: StatusOption = {
      id: editingStatus?.id || `st-${Date.now()}`,
      name,
      color: statusColor || defaultStatusColorValue,
      isArchived: false,
    };
    const next = editingStatus
      ? statuses.map((x) => (x.id === editingStatus.id ? { ...x, ...payload } : x))
      : [...statuses, payload];
    onUpdateStatuses(next);
    setStatusModalOpen(false);
  };

  const openPriorityCreate = () => {
    setEditingPriority(null);
    setPriorityName('');
    setPriorityColor(defaultPriorityColorValue);
    setPriorityModalOpen(true);
  };
  const openPriorityEdit = (p: PriorityOption) => {
    setEditingPriority(p);
    setPriorityName(p.name);
    setPriorityColor(p.color);
    setPriorityModalOpen(true);
  };
  const savePriority = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const name = priorityName.trim();
    if (!name) return;
    const payload: PriorityOption = {
      id: editingPriority?.id || `pr-${Date.now()}`,
      name,
      color: priorityColor || defaultPriorityColorValue,
      isArchived: false,
    };
    const next = editingPriority
      ? priorities.map((x) => (x.id === editingPriority.id ? { ...x, ...payload } : x))
      : [...priorities, payload];
    onUpdatePriorities(next);
    setPriorityModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-2xl p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xl font-bold text-gray-900 dark:text-white">Задачи</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Управляйте справочниками: статусы и приоритеты. Удаление — через архив (можно восстановить).
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Statuses */}
        <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-[#333] bg-gray-50 dark:bg-[#202020]">
            <div>
              <div className="font-bold text-gray-900 dark:text-white">Статусы задач</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Показываются в карточке задачи и в канбане</div>
            </div>
            <button
              type="button"
              onClick={openStatusCreate}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold"
            >
              <Plus size={16} />
              Добавить
            </button>
          </div>
          <div className="p-5">
            {activeStatuses.length === 0 ? (
              <div className="text-sm text-gray-500 dark:text-gray-400">Нет активных статусов.</div>
            ) : (
              <div className="space-y-2">
                {activeStatuses.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 dark:border-[#333] bg-white dark:bg-[#252525] px-3 py-2"
                  >
                    <div className="min-w-0 flex items-center gap-2">
                      <TaskBadgeInline color={s.color} className="px-2 py-1 text-xs">
                        {s.name}
                      </TaskBadgeInline>
                      <span className="text-[11px] text-gray-400 dark:text-gray-500 truncate">{s.id}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openStatusEdit(s)}
                        className="p-2 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                        title="Редактировать"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteStatusId(s.id)}
                        className="p-2 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                        title="Удалить (в архив)"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Priorities */}
        <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-[#333] bg-gray-50 dark:bg-[#202020]">
            <div>
              <div className="font-bold text-gray-900 dark:text-white">Приоритеты</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Показываются в таблице и в карточке задачи</div>
            </div>
            <button
              type="button"
              onClick={openPriorityCreate}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold"
            >
              <Plus size={16} />
              Добавить
            </button>
          </div>
          <div className="p-5">
            {activePriorities.length === 0 ? (
              <div className="text-sm text-gray-500 dark:text-gray-400">Нет активных приоритетов.</div>
            ) : (
              <div className="space-y-2">
                {activePriorities.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 dark:border-[#333] bg-white dark:bg-[#252525] px-3 py-2"
                  >
                    <div className="min-w-0 flex items-center gap-2">
                      <TaskBadgeInline color={p.color} className="px-2 py-1 text-xs">
                        {p.name}
                      </TaskBadgeInline>
                      <span className="text-[11px] text-gray-400 dark:text-gray-500 truncate">{p.id}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openPriorityEdit(p)}
                        className="p-2 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                        title="Редактировать"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletePriorityId(p.id)}
                        className="p-2 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                        title="Удалить (в архив)"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status modal */}
      {statusModalOpen && (
        <div
          className="fixed inset-0 min-h-[100dvh] w-full bg-black/40 backdrop-blur-sm flex items-center justify-center z-[80] animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setStatusModalOpen(false);
          }}
        >
          <div
            className="bg-white dark:bg-[#252525] rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-[#333]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-100 dark:border-[#333] flex justify-between items-center bg-white dark:bg-[#252525]">
              <h3 className="font-bold text-gray-800 dark:text-white">{editingStatus ? 'Редактировать статус' : 'Новый статус'}</h3>
              <button onClick={() => setStatusModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#333]">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={saveStatus} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Название</label>
                <input
                  required
                  value={statusName}
                  onChange={(e) => setStatusName(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Например: В работе"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Цвет</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[min(50vh,22rem)] overflow-y-auto custom-scrollbar pr-0.5">
                  {TASK_BADGE_PRESETS.map((preset, idx) => {
                    const value = `badge:${idx}`;
                    const active = statusColor === value;
                    return (
                      <button
                        key={`st-palette-${idx}`}
                        type="button"
                        onClick={() => setStatusColor(value)}
                        className={`flex items-center gap-2 px-2 py-2 rounded-lg border text-sm transition-colors ${
                          active
                            ? 'border-gray-900 dark:border-white bg-gray-50 dark:bg-[#1f1f1f]'
                            : 'border-gray-200 dark:border-[#444] hover:bg-gray-50 dark:hover:bg-[#303030]'
                        }`}
                      >
                        <span
                          className="w-4 h-4 rounded-full shrink-0 ring-1 ring-black/10 dark:ring-white/10"
                          style={{ backgroundColor: preset.dot.light }}
                          aria-hidden="true"
                        />
                        <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200 text-left leading-tight line-clamp-2">
                          {preset.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-2">
                  <TaskBadgeInline color={statusColor} className="px-2 py-1 text-xs">
                    {statusName.trim() || 'Пример'}
                  </TaskBadgeInline>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setStatusModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#303030] rounded-lg">
                  Отмена
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg shadow-sm">
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Priority modal */}
      {priorityModalOpen && (
        <div
          className="fixed inset-0 min-h-[100dvh] w-full bg-black/40 backdrop-blur-sm flex items-center justify-center z-[80] animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPriorityModalOpen(false);
          }}
        >
          <div
            className="bg-white dark:bg-[#252525] rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-[#333]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-100 dark:border-[#333] flex justify-between items-center bg-white dark:bg-[#252525]">
              <h3 className="font-bold text-gray-800 dark:text-white">{editingPriority ? 'Редактировать приоритет' : 'Новый приоритет'}</h3>
              <button onClick={() => setPriorityModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#333]">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={savePriority} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Название</label>
                <input
                  required
                  value={priorityName}
                  onChange={(e) => setPriorityName(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Например: Высокий"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Цвет</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[min(50vh,22rem)] overflow-y-auto custom-scrollbar pr-0.5">
                  {TASK_BADGE_PRESETS.map((preset, idx) => {
                    const value = `badge:${idx}`;
                    const active = priorityColor === value;
                    return (
                      <button
                        key={`pr-palette-${idx}`}
                        type="button"
                        onClick={() => setPriorityColor(value)}
                        className={`flex items-center gap-2 px-2 py-2 rounded-lg border text-sm transition-colors ${
                          active
                            ? 'border-gray-900 dark:border-white bg-gray-50 dark:bg-[#1f1f1f]'
                            : 'border-gray-200 dark:border-[#444] hover:bg-gray-50 dark:hover:bg-[#303030]'
                        }`}
                      >
                        <span
                          className="w-4 h-4 rounded-full shrink-0 ring-1 ring-black/10 dark:ring-white/10"
                          style={{ backgroundColor: preset.dot.light }}
                          aria-hidden="true"
                        />
                        <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200 text-left leading-tight line-clamp-2">
                          {preset.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-2">
                  <TaskBadgeInline color={priorityColor} className="px-2 py-1 text-xs">
                    {priorityName.trim() || 'Пример'}
                  </TaskBadgeInline>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setPriorityModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#303030] rounded-lg">
                  Отмена
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg shadow-sm">
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <SystemConfirmDialog
        open={Boolean(deleteStatusId)}
        title="Удалить статус"
        message="Статус будет перенесён в архив. Его можно восстановить в разделе «Архив»."
        danger
        confirmText="Удалить"
        cancelText="Отмена"
        onCancel={() => setDeleteStatusId(null)}
        onConfirm={() => {
          if (!deleteStatusId) return;
          onUpdateStatuses(statuses.map((s) => (s.id === deleteStatusId ? { ...s, isArchived: true } : s)));
          setDeleteStatusId(null);
        }}
      />

      <SystemConfirmDialog
        open={Boolean(deletePriorityId)}
        title="Удалить приоритет"
        message="Приоритет будет перенесён в архив. Его можно восстановить в разделе «Архив»."
        danger
        confirmText="Удалить"
        cancelText="Отмена"
        onCancel={() => setDeletePriorityId(null)}
        onConfirm={() => {
          if (!deletePriorityId) return;
          onUpdatePriorities(priorities.map((p) => (p.id === deletePriorityId ? { ...p, isArchived: true } : p)));
          setDeletePriorityId(null);
        }}
      />
    </div>
  );
};

