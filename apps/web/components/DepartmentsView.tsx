
import React, { useState, useMemo, useCallback } from 'react';
import { Department, User } from '../types';
import { X, Edit2, Trash2, Building, GitFork } from 'lucide-react';
import { TaskSelect } from './TaskSelect';
import { ModulePageShell, ModulePageHeader, MODULE_PAGE_GUTTER, ModuleCreateIconButton } from './ui';
import { getDefaultAvatarForId } from '../constants/avatars';

interface DepartmentsViewProps {
  departments: Department[];
  users: User[];
  onSave: (dep: Department) => void;
  onDelete: (id: string) => void;
}

function buildChildrenMap(deps: Department[]): Map<string | undefined, Department[]> {
  const ids = new Set(deps.map((d) => d.id));
  const m = new Map<string | undefined, Department[]>();
  for (const d of deps) {
    let p = d.parentId;
    if (p && !ids.has(p)) p = undefined;
    const arr = m.get(p) ?? [];
    arr.push(d);
    m.set(p, arr);
  }
  for (const arr of m.values()) {
    arr.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }
  return m;
}

/** Потомки по полю parentId (без нормализации «битого» родителя). */
function collectDescendantIds(rootId: string, deps: Department[]): Set<string> {
  const byParent = new Map<string | undefined, Department[]>();
  for (const d of deps) {
    const p = d.parentId;
    const arr = byParent.get(p) ?? [];
    arr.push(d);
    byParent.set(p, arr);
  }
  const out = new Set<string>();
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    const ch = byParent.get(id) ?? [];
    for (const c of ch) {
      if (!out.has(c.id)) {
        out.add(c.id);
        stack.push(c.id);
      }
    }
  }
  return out;
}

