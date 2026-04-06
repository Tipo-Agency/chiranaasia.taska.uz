import React, { useMemo } from 'react';
import type { ContentPost, ShootPlan, ShootPlanItem, User } from '../types';
import { Camera, Link2, ImageIcon, Save, X, Trash2 } from 'lucide-react';
import { DateInput } from './ui/DateInput';
import { TaskSelect } from './TaskSelect';
import { normalizeDateForInput } from '../utils/dateUtils';
import { uploadFile } from '../services/localStorageService';
import { isPostAvailableForShootRow } from '../utils/shootPlanUtils';

const emptyItem = (): ShootPlanItem => ({
  postId: '',
  brief: '',
  referenceUrl: '',
  referenceImages: [],
});

export type ShootPostFormatFilter = 'all' | ContentPost['format'];

const FORMAT_OPTS: { id: ShootPostFormatFilter; label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'post', label: 'Пост' },
  { id: 'reel', label: 'Reels' },
  { id: 'story', label: 'Stories' },
  { id: 'article', label: 'Статья' },
  { id: 'video', label: 'Видео' },
];

export interface ShootPlanModalProps {
  draft: ShootPlan;
  onDraftChange: (d: ShootPlan) => void;
  /** Посты контент-плана draft.tableId */
  allPostsForTable: ContentPost[];
  users: User[];
  reservedPostIds: Set<string>;
  postFormatFilter: ShootPostFormatFilter;
  onPostFormatFilterChange: (f: ShootPostFormatFilter) => void;
  onSave: () => void;
  onCancel: () => void;
  isNew: boolean;
  /** Если несколько контент-планов (календарь-агрегатор) */
  contentPlanOptions?: { id: string; name: string }[];
}

