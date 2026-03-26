import React, { useMemo, useState } from 'react';
import { Edit2, Plus, Trash2, X } from 'lucide-react';
import type { PriorityOption, StatusOption } from '../../types';
import { SystemConfirmDialog } from '../ui';

interface TasksSetupSettingsProps {
  statuses: StatusOption[];
  priorities: PriorityOption[];
  onUpdateStatuses: (statuses: StatusOption[]) => void;
  onUpdatePriorities: (priorities: PriorityOption[]) => void;
}

const COLOR_PRESETS: { label: string; value: string }[] = [
  { label: 'Серый', value: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700' },
  { label: 'Синий', value: 'bg-blue-500 dark:bg-blue-600 text-white border border-blue-600 dark:border-blue-500' },
  { label: 'Фиолетовый', value: 'bg-purple-500 dark:bg-purple-600 text-white border border-purple-600 dark:border-purple-500' },
  { label: 'Жёлтый', value: 'bg-amber-500 dark:bg-amber-600 text-white border border-amber-600 dark:border-amber-500' },
  { label: 'Зелёный', value: 'bg-emerald-500 dark:bg-emerald-600 text-white border border-emerald-600 dark:border-emerald-500' },
  { label: 'Красный', value: 'bg-rose-500 dark:bg-rose-600 text-white border border-rose-600 dark:border-rose-500' },
  { label: 'Низкий (зел.)', value: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700' },
  { label: 'Средний (жёлт.)', value: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700' },
  { label: 'Высокий (красн.)', value: 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-700' },
];

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
  const [statusColor, setStatusColor] = useState(COLOR_PRESETS[0]?.value || '');
  const [deleteStatusId, setDeleteStatusId] = useState<string | null>(null);

  const [priorityModalOpen, setPriorityModalOpen] = useState(false);
  const [editingPriority, setEditingPriority] = useState<PriorityOption | null>(null);
  const [priorityName, setPriorityName] = useState('');
  const [priorityColor, setPriorityColor] = useState(COLOR_PRESETS[6]?.value || COLOR_PRESETS[0]?.value || '');
  const [deletePriorityId, setDeletePriorityId] = useState<string | null>(null);

  const openStatusCreate = () => {
    setEditingStatus(null);
    setStatusName('');
    setStatusColor(COLOR_PRESETS[0]?.value || '');
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
      color: statusColor || COLOR_PRESETS[0]?.value || '',
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
    setPriorityColor(COLOR_PRESETS[6]?.value || COLOR_PRESETS[0]?.value || '');
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
      color: priorityColor || COLOR_PRESETS[6]?.value || COLOR_PRESETS[0]?.value || '',
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
                      <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold ${s.color}`}>
                        {s.name}
                      </span>
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
                      <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold ${p.color}`}>
                        {p.name}
                      </span>
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
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[80] animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setStatusModalOpen(false);
          }}
        >
          <div
            className="bg-white dark:bg-[#252525] rounded-xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-200 dark:border-[#333]"
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
                <select
                  value={statusColor}
                  onChange={(e) => setStatusColor(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100"
                >
                  {COLOR_PRESETS.slice(0, 6).map((c) => (
                    <option key={c.label} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <div className="mt-2">
                  <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold ${statusColor}`}>
                    {statusName.trim() || 'Пример'}
                  </span>
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
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[80] animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPriorityModalOpen(false);
          }}
        >
          <div
            className="bg-white dark:bg-[#252525] rounded-xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-200 dark:border-[#333]"
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
                <select
                  value={priorityColor}
                  onChange={(e) => setPriorityColor(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100"
                >
                  {COLOR_PRESETS.slice(6).map((c) => (
                    <option key={c.label} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <div className="mt-2">
                  <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold ${priorityColor}`}>
                    {priorityName.trim() || 'Пример'}
                  </span>
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

