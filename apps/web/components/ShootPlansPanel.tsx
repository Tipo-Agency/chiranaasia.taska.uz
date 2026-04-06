import React, { useMemo, useState } from 'react';
import { ContentPost, ShootPlan, ShootPlanItem, User } from '../types';
import { Plus, Trash2, Camera, GripVertical } from 'lucide-react';
import { normalizeDateForInput } from '../utils/dateUtils';
import { getPostIdsReservedInOtherShootPlans } from '../utils/shootPlanUtils';
import { ShootPlanModal, type ShootPostFormatFilter } from './ShootPlanModal';

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
  const [postFormatFilter, setPostFormatFilter] = useState<ShootPostFormatFilter>('all');

  const reservedPostIds = useMemo(
    () => getPostIdsReservedInOtherShootPlans(shootPlans, tableId, draft?.id),
    [shootPlans, tableId, draft?.id]
  );

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
    setPostFormatFilter('all');
  };

  const startEdit = (p: ShootPlan) => {
    setDraft({
      ...p,
      items: p.items?.length ? [...p.items] : [emptyItem()],
    });
    setEditingId(p.id);
    setPostFormatFilter('all');
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
        <ShootPlanModal
          draft={draft}
          onDraftChange={setDraft}
          allPostsForTable={posts}
          users={users}
          reservedPostIds={reservedPostIds}
          postFormatFilter={postFormatFilter}
          onPostFormatFilterChange={setPostFormatFilter}
          onSave={saveDraft}
          onCancel={cancelEdit}
          isNew={!tablePlans.find((x) => x.id === draft.id)}
        />
      )}
    </div>
  );
};
