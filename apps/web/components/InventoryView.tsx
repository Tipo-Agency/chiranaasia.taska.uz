import React, { useMemo, useState } from 'react';
import { Department, Warehouse, InventoryItem, StockBalance, StockMovement, InventoryRevision } from '../types';
import {
  Layers,
  Package,
  ArrowLeftRight,
  ClipboardCheck,
  BarChart3,
} from 'lucide-react';
import { Button } from './ui/Button';
import { ModuleCreateDropdown, ModulePageShell, ModulePageHeader, ModuleSegmentedControl, MODULE_PAGE_GUTTER, ModuleCreateIconButton } from './ui';

interface InventoryViewProps {
  departments: Department[];
  warehouses: Warehouse[];
  items: InventoryItem[];
  balances: StockBalance[];
  movements: StockMovement[];
  revisions: InventoryRevision[];
  currentUserId: string;
  onSaveWarehouse: (w: Warehouse) => void;
  onDeleteWarehouse: (id: string) => void;
  onSaveItem: (item: InventoryItem) => void;
  onDeleteItem: (id: string) => void;
  onCreateMovement: (payload: {
    type: 'receipt' | 'transfer' | 'writeoff' | 'adjustment';
    fromWarehouseId?: string;
    toWarehouseId?: string;
    items: { itemId: string; quantity: number; price?: number }[];
    reason?: string;
    createdByUserId: string;
  }) => void;
  onCreateRevision?: (payload: { warehouseId: string; date: string; createdByUserId: string; reason?: string }) => InventoryRevision;
  onUpdateRevision?: (r: InventoryRevision) => void;
  onPostRevision?: (revisionId: string, createdByUserId: string) => void;
}