export const ShootPlanModal: React.FC<ShootPlanModalProps> = ({
  draft,
  onDraftChange,
  allPostsForTable,
  users,
  reservedPostIds,
  postFormatFilter,
  onPostFormatFilterChange,
  onSave,
  onCancel,
  isNew,
  contentPlanOptions,
}) => {
  const planPosts = useMemo(
    () => allPostsForTable.filter((p) => p.tableId === draft.tableId && !p.isArchived),
    [allPostsForTable, draft.tableId]
  );

  const filteredByFormat = useMemo(
    () =>
      postFormatFilter === 'all'
        ? planPosts
        : planPosts.filter((p) => p.format === postFormatFilter),
    [planPosts, postFormatFilter]
  );


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

  const updateItem = (index: number, patch: Partial<ShootPlanItem>) => {
    const items = [...(draft.items || [])];
    items[index] = { ...items[index], ...patch };
    onDraftChange({ ...draft, items });
  };

  const addItem = () => {
    onDraftChange({ ...draft, items: [...(draft.items || []), emptyItem()] });
  };

  const removeItem = (index: number) => {
    const items = (draft.items || []).filter((_, i) => i !== index);
    onDraftChange({ ...draft, items: items.length ? items : [emptyItem()] });
  };

  const toggleParticipant = (userId: string) => {
    const cur = draft.participantIds || [];
    onDraftChange({
      ...draft,
      participantIds: cur.includes(userId) ? cur.filter((x) => x !== userId) : [...cur, userId],
    });
  };

  const uploadRefImage = async (itemIndex: number, file: File) => {
    try {
      const r = await uploadFile(file, `shoot-plans/${draft.id}/refs/`);
      const it = draft.items[itemIndex];
      const imgs = [...(it.referenceImages || []), r.url];
      updateItem(itemIndex, { referenceImages: imgs });
    } catch {
      alert('Не удалось загрузить файл');
    }
  };

  const postOptionsForRow = (rowIndex: number) => {
    const items = draft.items || [];
    const rowPostId = items[rowIndex]?.postId || '';
    const usedInOtherRows = items
      .map((it, j) => (j !== rowIndex ? it.postId : ''))
      .filter(Boolean) as string[];
    return filteredByFormat.filter((pp) =>
      isPostAvailableForShootRow(pp.id, reservedPostIds, usedInOtherRows, rowPostId)
    );
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div
        className="bg-white dark:bg-[#252525] rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-200 dark:border-[#333]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-100 dark:border-[#333] flex justify-between items-center bg-gradient-to-r from-orange-50 to-rose-50 dark:from-orange-950/30 dark:to-rose-950/20">
          <div className="flex items-center gap-2">
            <Camera className="text-orange-500" size={22} />
            <span className="font-bold text-gray-900 dark:text-white">{isNew ? 'План съёмки' : 'Редактировать план съёмки'}</span>
          </div>
          <button type="button" onClick={onCancel} className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-4 space-y-4">
          {contentPlanOptions && contentPlanOptions.length > 1 && (
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Контент-план</label>
              <TaskSelect
                value={draft.tableId}
                onChange={(v) => onDraftChange({ ...draft, tableId: v })}
                options={contentPlanOptions.map((t) => ({ value: t.id, label: t.name }))}
                className="w-full"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Название</label>
            <input
              value={draft.title}
              onChange={(e) => onDraftChange({ ...draft, title: e.target.value })}
              className="w-full rounded-xl border border-gray-300 dark:border-[#555] bg-white dark:bg-[#1e1e1e] px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Дата</label>
              <DateInput
                value={normalizeDateForInput(draft.date) || draft.date}
                onChange={(d) => onDraftChange({ ...draft, date: d })}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Время</label>
              <input
                type="time"
                value={draft.time}
                onChange={(e) => onDraftChange({ ...draft, time: e.target.value })}
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
                        on ? 'bg-orange-500 text-white border-orange-500' : 'bg-gray-100 dark:bg-[#333] text-gray-600 dark:text-gray-300 border-transparent'
                      }`}
                    >
                      {u.name}
                    </button>
                  );
                })}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-bold text-gray-500 dark:text-gray-400">Позиции съёмки</label>
              <button type="button" onClick={addItem} className="text-xs font-semibold text-orange-600 dark:text-orange-400 hover:underline">
                + Добавить пост
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-gray-500 dark:text-gray-400">Формат в списке:</span>
              {FORMAT_OPTS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => onPostFormatFilterChange(f.id)}
                  className={`px-2 py-1 rounded-full text-[11px] font-medium ${
                    postFormatFilter === f.id
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 dark:bg-[#333] text-gray-600 dark:text-gray-300'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Пост, уже добавленный в другой план съёмки этого контент-плана, недоступен для выбора.
            </p>

            {(draft.items || []).map((it, idx) => {
              const selectable = postOptionsForRow(idx);
              return (
                <div key={idx} className="rounded-xl border border-gray-200 dark:border-[#444] bg-gray-50/80 dark:bg-[#1a1a1a] p-4 space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">Пост / формат из плана</label>
                      <TaskSelect
                        value={it.postId}
                        onChange={(v) => updateItem(idx, { postId: v })}
                        options={[
                          { value: '', label: 'Выберите пост' },
                          ...selectable.map((pp) => ({
                            value: pp.id,
                            label: `${pp.topic} · ${getFormatLabel(pp.format)}`,
                          })),
                          // текущее значение, если пост вне фильтра или «свой» занятый слот
                          ...(it.postId && !selectable.some((p) => p.id === it.postId)
                            ? (() => {
                                const p = planPosts.find((x) => x.id === it.postId);
                                return p
                                  ? [{ value: p.id, label: `${p.topic} · ${getFormatLabel(p.format)} (текущий)` }]
                                  : [{ value: it.postId, label: it.postId }];
                              })()
                            : []),
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
                      placeholder="Свет, ракурсы…"
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
              );
            })}
          </div>
        </div>
        <div className="px-5 py-4 border-t border-gray-100 dark:border-[#333] flex justify-end gap-2 bg-gray-50/80 dark:bg-[#1f1f1f]">
          <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#333]">
            Отмена
          </button>
          <button type="button" onClick={onSave} className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-orange-600 text-white hover:bg-orange-700">
            <Save size={16} /> Сохранить
          </button>
        </div>
      </div>
    </div>
  );
};
