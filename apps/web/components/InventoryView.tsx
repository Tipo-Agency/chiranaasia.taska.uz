import React, { useMemo, useState } from 'react';
import { Department, Warehouse, InventoryItem, StockBalance, StockMovement, InventoryRevision } from '../types';
import { Layers, Plus } from 'lucide-react';
import { Button } from './ui/Button';

const PRIMARY_COLOR = '#267022';

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
    <div className="h-full flex flex-col min-h-0">
      <div className="max-w-7xl mx-auto w-full pt-8 px-6 flex-shrink-0">
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${PRIMARY_COLOR}20`, color: PRIMARY_COLOR }}>
                <Layers size={24} />
              </div>
              <div>
                <h1 className="text-lg md:text-2xl font-bold text-gray-800 dark:text-white truncate">Склад</h1>
                <p className="hidden md:block text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Номенклатура, подразделения, перемещения, оприходования и ревизии
                </p>
              </div>
            </div>
            {activeTab === 'items' && (
              <Button variant="primary" size="sm" icon={Plus} onClick={handleCreateItem}>
                Создать
              </Button>
            )}
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
        <div className="max-w-7xl mx-auto w-full px-6 pb-20">

          {/* TABS */}
          <div className="flex items-center gap-2 bg-gray-100 dark:bg-[#252525] rounded-full p-1 text-xs mb-4">
            <button
              onClick={() => setActiveTab('balances')}
              className={`px-3 py-1.5 rounded-full flex items-center gap-1 ${
                activeTab === 'balances'
                  ? 'bg-white dark:bg-[#191919] text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-300'
              }`}
            >
              Остатки
            </button>
            <button
              onClick={() => setActiveTab('items')}
              className={`px-3 py-1.5 rounded-full flex items-center gap-1 ${
                activeTab === 'items'
                  ? 'bg-white dark:bg-[#191919] text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-300'
              }`}
            >
              Номенклатура
            </button>
            <button
              onClick={() => setActiveTab('movements')}
              className={`px-3 py-1.5 rounded-full flex items-center gap-1 ${
                activeTab === 'movements'
                  ? 'bg-white dark:bg-[#191919] text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-300'
              }`}
            >
              Журнал
            </button>
            <button
              onClick={() => setActiveTab('revisions')}
              className={`px-3 py-1.5 rounded-full flex items-center gap-1 ${
                activeTab === 'revisions'
                  ? 'bg-white dark:bg-[#191919] text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-300'
              }`}
            >
              Ревизии
            </button>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-4 mb-4">
            <div className="flex flex-col">
              <span className="text-[11px] uppercase font-semibold text-gray-500 dark:text-gray-400 mb-1">
                Подразделение
              </span>
              <select
                value={selectedDepartmentId}
                onChange={e => setSelectedDepartmentId(e.target.value)}
                className="border border-gray-200 dark:border-[#333] rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-[#252525] text-gray-800 dark:text-gray-100 min-w-[220px]"
              >
                <option value="">Все подразделения</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex-1 bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl shadow-sm overflow-hidden flex flex-col min-h-0">
        {activeTab === 'balances' && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="border-b border-gray-100 dark:border-[#333] px-4 py-3 flex items-center gap-3 shrink-0">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Склад</span>
              <select
                value={selectedWarehouseId}
                onChange={e => setSelectedWarehouseId(e.target.value)}
                className="border border-gray-200 dark:border-[#333] rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-[#252525] text-gray-800 dark:text-gray-100 min-w-[220px]"
              >
                <option value="">Выберите склад</option>
                {filteredWarehouses.map(w => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>

              <div className="ml-auto flex items-center gap-2">
                <input
                  value={newWarehouseName}
                  onChange={e => setNewWarehouseName(e.target.value)}
                  placeholder={currentDepartment ? `Новый склад (${currentDepartment.name})` : 'Новый склад'}
                  className="border border-gray-200 dark:border-[#333] rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-[#252525] text-gray-800 dark:text-gray-100"
                />
                <Button variant="primary" size="sm" onClick={handleCreateWarehouse}>
                  Добавить склад
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar min-h-0">
              {balancesForView.length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
                  Нет данных по остаткам. Создайте склад и добавьте операции поступления.
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-gray-50 dark:bg-[#2a2a2a] border-b border-gray-200 dark:border-[#333]">
                    <tr className="text-gray-500 dark:text-gray-400">
                      <th className="px-4 py-2 font-medium w-40">Код</th>
                      <th className="px-4 py-2 font-medium">Номенклатура</th>
                      <th className="px-4 py-2 font-medium w-20">Ед.</th>
                      <th className="px-4 py-2 font-medium w-28 text-right">Остаток</th>
                    </tr>
                  </thead>
                  <tbody>
                    {balancesForView.map(b => (
                      <tr key={`${b.warehouseId}_${b.itemId}`} className="border-b border-gray-100 dark:border-[#333] last:border-0">
                        <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{b.itemSku}</td>
                        <td className="px-4 py-2 text-gray-800 dark:text-gray-100">{b.itemName}</td>
                        <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{b.itemUnit}</td>
                        <td className="px-4 py-2 text-right text-gray-800 dark:text-gray-100">{b.quantity}</td>
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
            <div className="border-b border-gray-100 dark:border-[#333] px-4 py-3 flex items-center gap-3 flex-wrap shrink-0">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Новая номенклатура</span>
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
              <Button variant="primary" size="sm" onClick={handleCreateItem}>
                Добавить
              </Button>
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar min-h-0">
              {items.length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
                  Номенклатура не создана. Добавьте позиции выше.
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-gray-50 dark:bg-[#2a2a2a] border-b border-gray-200 dark:border-[#333]">
                    <tr className="text-gray-500 dark:text-gray-400">
                      <th className="px-4 py-2 font-medium w-32">Код</th>
                      <th className="px-4 py-2 font-medium">Название</th>
                      <th className="px-4 py-2 font-medium w-24">Ед. изм.</th>
                      <th className="px-4 py-2 font-medium w-32">Категория</th>
                      <th className="px-4 py-2 font-medium">Комментарий</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.filter(item => !item.isArchived).map(item => (
                      <tr key={item.id} className="border-b border-gray-100 dark:border-[#333] last:border-0">
                        <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{item.sku}</td>
                        <td className="px-4 py-2 text-gray-800 dark:text-gray-100">{item.name}</td>
                        <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{item.unit}</td>
                        <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{item.category}</td>
                        <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{item.notes}</td>
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
            <div className="border-b border-gray-100 dark:border-[#333] px-4 py-3 flex flex-wrap items-center gap-3 shrink-0">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Новая операция</span>
              <select
                value={movementType}
                onChange={e => setMovementType(e.target.value as any)}
                className="border border-gray-200 dark:border-[#333] rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-[#252525] text-gray-800 dark:text-gray-100"
              >
                <option value="receipt">Оприходование</option>
                <option value="transfer">Перемещение</option>
                <option value="writeoff">Списание</option>
                <option value="adjustment">Корректировка</option>
              </select>
              {movementType !== 'receipt' && movementType !== 'adjustment' && (
                <select
                  value={fromWarehouseId}
                  onChange={e => setFromWarehouseId(e.target.value)}
                  className="border border-gray-200 dark:border-[#333] rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-[#252525] text-gray-800 dark:text-gray-100 min-w-[160px]"
                >
                  <option value="">Со склада</option>
                  {warehouses.filter(w => !w.isArchived).map(w => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              )}
              {movementType !== 'writeoff' && (
                <select
                  value={toWarehouseId}
                  onChange={e => setToWarehouseId(e.target.value)}
                  className="border border-gray-200 dark:border-[#333] rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-[#252525] text-gray-800 dark:text-gray-100 min-w-[160px]"
                >
                  <option value="">На склад</option>
                  {warehouses.filter(w => !w.isArchived).map(w => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              )}
              <select
                value={movementItemId}
                onChange={e => setMovementItemId(e.target.value)}
                className="border border-gray-200 dark:border-[#333] rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-[#252525] text-gray-800 dark:text-gray-100 min-w-[200px]"
              >
                <option value="">Номенклатура</option>
                  {items.filter(i => !i.isArchived).map(i => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
              </select>
              <input
                value={movementQty}
                onChange={e => setMovementQty(e.target.value)}
                placeholder={movementType === 'adjustment' ? '± Кол-во' : 'Кол-во'}
                className="border border-gray-200 dark:border-[#333] rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-[#252525] text-gray-800 dark:text-gray-100 w-24"
              />
              <input
                value={movementReason}
                onChange={e => setMovementReason(e.target.value)}
                placeholder="Комментарий"
                className="border border-gray-200 dark:border-[#333] rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-[#252525] text-gray-800 dark:text-gray-100 flex-1"
              />
              <Button variant="primary" size="sm" onClick={handleCreateMovement}>
                Провести
              </Button>
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar min-h-0">
              {movements.length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
                  Журнал пуст. Создайте первую операцию.
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-gray-50 dark:bg-[#2a2a2a] border-b border-gray-200 dark:border-[#333]">
                    <tr className="text-gray-500 dark:text-gray-400">
                      <th className="px-4 py-2 font-medium w-24">Дата</th>
                      <th className="px-4 py-2 font-medium w-24">Тип</th>
                      <th className="px-4 py-2 font-medium w-40">Со склада</th>
                      <th className="px-4 py-2 font-medium w-40">На склад</th>
                      <th className="px-4 py-2 font-medium">Описание</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements
                      .slice()
                      .reverse()
                      .map(m => {
                        const fromWh = m.fromWarehouseId ? warehouses.find(w => w.id === m.fromWarehouseId)?.name : '';
                        const toWh = m.toWarehouseId ? warehouses.find(w => w.id === m.toWarehouseId)?.name : '';
                        return (
                          <tr key={m.id} className="border-b border-gray-100 dark:border-[#333] last:border-0">
                            <td className="px-4 py-2 text-gray-500 dark:text-gray-400">
                              {new Date(m.date).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-2 text-gray-800 dark:text-gray-100">
                              {m.type === 'receipt' && 'Оприходование'}
                              {m.type === 'transfer' && 'Перемещение'}
                              {m.type === 'writeoff' && 'Списание'}
                              {m.type === 'adjustment' && 'Корректировка'}
                            </td>
                            <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{fromWh}</td>
                            <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{toWh}</td>
                            <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{m.reason}</td>
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
            <div className="border-b border-gray-100 dark:border-[#333] px-4 py-3 flex flex-wrap items-center gap-3 shrink-0">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Ревизии</span>
              {onCreateRevision && (
                <Button
                  variant="primary"
                  size="sm"
                  icon={Plus}
                  onClick={() => {
                    const whId = selectedWarehouseId || filteredWarehouses[0]?.id;
                    if (!whId) { alert('Выберите склад'); return; }
                    onCreateRevision({ warehouseId: whId, date: new Date().toISOString().slice(0, 10), createdByUserId: currentUserId });
                  }}
                >
                  Новая ревизия
                </Button>
              )}
            </div>
            <div className="flex-1 overflow-auto custom-scrollbar min-h-0 p-4">
              {revisions.length === 0 ? (
                <div className="flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm py-8">
                  Ревизий нет. Создайте ревизию по кнопке выше (выберите склад в фильтре «Склад» на вкладке Остатки).
                </div>
              ) : (
                <div className="space-y-4">
                  {revisions.slice().reverse().map(rev => {
                    const wh = warehouses.find(w => w.id === rev.warehouseId);
                    const isDraft = rev.status === 'draft';
                    const isEditing = editingRevisionId === rev.id;
                    return (
                      <div key={rev.id} className="border border-gray-200 dark:border-[#333] rounded-xl overflow-hidden bg-white dark:bg-[#252525]">
                        <div className="px-4 py-2 bg-gray-50 dark:bg-[#2a2a2a] flex items-center justify-between flex-wrap gap-2">
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
    </div>
  );
};

export default InventoryView;


