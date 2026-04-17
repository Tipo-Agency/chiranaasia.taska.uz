import React, { useMemo, useState } from 'react';
import { Warehouse, Department } from '../../types';
import { Plus, Trash2, Save } from 'lucide-react';
import { EntitySearchSelect } from '../ui/EntitySearchSelect';

interface WarehouseSettingsProps {
  warehouses: Warehouse[];
  departments: Department[];
  onSave: (warehouse: Warehouse) => void;
  onDelete: (id: string) => void;
}

export const WarehouseSettings: React.FC<WarehouseSettingsProps> = ({
  warehouses,
  departments,
  onSave,
  onDelete,
}) => {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [departmentId, setDepartmentId] = useState('');

  const activeWarehouses = useMemo(
    () => warehouses.filter((w) => !w.isArchived),
    [warehouses]
  );

  const defaultWarehouseId = useMemo(() => {
    const d = activeWarehouses.find((w) => w.isDefault);
    return d?.id || '';
  }, [activeWarehouses]);

  const setDefaultWarehouse = (warehouseId: string) => {
    const target = activeWarehouses.find((w) => w.id === warehouseId);
    if (!target) return;
    // Ensure only one default warehouse.
    activeWarehouses.forEach((w) => {
      const next = w.id === warehouseId ? { ...w, isDefault: true } : { ...w, isDefault: false };
      onSave(next);
    });
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      id: `wh-${Date.now()}`,
      name: name.trim(),
      location: location.trim() || undefined,
      departmentId: departmentId || undefined,
      isDefault: activeWarehouses.length === 0,
    });
    setName('');
    setLocation('');
    setDepartmentId('');
  };

  return (
    <div className="space-y-5">
      <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl p-5">
        <h3 className="font-bold text-gray-800 dark:text-white mb-3">Основной склад</h3>
        {activeWarehouses.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Сначала создайте склад ниже.</p>
        ) : (
          <div className="max-w-md">
            <EntitySearchSelect
              value={defaultWarehouseId}
              onChange={(v) => setDefaultWarehouse(v)}
              options={activeWarehouses.map((w) => ({
                value: w.id,
                label: w.name,
                searchText: `${w.name} ${w.location || ''}`,
              }))}
              searchPlaceholder="Склад…"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Основной склад используется как выбор по умолчанию в модуле «Склад».
            </p>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl p-5">
        <h3 className="font-bold text-gray-800 dark:text-white mb-3">Склады</h3>
        <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Название склада"
            className="md:col-span-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100"
            required
          />
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Локация"
            className="md:col-span-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100"
          />
          <div className="md:col-span-1">
            <EntitySearchSelect
              value={departmentId}
              onChange={setDepartmentId}
              options={[
                { value: '', label: 'Без подразделения' },
                ...departments.filter((d) => !d.isArchived).map((d) => ({ value: d.id, label: d.name, searchText: d.name })),
              ]}
              searchPlaceholder="Подразделение…"
            />
          </div>
          <button
            type="submit"
            className="md:col-span-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#3337AD] text-white text-sm font-semibold"
          >
            <Plus size={14} />
            Добавить склад
          </button>
        </form>
      </div>

      <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl overflow-hidden">
        {activeWarehouses.length === 0 ? (
          <p className="p-5 text-sm text-gray-500 dark:text-gray-400">Склады еще не созданы.</p>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-[#333]">
            {activeWarehouses.map((w) => {
              const dep = departments.find((d) => d.id === w.departmentId);
              return (
                <div key={w.id} className="p-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-white">{w.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {[w.location || 'Локация не указана', dep?.name || 'Без подразделения'].join(' • ')}
                    </div>
                    {w.isDefault && (
                      <div className="mt-1 inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-200">
                        Основной
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDefaultWarehouse(w.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-[#444] text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#303030]"
                    >
                      <Save size={12} />
                      По умолчанию
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(w.id)}
                      className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                      title="Удалить склад"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
