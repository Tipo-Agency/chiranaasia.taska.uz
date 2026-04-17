import React, { useMemo, useState } from 'react';
import { Project, Department, Warehouse, User } from '../../types';
import { ICON_OPTIONS, MODULE_ICON_HEX_COLORS, LEGACY_PROJECT_COLOR_TO_HEX, swatchHexForTableColorToken } from '../../constants';
import { DynamicIcon } from '../AppIcons';
import { normalizeHex6 } from '../../utils/moduleProjectColor';
import { Button, Input, StandardModal } from '../ui';
import { Edit2, Trash2 } from 'lucide-react';
import { EntitySearchSelect } from '../ui/EntitySearchSelect';

type CreateKind = 'project' | 'department' | 'warehouse';

export const StructureSettings: React.FC<{
  projects: Project[];
  departments: Department[];
  warehouses: Warehouse[];
  users: User[];
  onUpdateProjects: (projects: Project[]) => void;
  onSaveDepartment: (dep: Department) => void;
  onDeleteDepartment: (id: string) => void;
  onSaveWarehouse: (wh: Warehouse) => void;
  onDeleteWarehouse: (id: string) => void;
  /** external header "+" triggers this */
  createKind?: CreateKind | null;
  onConsumedCreateKind?: () => void;
}> = ({
  projects,
  departments,
  warehouses,
  users,
  onUpdateProjects,
  onSaveDepartment,
  onDeleteDepartment,
  onSaveWarehouse,
  onDeleteWarehouse,
  createKind,
  onConsumedCreateKind,
}) => {
  const activeProjects = useMemo(() => projects.filter((p) => !p.isArchived), [projects]);
  const activeDepartments = useMemo(() => departments.filter((d) => !d.isArchived), [departments]);
  const activeWarehouses = useMemo(() => warehouses.filter((w) => !w.isArchived), [warehouses]);

  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');
  const [projectIcon, setProjectIcon] = useState('Briefcase');
  const [projectColor, setProjectColor] = useState<string>(MODULE_ICON_HEX_COLORS[0] || '#6366f1');
  const [projectCustomColor, setProjectCustomColor] = useState('#6366f1');

  const [departmentModalOpen, setDepartmentModalOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [departmentName, setDepartmentName] = useState('');
  const [departmentHeadId, setDepartmentHeadId] = useState('');
  const [departmentDescription, setDepartmentDescription] = useState('');

  const [warehouseModalOpen, setWarehouseModalOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [warehouseName, setWarehouseName] = useState('');
  const [warehouseLocation, setWarehouseLocation] = useState('');
  const [warehouseDepartmentId, setWarehouseDepartmentId] = useState('');

  const openCreate = (kind: CreateKind) => {
    if (kind === 'project') {
      setEditingProjectId(null);
      setProjectName('');
      setProjectIcon('Briefcase');
      const d = MODULE_ICON_HEX_COLORS[0] || '#6366f1';
      setProjectColor(d);
      setProjectCustomColor(d);
      setProjectModalOpen(true);
    }
    if (kind === 'department') {
      setEditingDepartment(null);
      setDepartmentName('');
      setDepartmentHeadId('');
      setDepartmentDescription('');
      setDepartmentModalOpen(true);
    }
    if (kind === 'warehouse') {
      setEditingWarehouse(null);
      setWarehouseName('');
      setWarehouseLocation('');
      setWarehouseDepartmentId('');
      setWarehouseModalOpen(true);
    }
  };

  // external "+" triggers
  React.useEffect(() => {
    if (!createKind) return;
    openCreate(createKind);
    onConsumedCreateKind?.();
  }, [createKind]);

  const saveProject = () => {
    const name = projectName.trim();
    if (!name) return;
    const color = projectColor === '__custom__' ? projectCustomColor : projectColor;
    const now = new Date().toISOString();
    if (editingProjectId) {
      onUpdateProjects(
        projects.map((p) =>
          p.id === editingProjectId ? { ...p, name, icon: projectIcon, color, updatedAt: now } : p
        )
      );
    } else {
      onUpdateProjects([...projects, { id: `p-${Date.now()}`, name, icon: projectIcon, color, updatedAt: now }]);
    }
    setProjectModalOpen(false);
  };

  const editProject = (p: Project) => {
    setEditingProjectId(p.id);
    setProjectName(p.name || '');
    setProjectIcon(p.icon || 'Briefcase');
    const raw = p.color || '';
    if (raw.startsWith('#')) {
      const normalized = normalizeHex6(raw) ?? raw.toLowerCase();
      setProjectColor(MODULE_ICON_HEX_COLORS.includes(normalized) ? normalized : '__custom__');
      setProjectCustomColor(normalized);
    } else if (raw && LEGACY_PROJECT_COLOR_TO_HEX[raw]) {
      const hex = LEGACY_PROJECT_COLOR_TO_HEX[raw];
      setProjectColor(MODULE_ICON_HEX_COLORS.includes(hex) ? hex : '__custom__');
      setProjectCustomColor(hex);
    } else if (raw) {
      const hex = swatchHexForTableColorToken(raw);
      setProjectColor(MODULE_ICON_HEX_COLORS.includes(hex) ? hex : '__custom__');
      setProjectCustomColor(hex);
    } else {
      const d = MODULE_ICON_HEX_COLORS[0] || '#6366f1';
      setProjectColor(d);
      setProjectCustomColor(d);
    }
    setProjectModalOpen(true);
  };

  const archiveProject = (id: string) => {
    const now = new Date().toISOString();
    onUpdateProjects(projects.map((p) => (p.id === id ? { ...p, isArchived: true, updatedAt: now } : p)));
  };

  const saveDepartment = () => {
    const name = departmentName.trim();
    if (!name) return;
    const now = new Date().toISOString();
    onSaveDepartment({
      id: editingDepartment ? editingDepartment.id : `dep-${Date.now()}`,
      name,
      headId: departmentHeadId || undefined,
      description: departmentDescription || undefined,
      updatedAt: now,
      isArchived: editingDepartment?.isArchived || false,
    });
    setDepartmentModalOpen(false);
  };

  const editDepartment = (d: Department) => {
    setEditingDepartment(d);
    setDepartmentName(d.name || '');
    setDepartmentHeadId(d.headId || '');
    setDepartmentDescription(d.description || '');
    setDepartmentModalOpen(true);
  };

  const saveWarehouse = () => {
    const name = warehouseName.trim();
    if (!name) return;
    const isDefault = !editingWarehouse && activeWarehouses.length === 0;
    onSaveWarehouse({
      id: editingWarehouse ? editingWarehouse.id : `wh-${Date.now()}`,
      name,
      location: warehouseLocation.trim() || undefined,
      departmentId: warehouseDepartmentId || undefined,
      isDefault: editingWarehouse?.isDefault || isDefault,
      isArchived: editingWarehouse?.isArchived || false,
    });
    setWarehouseModalOpen(false);
  };

  const editWarehouse = (w: Warehouse) => {
    setEditingWarehouse(w);
    setWarehouseName(w.name || '');
    setWarehouseLocation(w.location || '');
    setWarehouseDepartmentId(w.departmentId || '');
    setWarehouseModalOpen(true);
  };

  return (
    <div className="space-y-8 w-full">
      <div>
        <div className="mb-3">
          <div className="text-sm font-bold text-gray-900 dark:text-white">Проекты / модули</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Иконка + цвет отображаются в меню и карточках. Создание — через «+» в шапке.</div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {activeProjects.map((p) => (
            <div
              key={p.id}
              className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-2xl p-4 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-[#202020] border border-gray-200 dark:border-[#333] flex items-center justify-center">
                  <DynamicIcon name={p.icon || 'Briefcase'} className={p.color || 'text-indigo-500'} size={18} />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-gray-900 dark:text-white truncate">{p.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{p.id}</div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => editProject(p)}
                  className="p-2 rounded-xl text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-50 dark:hover:bg-[#303030]"
                  title="Редактировать"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => archiveProject(p.id)}
                  className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                  title="В архив"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-3">
          <div className="text-sm font-bold text-gray-900 dark:text-white">Подразделения</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Используется в складе и кадровых настройках. Создание — через «+» в шапке.</div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {activeDepartments.map((d) => {
            const head = users.find((u) => u.id === d.headId);
            return (
              <div
                key={d.id}
                className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-2xl p-4 flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-gray-900 dark:text-white truncate">{d.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                    {head ? `Руководитель: ${head.name}` : 'Руководитель не назначен'}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => editDepartment(d)}
                    className="p-2 rounded-xl text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-50 dark:hover:bg-[#303030]"
                    title="Редактировать"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteDepartment(d.id)}
                    className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                    title="Удалить"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <div className="mb-3">
          <div className="text-sm font-bold text-gray-900 dark:text-white">Склады</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Для учёта остатков и операций. Создание — через «+» в шапке.</div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {activeWarehouses.map((w) => {
            const dep = departments.find((d) => d.id === w.departmentId);
            return (
              <div
                key={w.id}
                className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-2xl p-4 flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-gray-900 dark:text-white truncate">{w.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                    {[w.location || 'Локация не указана', dep?.name || 'Без подразделения'].join(' • ')}
                  </div>
                  {w.isDefault && (
                    <div className="mt-1 inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-200">
                      Основной
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => editWarehouse(w)}
                    className="p-2 rounded-xl text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-50 dark:hover:bg-[#303030]"
                    title="Редактировать"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteWarehouse(w.id)}
                    className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                    title="Удалить"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <StandardModal
        isOpen={projectModalOpen}
        onClose={() => setProjectModalOpen(false)}
        title={editingProjectId ? 'Редактировать модуль' : 'Новый модуль'}
        size="lg"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setProjectModalOpen(false)}>
              Отмена
            </Button>
            <Button onClick={saveProject} disabled={!projectName.trim()}>
              Сохранить
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          <Input label="Название" value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="Например: Маркетинг" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase">Иконка</div>
              <div className="grid grid-cols-10 gap-2 bg-white dark:bg-[#252525] p-2 rounded-xl border border-gray-200 dark:border-[#333] max-h-56 overflow-y-auto custom-scrollbar">
                {ICON_OPTIONS.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => setProjectIcon(icon)}
                    className={`p-2 rounded-xl flex items-center justify-center border ${
                      projectIcon === icon ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30' : 'border-transparent hover:bg-gray-50 dark:hover:bg-[#303030]'
                    }`}
                    title={icon}
                  >
                    <DynamicIcon name={icon} className="text-gray-600 dark:text-gray-300" size={16} />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase">Цвет</div>
              <div className="flex flex-wrap gap-2">
                {MODULE_ICON_HEX_COLORS.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => setProjectColor(hex)}
                    className={`w-9 h-9 rounded-full border-2 flex items-center justify-center ${
                      projectColor === hex ? 'border-gray-900 dark:border-white' : 'border-transparent hover:border-gray-300 dark:hover:border-[#555]'
                    }`}
                    title={hex}
                  >
                    <div
                      className="w-7 h-7 rounded-full border border-black/10 dark:border-white/15 shadow-inner"
                      style={{ backgroundColor: hex }}
                    />
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setProjectColor('__custom__')}
                  className={`w-9 h-9 rounded-full border-2 flex items-center justify-center ${
                    projectColor === '__custom__' ? 'border-gray-900 dark:border-white' : 'border-transparent hover:border-gray-300 dark:hover:border-[#555]'
                  }`}
                  title="Кастомный"
                >
                  <div className="w-7 h-7 rounded-full bg-white dark:bg-[#1f1f1f] border border-black/5 dark:border-white/10 flex items-center justify-center">
                    <div className="w-6 h-6 rounded-full" style={{ backgroundColor: projectCustomColor }} />
                  </div>
                </button>
              </div>

              {projectColor === '__custom__' && (
                <div className="mt-3 flex items-center gap-3">
                  <input
                    type="color"
                    value={projectCustomColor}
                    onChange={(e) => setProjectCustomColor(e.target.value)}
                    className="w-12 h-10 p-0 border border-gray-200 dark:border-[#333] rounded-lg bg-transparent"
                  />
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Выбран цвет: <span className="font-mono">{projectCustomColor}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-[#333] bg-gray-50 dark:bg-[#202020]">
            <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] flex items-center justify-center">
              <DynamicIcon
                name={projectIcon}
                className={
                  projectColor === '__custom__'
                    ? projectCustomColor
                    : projectColor.startsWith('#')
                      ? projectColor
                      : swatchHexForTableColorToken(projectColor)
                }
                size={18}
              />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">{projectName || 'Превью модуля'}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Так будет выглядеть в меню</div>
            </div>
          </div>
        </div>
      </StandardModal>

      <StandardModal
        isOpen={departmentModalOpen}
        onClose={() => setDepartmentModalOpen(false)}
        title={editingDepartment ? 'Редактировать подразделение' : 'Новое подразделение'}
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setDepartmentModalOpen(false)}>
              Отмена
            </Button>
            <Button onClick={saveDepartment} disabled={!departmentName.trim()}>
              Сохранить
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Input label="Название" value={departmentName} onChange={(e) => setDepartmentName(e.target.value)} placeholder="Например: Продажи" />
          <div>
            <div className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">Руководитель</div>
            <EntitySearchSelect
              value={departmentHeadId}
              onChange={setDepartmentHeadId}
              options={[
                { value: '', label: 'Не назначен' },
                ...users.map((u) => ({ value: u.id, label: u.name, searchText: u.name })),
              ]}
              searchPlaceholder="Сотрудник…"
            />
          </div>
          <div>
            <div className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">Описание</div>
            <textarea
              value={departmentDescription}
              onChange={(e) => setDepartmentDescription(e.target.value)}
              className="w-full h-24 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-[#252525] text-gray-900 dark:text-gray-100"
            />
          </div>
        </div>
      </StandardModal>

      <StandardModal
        isOpen={warehouseModalOpen}
        onClose={() => setWarehouseModalOpen(false)}
        title={editingWarehouse ? 'Редактировать склад' : 'Новый склад'}
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setWarehouseModalOpen(false)}>
              Отмена
            </Button>
            <Button onClick={saveWarehouse} disabled={!warehouseName.trim()}>
              Сохранить
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Input label="Название" value={warehouseName} onChange={(e) => setWarehouseName(e.target.value)} placeholder="Например: Основной склад" />
          <Input label="Локация" value={warehouseLocation} onChange={(e) => setWarehouseLocation(e.target.value)} placeholder="Адрес / город" />
          <div>
            <div className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">Подразделение</div>
            <EntitySearchSelect
              value={warehouseDepartmentId}
              onChange={setWarehouseDepartmentId}
              options={[
                { value: '', label: 'Без подразделения' },
                ...activeDepartments.map((d) => ({ value: d.id, label: d.name, searchText: d.name })),
              ]}
              searchPlaceholder="Подразделение…"
            />
          </div>
        </div>
      </StandardModal>
    </div>
  );
};