const InventoryView: React.FC<InventoryViewProps> = ({
  departments,
  warehouses,
  items,
  balances,
  movements,
  revisions,
  currentUserId,
  onSaveWarehouse,
  onDeleteWarehouse,
  onSaveItem,
  onDeleteItem,
  onCreateMovement,
  onCreateRevision,
  onUpdateRevision,
  onPostRevision,
}) => {
  const [activeTab, setActiveTab] = useState<'balances' | 'items' | 'movements' | 'revisions'>('balances');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');

  // Form state: new warehouse
  const [newWarehouseName, setNewWarehouseName] = useState('');

  // Form state: new item
  const [newItemSku, setNewItemSku] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newItemUnit, setNewItemUnit] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('');
  const [newItemNotes, setNewItemNotes] = useState('');

  // Form state: movement
  const [movementType, setMovementType] = useState<'receipt' | 'transfer' | 'writeoff' | 'adjustment'>('receipt');
  const [fromWarehouseId, setFromWarehouseId] = useState<string>('');
  const [toWarehouseId, setToWarehouseId] = useState<string>('');
  const [movementItemId, setMovementItemId] = useState<string>('');
  const [movementQty, setMovementQty] = useState<string>('');
  const [movementReason, setMovementReason] = useState<string>('');

  // Revision: selected for edit
  const [editingRevisionId, setEditingRevisionId] = useState<string | null>(null);

  const currentDepartment = departments.find(d => d.id === selectedDepartmentId) || null;

  const filteredWarehouses = useMemo(
    () => warehouses.filter(w => !w.isArchived && (selectedDepartmentId ? w.departmentId === selectedDepartmentId : true)),
    [warehouses, selectedDepartmentId]
  );

  const balancesForView = useMemo(() => {
    const whId = selectedWarehouseId || filteredWarehouses[0]?.id;
    if (!whId) return [];
    return balances
      .filter(b => b.warehouseId === whId)
      .map(b => {
        const item = items.find(i => i.id === b.itemId);
        return {
          ...b,
          itemName: item?.name || 'Без названия',
          itemSku: item?.sku || '',
          itemUnit: item?.unit || '',
        };
      })
      .sort((a, b) => a.itemName.localeCompare(b.itemName));
  }, [balances, items, filteredWarehouses, selectedWarehouseId]);

  const handleCreateWarehouse = () => {
    if (!newWarehouseName.trim()) {
      alert('Введите название склада');
      return;
    }
    if (!onSaveWarehouse) {
      console.error('onSaveWarehouse не определена');
      return;
    }
    const wh: Warehouse = {
      id: `wh-${Date.now()}`,
      name: newWarehouseName.trim(),
      departmentId: selectedDepartmentId || undefined,
    };
    onSaveWarehouse(wh);
    setNewWarehouseName('');
  };

  const handleCreateItem = () => {
    if (!newItemName.trim()) {
      alert('Введите название номенклатуры');
      return;
    }
    if (!onSaveItem) {
      console.error('onSaveItem не определена');
      return;
    }
    const item: InventoryItem = {
      id: `it-${Date.now()}`,
      sku: newItemSku.trim(),
      name: newItemName.trim(),
      unit: newItemUnit.trim() || 'шт',
      category: newItemCategory.trim() || undefined,
      notes: newItemNotes.trim() || undefined,
    };
    onSaveItem(item);
    setNewItemSku('');
    setNewItemName('');
    setNewItemUnit('');
    setNewItemCategory('');
    setNewItemNotes('');
  };

  const handleCreateMovement = () => {
    const qty = Number(movementQty.replace(',', '.'));
    if (!movementItemId || (movementType !== 'adjustment' && (!qty || qty <= 0))) {
      alert('Заполните номенклатуру и количество');
      return;
    }
    if (movementType === 'adjustment' && qty === 0) {
      alert('Для корректировки укажите ненулевое количество (положительное или отрицательное)');
      return;
    }
    if (movementType !== 'receipt' && movementType !== 'adjustment' && !fromWarehouseId) {
      alert('Выберите склад-источник');
      return;
    }
    if (movementType !== 'writeoff' && !toWarehouseId) {
      alert('Выберите склад назначения');
      return;
    }
    if (!onCreateMovement || !currentUserId) return;

    onCreateMovement({
      type: movementType,
      fromWarehouseId: (movementType === 'transfer' || movementType === 'writeoff') ? fromWarehouseId || undefined : undefined,
      toWarehouseId: (movementType === 'receipt' || movementType === 'transfer' || movementType === 'adjustment') ? toWarehouseId || undefined : undefined,
      items: [{ itemId: movementItemId, quantity: qty }],
      reason: movementReason || undefined,
      createdByUserId: currentUserId,
    });
    setMovementQty('');
    setMovementReason('');
    setMovementItemId('');
    setFromWarehouseId('');
    setToWarehouseId('');
  };

  return (
    <ModulePageShell>
      <div className={`${MODULE_PAGE_GUTTER} pt-6 md:pt-8 flex-shrink-0`}>
        <div className="mb-5 space-y-5">
          <ModulePageHeader
            accent="emerald"
            icon={<Layers size={24} strokeWidth={2} />}
            title="Склад"
            description="Остатки, номенклатура, движения и инвентаризация"
            actions={
              <ModuleCreateDropdown
                accent="emerald"
                items={[
                  {
                    id: 'nom',
                    label: 'Новая номенклатура',
                    icon: Package,
                    onClick: () => setActiveTab('items'),
                    iconClassName: 'text-emerald-600 dark:text-emerald-400',
                  },
                  {
                    id: 'mov',
                    label: 'Складская операция',
                    icon: ArrowLeftRight,
                    onClick: () => setActiveTab('movements'),
                    iconClassName: 'text-emerald-600 dark:text-emerald-400',
                  },
                  {
                    id: 'rev',
                    label: 'Ревизия',
                    icon: ClipboardCheck,
                    onClick: () => setActiveTab('revisions'),
                    iconClassName: 'text-emerald-600 dark:text-emerald-400',
                  },
                ]}
              />
            }
          />
          <ModuleSegmentedControl
            variant="accent"
            accent="emerald"
            value={activeTab}
            onChange={(v) => setActiveTab(v as typeof activeTab)}
            options={[
              { value: 'balances', label: 'Остатки', icon: <BarChart3 size={16} strokeWidth={2} /> },
              { value: 'items', label: 'Номенклатура', icon: <Package size={16} strokeWidth={2} /> },
              { value: 'movements', label: 'Журнал', icon: <ArrowLeftRight size={16} strokeWidth={2} /> },
              { value: 'revisions', label: 'Ревизии', icon: <ClipboardCheck size={16} strokeWidth={2} /> },
            ]}
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
        <div className={`${MODULE_PAGE_GUTTER} pb-20`}>

          <div className="rounded-2xl border border-gray-200 dark:border-[#333] bg-white dark:bg-[#191919] p-4 sm:p-5 mb-4 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2">Контекст</p>
            <div className="flex flex-col sm:flex-row sm:items-end gap-4">
              <label className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Подразделение</span>
                <select
                  value={selectedDepartmentId}
                  onChange={e => setSelectedDepartmentId(e.target.value)}
                  className="rounded-xl border border-gray-200 dark:border-[#333] bg-gray-50 dark:bg-[#252525] px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-emerald-500/30 outline-none"
                >
                  <option value="">Все подразделения</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="flex-1 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#333] rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-0">
        {activeTab === 'balances' && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="border-b border-gray-100 dark:border-[#2a2a2a] px-4 sm:px-5 py-4 flex flex-col lg:flex-row lg:items-end gap-4 shrink-0 bg-emerald-50/40 dark:bg-emerald-950/15">
              <label className="flex flex-col gap-1.5 min-w-[200px]">
                <span className="text-[11px] font-bold uppercase tracking-wide text-emerald-800/80 dark:text-emerald-300/90">Склад</span>
                <select
                  value={selectedWarehouseId}
                  onChange={e => setSelectedWarehouseId(e.target.value)}
                  className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 px-3 py-2.5 text-sm bg-white dark:bg-[#252525] text-gray-900 dark:text-gray-100 min-w-[220px] focus:ring-2 focus:ring-emerald-500/30 outline-none"
                >
                  <option value="">Выберите склад</option>
                  {filteredWarehouses.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex flex-col sm:flex-row flex-1 gap-2 lg:justify-end lg:ml-auto">
                <input
                  value={newWarehouseName}
                  onChange={e => setNewWarehouseName(e.target.value)}
                  placeholder={currentDepartment ? `Название склада (${currentDepartment.name})` : 'Название нового склада'}
                  className="rounded-xl border border-gray-200 dark:border-[#333] px-3 py-2.5 text-sm bg-white dark:bg-[#252525] text-gray-800 dark:text-gray-100 flex-1 min-w-[180px] focus:ring-2 focus:ring-emerald-500/25 outline-none"
                />
                <ModuleCreateIconButton accent="emerald" label="Добавить склад" onClick={handleCreateWarehouse} className="shrink-0" />
              </div>
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar min-h-0">
              {balancesForView.length === 0 ? (
                <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-center px-6 py-12">
                  <Package className="text-gray-300 dark:text-gray-600 mb-3" size={40} strokeWidth={1.25} />
                  <p className="text-gray-700 dark:text-gray-300 font-medium">Нет остатков для выбранного склада</p>
                  <p className="text-sm text-gray-500 dark:text-gray-500 mt-1 max-w-md">Создайте склад выше, заведите номенклатуру и проведите оприходование на вкладке «Журнал».</p>
                </div>
              ) : (
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="bg-gray-50 dark:bg-[#252525] border-b border-gray-200 dark:border-[#333] sticky top-0 z-[1]">
                    <tr className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
                      <th className="px-4 py-3 font-semibold w-36">Код</th>
                      <th className="px-4 py-3 font-semibold">Номенклатура</th>
                      <th className="px-4 py-3 font-semibold w-24">Ед.</th>
                      <th className="px-4 py-3 font-semibold w-32 text-right">Остаток</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-[#2a2a2a]">
                    {balancesForView.map(b => (
                      <tr key={`${b.warehouseId}_${b.itemId}`} className="hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-colors">
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 font-mono text-xs">{b.itemSku || '—'}</td>
                        <td className="px-4 py-3 text-gray-900 dark:text-gray-100 font-medium">{b.itemName}</td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{b.itemUnit}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold text-emerald-800 dark:text-emerald-200">{b.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {activeTab === 'items' && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="border-b border-gray-100 dark:border-[#2a2a2a] px-4 sm:px-5 py-4 flex flex-col gap-3 shrink-0 bg-slate-50/80 dark:bg-[#141414]">
              <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Новая позиция справочника</span>
              <div className="flex flex-wrap items-end gap-2">
              <input
                value={newItemSku}
                onChange={e => setNewItemSku(e.target.value)}
                placeholder="Код"
                className="border border-gray-200 dark:border-[#333] rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-[#252525] text-gray-800 dark:text-gray-100 w-24"
              />
              <input
                value={newItemName}
                onChange={e => setNewItemName(e.target.value)}
                placeholder="Название"
                className="border border-gray-200 dark:border-[#333] rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-[#252525] text-gray-800 dark:text-gray-100 flex-1"
              />
              <input
                value={newItemUnit}
                onChange={e => setNewItemUnit(e.target.value)}
                placeholder="Ед. изм."
                className="border border-gray-200 dark:border-[#333] rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-[#252525] text-gray-800 dark:text-gray-100 w-24"
              />
              <input
                value={newItemCategory}
                onChange={e => setNewItemCategory(e.target.value)}
                placeholder="Категория"
                className="border border-gray-200 dark:border-[#333] rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-[#252525] text-gray-800 dark:text-gray-100 w-32"
              />
              <input
                value={newItemNotes}
                onChange={e => setNewItemNotes(e.target.value)}
                placeholder="Комментарий"
                className="border border-gray-200 dark:border-[#333] rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-[#252525] text-gray-800 dark:text-gray-100 flex-1"
              />
              <ModuleCreateIconButton accent="emerald" label="Добавить номенклатуру" onClick={handleCreateItem} />
              </div>
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar min-h-0">
              {items.length === 0 ? (
                <div className="h-full min-h-[180px] flex flex-col items-center justify-center text-center px-6 py-10">
                  <Package className="text-gray-300 dark:text-gray-600 mb-3" size={36} strokeWidth={1.25} />
                  <p className="text-gray-700 dark:text-gray-300 font-medium">Справочник пуст</p>
                  <p className="text-sm text-gray-500 mt-1">Заполните поля выше и нажмите «Добавить».</p>
                </div>
              ) : (
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="bg-gray-50 dark:bg-[#252525] border-b border-gray-200 dark:border-[#333] sticky top-0">
                    <tr className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
                      <th className="px-4 py-3 font-semibold w-32">Код</th>
                      <th className="px-4 py-3 font-semibold">Название</th>
                      <th className="px-4 py-3 font-semibold w-24">Ед. изм.</th>
                      <th className="px-4 py-3 font-semibold w-36">Категория</th>
                      <th className="px-4 py-3 font-semibold">Комментарий</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-[#2a2a2a]">
                    {items.filter(item => !item.isArchived).map(item => (
                      <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-[#222] transition-colors">
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 font-mono text-xs">{item.sku}</td>
                        <td className="px-4 py-3 text-gray-900 dark:text-gray-100 font-medium">{item.name}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{item.unit}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{item.category || '—'}</td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-500 text-xs">{item.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {activeTab === 'movements' && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="border-b border-gray-100 dark:border-[#2a2a2a] px-4 sm:px-5 py-4 shrink-0 bg-slate-50/80 dark:bg-[#141414] space-y-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Новая операция</span>
                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs text-gray-600 dark:text-gray-400">Тип</span>
                    <select
                      value={movementType}
                      onChange={e => setMovementType(e.target.value as 'receipt' | 'transfer' | 'writeoff' | 'adjustment')}
                      className="rounded-xl border border-gray-200 dark:border-[#333] px-3 py-2 text-sm bg-white dark:bg-[#252525] text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-emerald-500/25 outline-none"
                    >
                      <option value="receipt">Оприходование</option>
                      <option value="transfer">Перемещение</option>
                      <option value="writeoff">Списание</option>
                      <option value="adjustment">Корректировка</option>
                    </select>
                  </label>
                  {movementType !== 'receipt' && movementType !== 'adjustment' && (
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs text-gray-600 dark:text-gray-400">Со склада</span>
                      <select
                        value={fromWarehouseId}
                        onChange={e => setFromWarehouseId(e.target.value)}
                        className="rounded-xl border border-gray-200 dark:border-[#333] px-3 py-2 text-sm bg-white dark:bg-[#252525] text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-emerald-500/25 outline-none"
                      >
                        <option value="">Выберите</option>
                        {warehouses.filter(w => !w.isArchived).map(w => (
                          <option key={w.id} value={w.id}>
                            {w.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {movementType !== 'writeoff' && (
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs text-gray-600 dark:text-gray-400">На склад</span>
                      <select
                        value={toWarehouseId}
                        onChange={e => setToWarehouseId(e.target.value)}
                        className="rounded-xl border border-gray-200 dark:border-[#333] px-3 py-2 text-sm bg-white dark:bg-[#252525] text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-emerald-500/25 outline-none"
                      >
                        <option value="">Выберите</option>
                        {warehouses.filter(w => !w.isArchived).map(w => (
                          <option key={w.id} value={w.id}>
                            {w.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label className="flex flex-col gap-1.5 md:col-span-2 lg:col-span-1">
                    <span className="text-xs text-gray-600 dark:text-gray-400">Номенклатура</span>
                    <select
                      value={movementItemId}
                      onChange={e => setMovementItemId(e.target.value)}
                      className="rounded-xl border border-gray-200 dark:border-[#333] px-3 py-2 text-sm bg-white dark:bg-[#252525] text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-emerald-500/25 outline-none"
                    >
                      <option value="">Выберите позицию</option>
                      {items.filter(i => !i.isArchived).map(i => (
                        <option key={i.id} value={i.id}>
                          {i.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs text-gray-600 dark:text-gray-400">Количество</span>
                    <input
                      value={movementQty}
                      onChange={e => setMovementQty(e.target.value)}
                      placeholder={movementType === 'adjustment' ? '± количество' : 'Количество'}
                      className="rounded-xl border border-gray-200 dark:border-[#333] px-3 py-2 text-sm bg-white dark:bg-[#252525] text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-emerald-500/25 outline-none"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 sm:col-span-2">
                    <span className="text-xs text-gray-600 dark:text-gray-400">Комментарий</span>
                    <input
                      value={movementReason}
                      onChange={e => setMovementReason(e.target.value)}
                      placeholder="Необязательно"
                      className="rounded-xl border border-gray-200 dark:border-[#333] px-3 py-2 text-sm bg-white dark:bg-[#252525] text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-emerald-500/25 outline-none"
                    />
                  </label>
                  <ModuleCreateIconButton
                    accent="emerald"
                    label="Провести операцию"
                    onClick={handleCreateMovement}
                    className="w-full sm:w-auto"
                  />
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar min-h-0">
              {movements.length === 0 ? (
                <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-center px-6 py-12">
                  <ArrowLeftRight className="text-gray-300 dark:text-gray-600 mb-3" size={40} strokeWidth={1.25} />
                  <p className="text-gray-700 dark:text-gray-300 font-medium">Журнал движений пуст</p>
                  <p className="text-sm text-gray-500 mt-1">Проведите первую операцию с помощью формы выше.</p>
                </div>
              ) : (
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="bg-gray-50 dark:bg-[#252525] border-b border-gray-200 dark:border-[#333] sticky top-0">
                    <tr className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
                      <th className="px-4 py-3 font-semibold w-28">Дата</th>
                      <th className="px-4 py-3 font-semibold w-36">Тип</th>
                      <th className="px-4 py-3 font-semibold">Со склада</th>
                      <th className="px-4 py-3 font-semibold">На склад</th>
                      <th className="px-4 py-3 font-semibold">Комментарий</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-[#2a2a2a]">
                    {movements
                      .slice()
                      .reverse()
                      .map(m => {
                        const fromWh = m.fromWarehouseId ? warehouses.find(w => w.id === m.fromWarehouseId)?.name : '';
                        const toWh = m.toWarehouseId ? warehouses.find(w => w.id === m.toWarehouseId)?.name : '';
                        const typeLabel =
                          m.type === 'receipt'
                            ? 'Оприходование'
                            : m.type === 'transfer'
                              ? 'Перемещение'
                              : m.type === 'writeoff'
                                ? 'Списание'
                                : 'Корректировка';
                        return (
                          <tr key={m.id} className="hover:bg-slate-50/80 dark:hover:bg-[#222] transition-colors">
                            <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                              {new Date(m.date).toLocaleDateString('ru-RU')}
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex rounded-lg bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                                {typeLabel}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{fromWh || '—'}</td>
                            <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{toWh || '—'}</td>
                            <td className="px-4 py-3 text-gray-500 dark:text-gray-500 text-xs">{m.reason || '—'}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {activeTab === 'revisions' && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="border-b border-gray-100 dark:border-[#2a2a2a] px-4 sm:px-5 py-4 flex flex-wrap items-center justify-between gap-3 shrink-0 bg-emerald-50/30 dark:bg-emerald-950/20">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wide text-emerald-800/90 dark:text-emerald-300">Инвентаризация</span>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">Сначала выберите склад на вкладке «Остатки», затем создайте ревизию</p>
              </div>
              {onCreateRevision && (
                <ModuleCreateIconButton
                  accent="emerald"
                  label="Новая ревизия"
                  onClick={() => {
                    const whId = selectedWarehouseId || filteredWarehouses[0]?.id;
                    if (!whId) { alert('Выберите склад на вкладке «Остатки» или создайте склад'); return; }
                    onCreateRevision({ warehouseId: whId, date: new Date().toISOString().slice(0, 10), createdByUserId: currentUserId });
                  }}
                />
              )}
            </div>
            <div className="flex-1 overflow-auto custom-scrollbar min-h-0 p-4 sm:p-5">
              {revisions.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-12 px-4 rounded-2xl border border-dashed border-gray-200 dark:border-[#333] bg-slate-50/50 dark:bg-[#141414]">
                  <ClipboardCheck className="text-gray-300 dark:text-gray-600 mb-3" size={40} strokeWidth={1.25} />
                  <p className="text-gray-700 dark:text-gray-300 font-medium">Ревизий пока нет</p>
                  <p className="text-sm text-gray-500 dark:text-gray-500 mt-1 max-w-md">Укажите склад на вкладке «Остатки» и нажмите «Новая ревизия».</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {revisions.slice().reverse().map(rev => {
                    const wh = warehouses.find(w => w.id === rev.warehouseId);
                    const isDraft = rev.status === 'draft';
                    const isEditing = editingRevisionId === rev.id;
                    return (
                      <div key={rev.id} className="border border-gray-200 dark:border-[#333] rounded-2xl overflow-hidden bg-white dark:bg-[#1e1e1e] shadow-sm">
                        <div className="px-4 py-3 bg-gradient-to-r from-slate-50 to-white dark:from-[#252525] dark:to-[#1e1e1e] flex items-center justify-between flex-wrap gap-2 border-b border-gray-100 dark:border-[#333]">
                          <span className="font-medium text-sm text-gray-800 dark:text-gray-100">{rev.number}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">{wh?.name || rev.warehouseId} · {new Date(rev.date).toLocaleDateString()}</span>
                          <span className={`text-xs px-2 py-0.5 rounded ${rev.status === 'posted' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'}`}>
                            {rev.status === 'posted' ? 'Проведена' : 'Черновик'}
                          </span>
                          {isDraft && onUpdateRevision && (
                            <div className="flex items-center gap-2">
                              <button
                                className="text-xs text-gray-600 dark:text-gray-400 hover:underline"
                                onClick={() => setEditingRevisionId(isEditing ? null : rev.id)}
                              >
                                {isEditing ? 'Свернуть' : 'Редактировать'}
                              </button>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                  const whBalances = balances.filter(b => b.warehouseId === rev.warehouseId);
                                  const lines = whBalances.map(b => ({ itemId: b.itemId, quantitySystem: b.quantity, quantityFact: b.quantity }));
                                  onUpdateRevision({ ...rev, lines });
                                }}
                              >
                                Подтянуть остатки
                              </Button>
                              {onPostRevision && (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => onPostRevision(rev.id, currentUserId)}
                                >
                                  Провести
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                        {isEditing && isDraft && onUpdateRevision && (
                          <div className="p-4 border-t border-gray-100 dark:border-[#333]">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-gray-500 dark:text-gray-400">
                                  <th className="text-left py-1">Номенклатура</th>
                                  <th className="text-right w-24">Учёт</th>
                                  <th className="text-right w-24">Факт</th>
                                </tr>
                              </thead>
                              <tbody>
                                {rev.lines.map((line, idx) => {
                                  const item = items.find(i => i.id === line.itemId);
                                  return (
                                    <tr key={line.itemId} className="border-t border-gray-100 dark:border-[#333]">
                                      <td className="py-1 text-gray-800 dark:text-gray-100">{item?.name || line.itemId}</td>
                                      <td className="text-right text-gray-500 dark:text-gray-400">{line.quantitySystem}</td>
                                      <td className="text-right">
                                        <input
                                          type="number"
                                          value={line.quantityFact}
                                          onChange={e => {
                                            const next = [...rev.lines];
                                            next[idx] = { ...line, quantityFact: Number(e.target.value) || 0 };
                                            onUpdateRevision({ ...rev, lines: next });
                                          }}
                                          className="w-20 text-right border border-gray-200 dark:border-[#333] rounded px-1 py-0.5 bg-white dark:bg-[#252525]"
                                        />
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                            {rev.lines.length === 0 && (
                              <p className="text-gray-500 dark:text-gray-400 text-xs">Нажмите «Подтянуть остатки», чтобы заполнить таблицу по текущим остаткам склада.</p>
                            )}
                          </div>
                        )}
                        {!isEditing && rev.lines.length > 0 && (
                          <div className="p-4 border-t border-gray-100 dark:border-[#333]">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-gray-500 dark:text-gray-400">
                                  <th className="text-left py-1">Номенклатура</th>
                                  <th className="text-right w-24">Учёт</th>
                                  <th className="text-right w-24">Факт</th>
                                </tr>
                              </thead>
                              <tbody>
                                {rev.lines.map(line => {
                                  const item = items.find(i => i.id === line.itemId);
                                  return (
                                    <tr key={line.itemId} className="border-t border-gray-100 dark:border-[#333]">
                                      <td className="py-1 text-gray-800 dark:text-gray-100">{item?.name || line.itemId}</td>
                                      <td className="text-right text-gray-500 dark:text-gray-400">{line.quantitySystem}</td>
                                      <td className="text-right text-gray-800 dark:text-gray-100">{line.quantityFact}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
          </div>
        </div>
      </div>
    </ModulePageShell>
  );
};

export default InventoryView;


