import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, GripVertical, ArrowLeft } from 'lucide-react';
import type { ProductionRoutePipeline, ProductionRouteStage, User } from '../../types';

const STAGE_COLORS = [
  'bg-slate-200 dark:bg-slate-700',
  'bg-amber-200 dark:bg-amber-900/40',
  'bg-emerald-200 dark:bg-emerald-900/40',
  'bg-sky-200 dark:bg-sky-900/40',
  'bg-violet-200 dark:bg-violet-900/40',
];

interface ProductionRoutesSettingsProps {
  pipelines: ProductionRoutePipeline[];
  users: User[];
  onSave: (p: ProductionRoutePipeline) => void;
  onDelete: (id: string) => void;
  createRequested?: number;
}

function newStage(i: number): ProductionRouteStage {
  return {
    id: `st-${Date.now()}-${i}`,
    label: `Этап ${i + 1}`,
    color: STAGE_COLORS[i % STAGE_COLORS.length],
    position: i,
  };
}

const ProductionRoutesSettings: React.FC<ProductionRoutesSettingsProps> = ({
  pipelines,
  users,
  onSave,
  onDelete,
  createRequested = 0,
}) => {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ProductionRoutePipeline | null>(null);
  const [name, setName] = useState('');
  const [stages, setStages] = useState<ProductionRouteStage[]>([]);
  const lastCreateRef = useRef(0);

  const activeList = useMemo(() => pipelines.filter((p) => !p.isArchived), [pipelines]);

  useEffect(() => {
    if (createRequested <= lastCreateRef.current) return;
    lastCreateRef.current = createRequested;
    const fresh: ProductionRoutePipeline = {
      id: `pr-${Date.now()}`,
      name: 'Новый маршрут',
      stages: [newStage(0), newStage(1)],
    };
    setEditing(fresh);
    setName(fresh.name);
    setStages(fresh.stages);
    setEditorOpen(true);
  }, [createRequested]);

  const openEdit = (p: ProductionRoutePipeline) => {
    setEditing(p);
    setName(p.name);
    setStages((p.stages || []).map((s, i) => ({ ...s, position: s.position ?? i })));
    setEditorOpen(true);
  };

  const moveStage = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= stages.length) return;
    const next = [...stages];
    [next[idx], next[j]] = [next[j], next[idx]];
    setStages(next.map((s, i) => ({ ...s, position: i })));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    if (!name.trim()) return;
    if (stages.length === 0) {
      alert('Добавьте хотя бы один этап');
      return;
    }
    onSave({
      ...editing,
      name: name.trim(),
      stages: stages.map((s, i) => ({ ...s, position: i })),
    });
    setEditorOpen(false);
    setEditing(null);
  };

  if (editorOpen && editing) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => {
            setEditorOpen(false);
            setEditing(null);
          }}
          className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
        >
          <ArrowLeft size={16} /> К списку маршрутов
        </button>
        <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-2xl p-4 md:p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {editing.id.startsWith('pr-') && !activeList.find((x) => x.id === editing.id) ? 'Новый маршрут' : 'Редактирование маршрута'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Название</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1a1a1a] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">Этапы (слева направо)</span>
                <button
                  type="button"
                  onClick={() => setStages([...stages, newStage(stages.length)])}
                  className="text-xs text-amber-700 dark:text-amber-400 font-medium"
                >
                  + Этап
                </button>
              </div>
              <div className="space-y-2">
                {stages.map((s, idx) => (
                  <div
                    key={s.id}
                    className="flex flex-wrap items-center gap-2 p-2 rounded-lg border border-gray-100 dark:border-[#333] bg-gray-50 dark:bg-[#1e1e1e]"
                  >
                    <GripVertical size={16} className="text-gray-400 shrink-0" />
                    <input
                      value={s.label}
                      onChange={(e) => {
                        const v = e.target.value;
                        setStages(stages.map((x, i) => (i === idx ? { ...x, label: v } : x)));
                      }}
                      className="flex-1 min-w-[120px] rounded border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1a1a1a] px-2 py-1 text-sm"
                    />
                    <select
                      value={s.defaultAssigneeUserId || ''}
                      onChange={(e) => {
                        const v = e.target.value || undefined;
                        setStages(stages.map((x, i) => (i === idx ? { ...x, defaultAssigneeUserId: v } : x)));
                      }}
                      className="text-xs rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1a1a1a] px-2 py-1 max-w-[180px]"
                    >
                      <option value="">Ответственный…</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={s.color || STAGE_COLORS[0]}
                      onChange={(e) => {
                        const v = e.target.value;
                        setStages(stages.map((x, i) => (i === idx ? { ...x, color: v } : x)));
                      }}
                      className="text-xs rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1a1a1a] px-2 py-1"
                    >
                      {STAGE_COLORS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-1">
                      <button type="button" className="text-xs px-2 py-1 rounded border dark:border-[#444]" onClick={() => moveStage(idx, -1)}>
                        ↑
                      </button>
                      <button type="button" className="text-xs px-2 py-1 rounded border dark:border-[#444]" onClick={() => moveStage(idx, 1)}>
                        ↓
                      </button>
                      <button
                        type="button"
                        className="text-xs px-2 py-1 rounded text-red-600"
                        onClick={() => setStages(stages.filter((_, i) => i !== idx))}
                        disabled={stages.length <= 1}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button type="submit" className="px-4 py-2 rounded-xl bg-amber-600 text-white text-sm font-medium">
                Сохранить
              </button>
              {activeList.some((x) => x.id === editing.id) && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Убрать маршрут в архив?')) {
                      onDelete(editing.id);
                      setEditorOpen(false);
                      setEditing(null);
                    }
                  }}
                  className="px-4 py-2 rounded-xl border border-red-300 text-red-700 text-sm"
                >
                  В архив
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        <strong className="text-gray-900 dark:text-white">Производственный маршрут</strong> — этапы идут слева направо. Между этапами
        сотрудники фиксируют сдачу и приёмку (в т.ч. дефекты) на доске в модуле «Производство».
      </p>
      <div className="grid gap-2">
        {activeList.length === 0 && (
          <div className="text-sm text-gray-500 py-6 text-center border border-dashed border-gray-200 dark:border-[#444] rounded-xl">
            Нет маршрутов. Нажмите «+» в шапке настроек.
          </div>
        )}
        {activeList.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => openEdit(p)}
            className="flex items-center justify-between p-4 rounded-xl border border-gray-200 dark:border-[#333] bg-white dark:bg-[#252525] text-left hover:border-amber-400/50"
          >
            <div>
              <div className="font-medium text-gray-900 dark:text-white">{p.name}</div>
              <div className="text-xs text-gray-500">Этапов: {p.stages?.length ?? 0}</div>
            </div>
            <span className="text-xs text-amber-700 dark:text-amber-400">Изменить</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ProductionRoutesSettings;