const DepartmentsView: React.FC<DepartmentsViewProps> = ({ departments, users, onSave, onDelete }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDep, setEditingDep] = useState<Department | null>(null);

  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [headId, setHeadId] = useState('');
  const [description, setDescription] = useState('');

  const active = useMemo(() => departments.filter((d) => !d.isArchived), [departments]);
  const childrenByParent = useMemo(() => buildChildrenMap(active), [active]);

  const parentOptions = useMemo(() => {
    if (!editingDep) return active;
    const blocked = new Set<string>([editingDep.id, ...collectDescendantIds(editingDep.id, active)]);
    return active.filter((d) => !blocked.has(d.id));
  }, [active, editingDep]);

  const handleOpenCreate = useCallback(() => {
    setEditingDep(null);
    setName('');
    setParentId('');
    setHeadId('');
    setDescription('');
    setIsModalOpen(true);
  }, []);

  const handleOpenEdit = (dep: Department) => {
    setEditingDep(dep);
    setName(dep.name);
    setParentId(dep.parentId || '');
    setHeadId(dep.headId || '');
    setDescription(dep.description || '');
    setIsModalOpen(true);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    onSave({
      id: editingDep ? editingDep.id : `dep-${Date.now()}`,
      name,
      parentId: parentId || undefined,
      headId: headId || undefined,
      description,
    });
    setIsModalOpen(false);
  };

  const handleDelete = () => {
    if (editingDep && confirm('Переместить подразделение в архив?')) {
      onDelete(editingDep.id);
      setIsModalOpen(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      if (window.confirm('Сохранить изменения?')) handleSubmit();
      else setIsModalOpen(false);
    }
  };

  const renderDepartmentCard = (dep: Department) => {
    const head = users.find((u) => u.id === dep.headId);
    const parent = dep.parentId ? active.find((d) => d.id === dep.parentId) : undefined;
    return (
      <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl p-5 shadow-sm hover:shadow-md transition-all group relative">
        <button
          type="button"
          onClick={() => handleOpenEdit(dep)}
          className="absolute top-4 right-4 text-gray-300 hover:text-orange-600 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Edit2 size={16} />
        </button>

        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded bg-gray-100 dark:bg-[#303030] flex items-center justify-center text-gray-500 dark:text-gray-400 shrink-0">
            <Building size={20} />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100 truncate">{dep.name}</h3>
            {parent && (
              <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
                Входит в: {parent.name}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3 bg-gray-50 dark:bg-[#303030] p-2 rounded-lg">
            {head ? (
              <>
                <img
                  src={head.avatar || getDefaultAvatarForId(head.id)}
                  className="w-8 h-8 rounded-full border border-gray-200 object-cover object-center"
                  alt=""
                />
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Руководитель</div>
                  <div className="text-sm font-medium text-gray-800 dark:text-gray-200">{head.name}</div>
                </div>
              </>
            ) : (
              <div className="text-sm text-gray-400 italic px-1">Руководитель не назначен</div>
            )}
          </div>
          {dep.description && (
            <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-3">{dep.description}</p>
          )}
        </div>
      </div>
    );
  };

  const renderTree = (parentKey: string | undefined, depth: number): React.ReactNode => {
    const list = childrenByParent.get(parentKey) ?? [];
    if (list.length === 0) return null;
    return (
      <ul
        className={
          depth > 0
            ? 'mt-2 ml-1 sm:ml-3 pl-3 sm:pl-4 border-l border-gray-200 dark:border-gray-600 space-y-3'
            : 'space-y-3'
        }
      >
        {list.map((dep) => (
          <li key={dep.id}>
            {renderDepartmentCard(dep)}
            {renderTree(dep.id, depth + 1)}
          </li>
        ))}
      </ul>
    );
  };

  const roots = childrenByParent.get(undefined) ?? [];

  return (
    <ModulePageShell>
      <div className={`${MODULE_PAGE_GUTTER} pt-8 pb-4 flex-shrink-0`}>
        <ModulePageHeader
          icon={<GitFork size={24} strokeWidth={2} />}
          title="Подразделения"
          description="Иерархия подразделений: корневые отделы и дочерние (родитель задаётся в карточке)"
          accent="orange"
          actions={
            <ModuleCreateIconButton accent="orange" label="Создать подразделение" onClick={handleOpenCreate} />
          }
        />
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
        <div className={`${MODULE_PAGE_GUTTER} pb-20`}>
          {roots.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">
              Нет подразделений. Создайте корневой отдел или снимите фильтр архива.
            </p>
          ) : (
            renderTree(undefined, 0)
          )}
        </div>
      </div>

      {isModalOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[80] animate-in fade-in duration-200"
          onClick={handleBackdropClick}
        >
          <div
            className="bg-white dark:bg-[#252525] rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-[#333]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-100 dark:border-[#333] flex justify-between items-center bg-white dark:bg-[#252525]">
              <h3 className="font-bold text-gray-800 dark:text-white">
                {editingDep ? 'Редактировать' : 'Новое подразделение'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#303030]"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Название</label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500"
                  placeholder="Например: Маркетинг"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">
                  Родительское подразделение
                </label>
                <TaskSelect
                  value={parentId}
                  onChange={setParentId}
                  options={[
                    { value: '', label: 'Корень (верхний уровень)' },
                    ...parentOptions.map((d) => ({ value: d.id, label: d.name })),
                  ]}
                />
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                  Дочерние отделы отображаются вложенным списком под родителем.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Руководитель</label>
                <TaskSelect
                  value={headId}
                  onChange={setHeadId}
                  options={[{ value: '', label: 'Не назначен' }, ...users.map((u) => ({ value: u.id, label: u.name }))]}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Описание</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full h-24 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 resize-none"
                />
              </div>

              <div className="flex justify-between items-center pt-2">
                {editingDep && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="text-red-500 text-sm hover:underline hover:text-red-600 flex items-center gap-1"
                  >
                    <Trash2 size={14} /> В архив
                  </button>
                )}
                <div className="flex gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#303030] rounded-lg"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium bg-orange-600 text-white hover:bg-orange-700 rounded-lg shadow-sm"
                  >
                    Сохранить
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </ModulePageShell>
  );
};

export default DepartmentsView;
