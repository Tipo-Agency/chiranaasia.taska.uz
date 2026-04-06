import React, { useMemo, useState } from 'react';
import { ContentPost, ShootPlan, ShootPlanItem, User } from '../types';
import { Plus, Trash2, Camera, Link2, ImageIcon, GripVertical, Save, X } from 'lucide-react';
import { DateInput } from './ui/DateInput';
import { TaskSelect } from './TaskSelect';
import { normalizeDateForInput } from '../utils/dateUtils';
import { uploadFile } from '../services/localStorageService';

interface ShootPlansPanelProps {
  tableId: string;
  posts: ContentPost[];
  users: User[];
  shootPlans: ShootPlan[];
  onSave: (plan: ShootPlan) => void;
  onDelete: (id: string) => void;
}

const emptyItem = (): ShootPlanItem => ({
  postId: '',
  brief: '',
  referenceUrl: '',
  referenceImages: [],
});

export const ShootPlansPanel: React.FC<ShootPlansPanelProps> = ({
  tableId,
  posts,
  users,
  shootPlans,
  onSave,
  onDelete,
}) => {
  const planPosts = useMemo(
    () => posts.filter((p) => p.tableId === tableId && !p.isArchived),
    [posts, tableId]
  );

  const tablePlans = useMemo(
    () => shootPlans.filter((s) => s.tableId === tableId && !s.isArchived),
    [shootPlans, tableId]
  );

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ShootPlan | null>(null);

  const startCreate = () => {
    const id = `sp-${Date.now()}`;
    const d: ShootPlan = {
      id,
      tableId,
      title: 'Съёмка',
      date: new Date().toISOString().split('T')[0],
      time: '10:00',
      participantIds: [],
      items: [emptyItem()],
    };
    setDraft(d);
    setEditingId(id);
  };

  const startEdit = (p: ShootPlan) => {
    setDraft({
      ...p,
      items: p.items?.length ? [...p.items] : [emptyItem()],
    });
    setEditingId(p.id);
  };

  const cancelEdit = () => {
    setDraft(null);
    setEditingId(null);
  };

  const saveDraft = () => {
    if (!draft) return;
    if (!draft.title.trim()) {
      alert('Укажите название плана');
      return;
    }
    const cleaned: ShootPlan = {
      ...draft,
      items: (draft.items || [])
        .filter((it) => it.postId)
        .map((it) => ({
          ...it,
          referenceImages: (it.referenceImages || []).filter(Boolean),
        })),
    };
    if (cleaned.items.length === 0) {
      alert('Добавьте хотя бы один пост из контент-плана');
      return;
    }
    onSave(cleaned);
    cancelEdit();
  };

  const updateItem = (index: number, patch: Partial<ShootPlanItem>) => {
    if (!draft) return;
    const items = [...(draft.items || [])];
    items[index] = { ...items[index], ...patch };
    setDraft({ ...draft, items });
  };

  const addItem = () => {
    if (!draft) return;
    setDraft({ ...draft, items: [...(draft.items || []), emptyItem()] });
  };

  const removeItem = (index: number) => {
    if (!draft) return;
    const items = (draft.items || []).filter((_, i) => i !== index);
    setDraft({ ...draft, items: items.length ? items : [emptyItem()] });
  };

  const toggleParticipant = (userId: string) => {
    if (!draft) return;
    const cur = draft.participantIds || [];
    setDraft({
      ...draft,
      participantIds: cur.includes(userId) ? cur.filter((x) => x !== userId) : [...cur, userId],
    });
  };

  const uploadRefImage = async (itemIndex: number, file: File) => {
    if (!draft) return;
    try {
      const r = await uploadFile(file, `shoot-plans/${draft.id}/refs/`);
      const url = r.url;
      const it = draft.items[itemIndex];
      const imgs = [...(it.referenceImages || []), url];
      updateItem(itemIndex, { referenceImages: imgs });
    } catch {
      alert('Не удалось загрузить файл');
    }
  };

  const getFormatLabel = (f: string) => {
    switch (f) {
      case 'reel':
        return 'Reels';
      case 'post':
        return 'Пост';
      case 'story':
        return 'Stories';
      case 'article':
        return 'Статья';
      case 'video':
        return 'Видео';
      default:
        return f;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Планы съёмок</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 max-w-2xl">
            Соберите, что снимаем в этот день: посты и рилсы из контент-плана, ТЗ и референсы. План попадает в модуль «Календарь» как событие типа «съёмка».
          </p>
        </div>
        <button
          type="button"
          onClick={startCreate}
          disabled={!!editingId}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-rose-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:opacity-95 disabled:opacity-40"
        >
          <Plus size={18} /> Новый план съёмки
        </button>
      </div>

      {tablePlans.length === 0 && !editingId && (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-[#444] bg-white/50 dark:bg-[#1a1a1a] px-8 py-14 text-center">
          <Camera className="mx-auto text-orange-400 mb-3" size={40} />
          <p className="text-gray-700 dark:text-gray-200 font-medium">Пока нет планов съёмки</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Создайте план и привяжите посты из этого контент-плана.</p>
        </div>
      )}

      <div className="grid gap-4">
        {tablePlans.map((p) => (
          <div
            key={p.id}
            className="rounded-2xl border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1e1e1e] p-5 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span className="font-mono tabular-nums">
                    {normalizeDateForInput(p.date) || p.date} · {p.time}
                  </span>
                  <span className="rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-200 px-2 py-0.5 font-semibold">
                    {p.items?.length || 0} ед.
                  </span>
                </div>
                <h4 className="text-base font-bold text-gray-900 dark:text-white mt-1">{p.title}</h4>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => startEdit(p)}
                  disabled={!!editingId}
                  className="text-sm font-medium text-orange-600 dark:text-orange-400 hover:underline disabled:opacity-40"
                >
                  Редактировать
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Убрать план съёмки в архив?')) onDelete(p.id);
                  }}
                  className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <ul className="mt-3 space-y-2 text-sm text-gray-600 dark:text-gray-300">
              {(p.items || []).map((it, i) => {
                const post = planPosts.find((x) => x.id === it.postId);
                return (
                  <li key={i} className="flex gap-2">
                    <GripVertical size={14} className="text-gray-400 shrink-0 mt-0.5" />
                    <span>
                      <span className="font-medium text-gray-800 dark:text-gray-100">
                        {post ? post.topic : it.postId}
                      </span>
                      {post && (
                        <span className="text-xs text-gray-500 ml-2">({getFormatLabel(post.format)})</span>
                      )}
                      {it.brief && <span className="block text-xs text-gray-500 mt-0.5">{it.brief}</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {draft && editingId === draft.id && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onClick={(e) => e.target === e.currentTarget && cancelEdit()}>
          <div
            className="bg-white dark:bg-[#252525] rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-200 dark:border-[#333]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-100 dark:border-[#333] flex justify-between items-center bg-gradient-to-r from-orange-50 to-rose-50 dark:from-orange-950/30 dark:to-rose-950/20">
              <div className="flex items-center gap-2">
                <Camera className="text-orange-500" size={22} />
                <span className="font-bold text-gray-900 dark:text-white">
                  {tablePlans.find((x) => x.id === draft.id) ? 'Редактировать план' : 'Новый план съёмки'}
                </span>
              </div>
              <button type="button" onClick={cancelEdit} className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Название</label>
                <input
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  className="w-full rounded-xl border border-gray-300 dark:border-[#555] bg-white dark:bg-[#1e1e1e] px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Дата</label>
                  <DateInput value={normalizeDateForInput(draft.date) || draft.date} onChange={(d) => setDraft({ ...draft, date: d })} className="w-full" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Время</label>
                  <input
                    type="time"
                    value={draft.time}
                    onChange={(e) => setDraft({ ...draft, time: e.target.value })}
                    className="w-full rounded-xl border border-gray-300 dark:border-[#555] bg-white dark:bg-[#1e1e1e] px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2">Команда на площадке</label>
                <div className="flex flex-wrap gap-2">
                  {users
                    .filter((u) => !u.isArchived)
                    .map((u) => {
                      const on = (draft.participantIds || []).includes(u.id);
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => toggleParticipant(u.id)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                            on
                              ? 'bg-orange-500 text-white border-orange-500'
                              : 'bg-gray-100 dark:bg-[#333] text-gray-600 dark:text-gray-300 border-transparent'
                          }`}
                        >
                          {u.name}
                        </button>
                      );
                    })}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-500 dark:text-gray-400">Позиции съёмки</label>
                  <button type="button" onClick={addItem} className="text-xs font-semibold text-orange-600 dark:text-orange-400 hover:underline">
                    + Добавить пост
                  </button>
                </div>
                {(draft.items || []).map((it, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-gray-200 dark:border-[#444] bg-gray-50/80 dark:bg-[#1a1a1a] p-4 space-y-3"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">Пост / формат из плана</label>
                        <TaskSelect
                          value={it.postId}
                          onChange={(v) => updateItem(idx, { postId: v })}
                          options={[
                            { value: '', label: 'Выберите пост' },
                            ...planPosts.map((pp) => ({
                              value: pp.id,
                              label: `${pp.topic} · ${getFormatLabel(pp.format)}`,
                            })),
                          ]}
                          className="w-full"
                        />
                      </div>
                      {(draft.items || []).length > 1 && (
                        <button type="button" onClick={() => removeItem(idx)} className="p-2 text-gray-400 hover:text-red-500">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">ТЗ / задачи на съёмку</label>
                      <textarea
                        value={it.brief || ''}
                        onChange={(e) => updateItem(idx, { brief: e.target.value })}
                        rows={3}
                        placeholder="Свет, ракурсы, обязательные кадры, хронометраж…"
                        className="w-full rounded-xl border border-gray-300 dark:border-[#555] bg-white dark:bg-[#222] px-3 py-2 text-sm resize-y min-h-[72px]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                        <Link2 size={12} /> Ссылка на референс
                      </label>
                      <input
                        value={it.referenceUrl || ''}
                        onChange={(e) => updateItem(idx, { referenceUrl: e.target.value })}
                        placeholder="https://…"
                        className="w-full rounded-xl border border-gray-300 dark:border-[#555] bg-white dark:bg-[#222] px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                        <ImageIcon size={12} /> Референсы-картинки
                      </label>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {(it.referenceImages || []).map((url, j) => (
                          <div key={j} className="relative group w-20 h-20 rounded-lg overflow-hidden border border-gray-200 dark:border-[#555]">
                            <img src={url} alt="" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 text-white text-xs"
                              onClick={() => {
                                const next = (it.referenceImages || []).filter((_, k) => k !== j);
                                updateItem(idx, { referenceImages: next });
                              }}
                            >
                              Убрать
                            </button>
                          </div>
                        ))}
                      </div>
                      <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-gray-300 dark:border-[#555] cursor-pointer text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#333]">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void uploadRefImage(idx, f);
                            e.target.value = '';
                          }}
                        />
                        Загрузить изображение
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-5 py-4 border-t border-gray-100 dark:border-[#333] flex justify-end gap-2 bg-gray-50/80 dark:bg-[#1f1f1f]">
              <button type="button" onClick={cancelEdit} className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#333]">
                Отмена
              </button>
              <button
                type="button"
                onClick={saveDraft}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-orange-600 text-white hover:bg-orange-700"
              >
                <Save size={16} /> Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
