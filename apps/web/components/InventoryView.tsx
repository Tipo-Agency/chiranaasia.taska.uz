import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Department, Warehouse, InventoryItem, StockBalance, StockMovement, InventoryRevision } from '../types';
import type { NomenclatureAttachment, NomenclatureAttribute } from '../types/inventory';
import { NomenclatureExtendedFields } from './inventory/NomenclatureExtendedFields';
import {
  Layers,
  Package,
  ArrowLeftRight,
  ClipboardCheck,
  Upload,
  X,
} from 'lucide-react';
import {
  ModuleCreateDropdown,
  ModuleFilterIconButton,
  ModulePageShell,
  MODULE_PAGE_GUTTER,
  MODULE_PAGE_TOP_PAD,
  SystemAlertDialog,
  SystemConfirmDialog,
  APP_TOOLBAR_MODULE_CLUSTER,
  MODULE_ACCENTS,
  MODULE_TOOLBAR_TAB_IDLE,
} from './ui';
import { StandardModal } from './ui/StandardModal';
import { useAppToolbar } from '../contexts/AppToolbarContext';

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
  const { setLeading, setModule } = useAppToolbar();
  const [activeTab, setActiveTab] = useState<'balances' | 'items' | 'movements' | 'revisions'>('balances');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState('');
  const [filterOnlyNonZero, setFilterOnlyNonZero] = useState(false);
  const [filterCategory, setFilterCategory] = useState('');
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [isCreateItemOpen, setIsCreateItemOpen] = useState(false);
  const [isEditItemOpen, setIsEditItemOpen] = useState(false);
  const [isCreateMovementOpen, setIsCreateMovementOpen] = useState(false);
  const [isCreateRevisionOpen, setIsCreateRevisionOpen] = useState(false);
  const [isCreateWarehouseOpen, setIsCreateWarehouseOpen] = useState(false);
  const [confirmDeleteItemOpen, setConfirmDeleteItemOpen] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Form state: new item
  const [newItemSku, setNewItemSku] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newItemUnit, setNewItemUnit] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('');
  const [newItemNotes, setNewItemNotes] = useState('');
  const [newItemDraftKey, setNewItemDraftKey] = useState(() => `inv-new-${Date.now()}`);
  const [newItemBarcode, setNewItemBarcode] = useState('');
  const [newItemManufacturer, setNewItemManufacturer] = useState('');
  const [newItemConsumptionHint, setNewItemConsumptionHint] = useState('');
  const [newItemAttributes, setNewItemAttributes] = useState<NomenclatureAttribute[]>([]);
  const [newItemAttachments, setNewItemAttachments] = useState<NomenclatureAttachment[]>([]);

  // Form state: edit item
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemSku, setEditItemSku] = useState('');
  const [editItemName, setEditItemName] = useState('');
  const [editItemUnit, setEditItemUnit] = useState('');
  const [editItemCategory, setEditItemCategory] = useState('');
  const [editItemNotes, setEditItemNotes] = useState('');
  const [editItemBarcode, setEditItemBarcode] = useState('');
  const [editItemManufacturer, setEditItemManufacturer] = useState('');
  const [editItemConsumptionHint, setEditItemConsumptionHint] = useState('');
  const [editItemAttributes, setEditItemAttributes] = useState<NomenclatureAttribute[]>([]);
  const [editItemAttachments, setEditItemAttachments] = useState<NomenclatureAttachment[]>([]);

  // Form state: new warehouse
  const [newWarehouseName, setNewWarehouseName] = useState('');
  const [newWarehouseLocation, setNewWarehouseLocation] = useState('');
  const [newWarehouseDepartmentId, setNewWarehouseDepartmentId] = useState('');

  // Form state: movement
  const [movementType, setMovementType] = useState<'receipt' | 'transfer' | 'writeoff' | 'adjustment'>('receipt');
  const [fromWarehouseId, setFromWarehouseId] = useState<string>('');
  const [toWarehouseId, setToWarehouseId] = useState<string>('');
  const [movementItemId, setMovementItemId] = useState<string>('');
  const [movementQty, setMovementQty] = useState<string>('');
  const [movementReason, setMovementReason] = useState<string>('');
  const [movementWarehouseId, setMovementWarehouseId] = useState<string>('');

  // Revision: selected for edit
  const [editingRevisionId, setEditingRevisionId] = useState<string | null>(null);

  const filteredWarehouses = useMemo(
    () => warehouses.filter(w => !w.isArchived && (selectedDepartmentId ? w.departmentId === selectedDepartmentId : true)),
    [warehouses, selectedDepartmentId]
  );

  const activeWarehouses = useMemo(() => warehouses.filter((w) => !w.isArchived), [warehouses]);
  const defaultWarehouseId = useMemo(() => activeWarehouses.find((w) => w.isDefault)?.id || '', [activeWarehouses]);

  useEffect(() => {
    if (!selectedWarehouseId && defaultWarehouseId) {
      setSelectedWarehouseId(defaultWarehouseId);
    }
  }, [defaultWarehouseId, selectedWarehouseId]);

  const categories = useMemo(
    () => Array.from(new Set(items.map((i) => i.category).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b)),
    [items]
  );

  const balancesForView = useMemo(() => {
    const whId = selectedWarehouseId || defaultWarehouseId || filteredWarehouses[0]?.id;
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
      .filter((b) => {
        const itemName = b.itemName.toLowerCase();
        const itemSku = b.itemSku.toLowerCase();
        const q = search.trim().toLowerCase();
        const item = items.find((i) => i.id === b.itemId);
        if (filterOnlyNonZero && !b.quantity) return false;
        if (filterCategory && (item?.category || '') !== filterCategory) return false;
        if (!q) return true;
        return itemName.includes(q) || itemSku.includes(q);
      })
      .sort((a, b) => a.itemName.localeCompare(b.itemName));
  }, [balances, items, filteredWarehouses, selectedWarehouseId, defaultWarehouseId, search, filterOnlyNonZero, filterCategory]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter((item) => !item.isArchived)
      .filter((item) => (filterCategory ? (item.category || '') === filterCategory : true))
      .filter((item) => {
        if (!q) return true;
        return item.name.toLowerCase().includes(q) || item.sku.toLowerCase().includes(q);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items, search, filterCategory]);

  const openCreateItemModal = useCallback(() => {
    setNewItemDraftKey(`inv-new-${Date.now()}`);
    setNewItemBarcode('');
    setNewItemManufacturer('');
    setNewItemConsumptionHint('');
    setNewItemAttributes([]);
    setNewItemAttachments([]);
    setNewItemSku('');
    setNewItemName('');
    setNewItemUnit('');
    setNewItemCategory('');
    setNewItemNotes('');
    setIsCreateItemOpen(true);
  }, []);

  const filteredMovements = useMemo(() => {
    const q = search.trim().toLowerCase();
    return movements
      .slice()
      .reverse()
      .filter((m) => {
        if (!q) return true;
        const fromWh = m.fromWarehouseId ? warehouses.find((w) => w.id === m.fromWarehouseId)?.name : '';
        const toWh = m.toWarehouseId ? warehouses.find((w) => w.id === m.toWarehouseId)?.name : '';
        return [m.reason || '', fromWh || '', toWh || ''].some((v) => v.toLowerCase().includes(q));
      });
  }, [movements, search, warehouses]);

  const handleCreateItem = () => {
    if (!newItemName.trim()) {
      setAlertMessage('Введите название номенклатуры');
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
      barcode: newItemBarcode.trim() || undefined,
      manufacturer: newItemManufacturer.trim() || undefined,
      consumptionHint: newItemConsumptionHint.trim() || undefined,
      attributes: newItemAttributes.length ? newItemAttributes : [],
      attachments: newItemAttachments.length ? newItemAttachments : [],
    };
    onSaveItem(item);
    setNewItemSku('');
    setNewItemName('');
    setNewItemUnit('');
    setNewItemCategory('');
    setNewItemNotes('');
    setNewItemBarcode('');
    setNewItemManufacturer('');
    setNewItemConsumptionHint('');
    setNewItemAttributes([]);
    setNewItemAttachments([]);
    setIsCreateItemOpen(false);
  };

  const openEditItem = (item: InventoryItem) => {
    setEditingItemId(item.id);
    setEditItemSku(item.sku || '');
    setEditItemName(item.name || '');
    setEditItemUnit(item.unit || '');
    setEditItemCategory(item.category || '');
    setEditItemNotes(item.notes || '');
    setEditItemBarcode(item.barcode || '');
    setEditItemManufacturer(item.manufacturer || '');
    setEditItemConsumptionHint(item.consumptionHint || '');
    setEditItemAttributes(item.attributes?.length ? [...item.attributes] : []);
    setEditItemAttachments(item.attachments?.length ? [...item.attachments] : []);
    setIsEditItemOpen(true);
  };

  const handleSaveEditedItem = () => {
    if (!editingItemId) return;
    if (!editItemName.trim()) {
      setAlertMessage('Введите название номенклатуры');
      return;
    }
    onSaveItem({
      id: editingItemId,
      sku: editItemSku.trim(),
      name: editItemName.trim(),
      unit: editItemUnit.trim() || 'шт',
      category: editItemCategory.trim() || undefined,
      notes: editItemNotes.trim() || undefined,
      barcode: editItemBarcode.trim() || undefined,
      manufacturer: editItemManufacturer.trim() || undefined,
      consumptionHint: editItemConsumptionHint.trim() || undefined,
      attributes: editItemAttributes.length ? editItemAttributes : [],
      attachments: editItemAttachments.length ? editItemAttachments : [],
    });
    setIsEditItemOpen(false);
    setEditingItemId(null);
  };

  const handleDeleteEditedItem = () => {
    if (!editingItemId) return;
    setConfirmDeleteItemOpen(true);
  };

  const confirmDeleteItem = () => {
    if (!editingItemId) return;
    onDeleteItem(editingItemId);
    setConfirmDeleteItemOpen(false);
    setIsEditItemOpen(false);
    setEditingItemId(null);
  };

  const handleCreateWarehouse = () => {
    if (!newWarehouseName.trim()) {
      setAlertMessage('Введите название склада');
      return;
    }
    const isFirst = activeWarehouses.length === 0;
    onSaveWarehouse({
      id: `wh-${Date.now()}`,
      name: newWarehouseName.trim(),
      location: newWarehouseLocation.trim() || undefined,
      departmentId: newWarehouseDepartmentId || undefined,
      isDefault: isFirst,
    });
    setNewWarehouseName('');
    setNewWarehouseLocation('');
    setNewWarehouseDepartmentId('');
    setIsCreateWarehouseOpen(false);
  };

  const handleCreateMovement = () => {
    const qty = Number(movementQty.replace(',', '.'));
    if (!movementItemId || (movementType !== 'adjustment' && (!qty || qty <= 0))) {
      setAlertMessage('Заполните номенклатуру и количество');
      return;
    }
    if (movementType === 'adjustment' && qty === 0) {
      setAlertMessage('Для корректировки укажите ненулевое количество (положительное или отрицательное)');
      return;
    }
    if (movementType !== 'receipt' && movementType !== 'adjustment' && !fromWarehouseId && !movementWarehouseId) {
      setAlertMessage('Выберите склад-источник');
      return;
    }
    if (movementType !== 'writeoff' && !toWarehouseId && !movementWarehouseId) {
      setAlertMessage('Выберите склад назначения');
      return;
    }
    if (!onCreateMovement || !currentUserId) return;

    onCreateMovement({
      type: movementType,
      fromWarehouseId: (movementType === 'transfer' || movementType === 'writeoff') ? (fromWarehouseId || movementWarehouseId || undefined) : undefined,
      toWarehouseId: (movementType === 'receipt' || movementType === 'transfer' || movementType === 'adjustment') ? (toWarehouseId || movementWarehouseId || undefined) : undefined,
      items: [{ itemId: movementItemId, quantity: qty }],
      reason: movementReason || undefined,
      createdByUserId: currentUserId,
    });
    setMovementQty('');
    setMovementReason('');
    setMovementItemId('');
    setFromWarehouseId('');
    setToWarehouseId('');
    setMovementWarehouseId('');
    setIsCreateMovementOpen(false);
  };

  const parseDelimitedBalances = (raw: string) => {
    const rows = raw
      .split(/\r?\n/)
      .map((r) => r.trim())
      .filter(Boolean)
      .map((line) => line.split(/[;,|\t]/).map((c) => c.trim()));
    if (rows.length < 2) return [];
    const normalize = (v: string) => v.toLowerCase().replace(/\s+/g, '');
    const header = rows[0].map(normalize);
    const idxSku = header.findIndex((h) => ['sku', 'код', 'артикул'].includes(h));
    const idxName = header.findIndex((h) => ['name', 'название', 'номенклатура'].includes(h));
    const idxQty = header.findIndex((h) => ['qty', 'quantity', 'количество', 'остаток'].includes(h));
    if (idxQty === -1 || (idxSku === -1 && idxName === -1)) return [];
    return rows.slice(1).map((r) => ({
      sku: idxSku >= 0 ? r[idxSku] || '' : '',
      name: idxName >= 0 ? r[idxName] || '' : '',
      qty: Number((r[idxQty] || '').replace(',', '.')),
    }));
  };

  const handleImportBalances = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'csv' && ext !== 'txt') {
      setAlertMessage('Пока поддержан импорт остатков из CSV/TXT (из Excel: Файл -> Сохранить как CSV).');
      return;
    }
    const whId = selectedWarehouseId || filteredWarehouses[0]?.id;
    if (!whId) {
      setAlertMessage('Сначала выберите склад для загрузки остатков.');
      return;
    }
    const text = await file.text();
    const rows = parseDelimitedBalances(text);
    if (!rows.length) {
      setAlertMessage('Не удалось прочитать файл. Нужны колонки: SKU/Код или Название, и Количество.');
      return;
    }
    const toImport = rows.filter((r) => Number.isFinite(r.qty) && r.qty > 0);
    const itemBySku = new Map<string, InventoryItem>(items.map((it) => [it.sku.trim().toLowerCase(), it]));
    const itemByName = new Map<string, InventoryItem>(items.map((it) => [it.name.trim().toLowerCase(), it]));
    const movementItems: { itemId: string; quantity: number }[] = [];
    const missing: string[] = [];
    toImport.forEach((row) => {
      const bySku = row.sku ? itemBySku.get(row.sku.trim().toLowerCase()) : undefined;
      const byName = row.name ? itemByName.get(row.name.trim().toLowerCase()) : undefined;
      const matched = bySku || byName;
      if (!matched) {
        missing.push(row.sku || row.name || 'Пустая строка');
        return;
      }
      movementItems.push({ itemId: matched.id, quantity: row.qty });
    });
    if (!movementItems.length) {
      setAlertMessage('Нет строк для импорта: номенклатура не найдена в справочнике.');
      return;
    }
    onCreateMovement({
      type: 'receipt',
      toWarehouseId: whId,
      items: movementItems,
      reason: `Импорт остатков (${file.name})`,
      createdByUserId: currentUserId,
    });
    if (missing.length) {
      setAlertMessage(`Загружено: ${movementItems.length} поз. Не найдены в справочнике: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '...' : ''}`);
    } else {
      setAlertMessage(`Импорт выполнен: ${movementItems.length} позиций.`);
    }
  };

  const hasActiveFilters =
    !!search.trim() ||
    filterOnlyNonZero ||
    !!filterCategory ||
    !!selectedDepartmentId ||
    !!selectedWarehouseId;
  const downloadBalancesTemplate = () => {
    const sample = 'sku;name;quantity\nSKU-001;Пример позиции;10\n';
    const blob = new Blob([sample], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'inventory_balances_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  useLayoutEffect(() => {
    const tabActive = MODULE_ACCENTS.teal.navIconActive;
    const idle = MODULE_TOOLBAR_TAB_IDLE;
    const tabs: { id: typeof activeTab; label: string }[] = [
      { id: 'balances', label: 'Остатки' },
      { id: 'items', label: 'Номенклатура' },
      { id: 'movements', label: 'Журнал' },
      { id: 'revisions', label: 'Ревизии' },
    ];
    setLeading(
      <div className="flex items-center gap-0.5 sm:gap-1 shrink-0 flex-wrap sm:flex-nowrap" role="tablist" aria-label="Склад">
        {tabs.map((t) => {
          const on = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setActiveTab(t.id)}
              className={`px-2 sm:px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                on ? tabActive : idle
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    );
    setModule(
      <div className={APP_TOOLBAR_MODULE_CLUSTER}>
        <ModuleFilterIconButton
          accent="teal"
          size="sm"
          active={showFilters || hasActiveFilters}
          activeCount={
            Number(!!search.trim()) +
            Number(filterOnlyNonZero) +
            Number(!!filterCategory) +
            Number(!!selectedDepartmentId) +
            Number(!!selectedWarehouseId)
          }
          onClick={() => setShowFilters((prev) => !prev)}
        />
        <ModuleCreateDropdown
          accent="teal"
          align="left"
          buttonSize="sm"
          items={[
            {
              id: 'wh',
              label: 'Новый склад',
              icon: Layers,
              onClick: () => setIsCreateWarehouseOpen(true),
              iconClassName: 'text-emerald-600 dark:text-emerald-400',
            },
            {
              id: 'nom',
              label: 'Новая номенклатура',
              icon: Package,
              onClick: openCreateItemModal,
              iconClassName: 'text-emerald-600 dark:text-emerald-400',
            },
            {
              id: 'mov',
              label: 'Складская операция',
              icon: ArrowLeftRight,
              onClick: () => setIsCreateMovementOpen(true),
              iconClassName: 'text-emerald-600 dark:text-emerald-400',
            },
            {
              id: 'rev',
              label: 'Ревизия',
              icon: ClipboardCheck,
              onClick: () => setIsCreateRevisionOpen(true),
              iconClassName: 'text-emerald-600 dark:text-emerald-400',
            },
            {
              id: 'import',
              label: 'Загрузить остатки (CSV)',
              icon: Upload,
              onClick: () => importInputRef.current?.click(),
              iconClassName: 'text-emerald-600 dark:text-emerald-400',
            },
            {
              id: 'import-template',
              label: 'Скачать шаблон импорта',
              icon: Upload,
              onClick: downloadBalancesTemplate,
              iconClassName: 'text-emerald-600 dark:text-emerald-400',
            },
          ]}
        />
      </div>
    );
    return () => {
      setLeading(null);
      setModule(null);
    };
  }, [
    activeTab,
    showFilters,
    hasActiveFilters,
    search,
    filterOnlyNonZero,
    filterCategory,
    selectedDepartmentId,
    selectedWarehouseId,
    setLeading,
    setModule,
    openCreateItemModal,
  ]);

  return (
    <ModulePageShell>
      <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
        <div className={`${MODULE_PAGE_GUTTER} ${MODULE_PAGE_TOP_PAD} pb-20`}>
          {activeWarehouses.length === 0 && (
            <div className="rounded-2xl border border-emerald-200/70 dark:border-emerald-900/40 bg-emerald-50/60 dark:bg-emerald-950/20 p-4 sm:p-5 mb-4">
              <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                Сначала создайте первый склад
              </p>
              <p className="text-sm text-emerald-800/80 dark:text-emerald-200/80 mt-1">
                Без склада нельзя вести остатки и проводить операции.
              </p>
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setIsCreateWarehouseOpen(true)}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold"
                >
                  <Layers size={16} />
                  Создать склад
                </button>
              </div>
            </div>
          )}

          {showFilters && (
            <div className="rounded-2xl border border-gray-200 dark:border-[#333] bg-white dark:bg-[#191919] p-4 sm:p-5 mb-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2">Фильтры</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                <label className="flex flex-col gap-1.5 min-w-0">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Подразделение</span>
                  <select
                    value={selectedDepartmentId}
                    onChange={(e) => setSelectedDepartmentId(e.target.value)}
                    className="rounded-xl border border-gray-200 dark:border-[#333] bg-gray-50 dark:bg-[#252525] px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-emerald-500/30 outline-none"
                  >
                    <option value="">Все подразделения</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5 min-w-0">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Склад</span>
                  <select
                    value={selectedWarehouseId}
                    onChange={(e) => setSelectedWarehouseId(e.target.value)}
                    className="rounded-xl border border-gray-200 dark:border-[#333] bg-gray-50 dark:bg-[#252525] px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-emerald-500/30 outline-none"
                  >
                    <option value="">
                      Все / авто ({defaultWarehouseId ? 'основной склад' : 'первый склад'})
                    </option>
                    {filteredWarehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Поиск по коду, названию, комментарию..."
                  className="rounded-xl border border-gray-200 dark:border-[#333] bg-gray-50 dark:bg-[#252525] px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-emerald-500/30 outline-none"
                />
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="rounded-xl border border-gray-200 dark:border-[#333] bg-gray-50 dark:bg-[#252525] px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-emerald-500/30 outline-none"
                >
                  <option value="">Все категории</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <label className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-[#333] bg-gray-50 dark:bg-[#252525] text-sm text-gray-800 dark:text-gray-100">
                  <input
                    type="checkbox"
                    checked={filterOnlyNonZero}
                    onChange={(e) => setFilterOnlyNonZero(e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  Только ненулевые остатки
                </label>
              </div>
            </div>
          )}

          <div className="flex-1 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#333] rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-0">
        {activeTab === 'balances' && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="flex-1 overflow-auto custom-scrollbar min-h-0">
              {balancesForView.length === 0 ? (
                <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-center px-6 py-12">
                  <Package className="text-gray-300 dark:text-gray-600 mb-3" size={40} strokeWidth={1.25} />
                  <p className="text-gray-700 dark:text-gray-300 font-medium">Нет остатков для выбранного склада</p>
                  <p className="text-sm text-gray-500 dark:text-gray-500 mt-1 max-w-md">Создайте склад в настройках, заведите номенклатуру и проведите оприходование на вкладке «Журнал». При необходимости укажите склад в фильтрах.</p>
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
            <div className="flex-1 overflow-auto custom-scrollbar min-h-0">
              {filteredItems.length === 0 ? (
                <div className="h-full min-h-[180px] flex flex-col items-center justify-center text-center px-6 py-10">
                  <Package className="text-gray-300 dark:text-gray-600 mb-3" size={36} strokeWidth={1.25} />
                  <p className="text-gray-700 dark:text-gray-300 font-medium">Нет данных по фильтрам</p>
                  <p className="text-sm text-gray-500 mt-1">Добавьте номенклатуру через `+` или измените фильтры.</p>
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
                    {filteredItems.map(item => (
                      <tr
                        key={item.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-[#222] transition-colors cursor-pointer"
                        onClick={() => openEditItem(item)}
                        title="Нажмите, чтобы редактировать"
                      >
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
            <div className="flex-1 overflow-auto custom-scrollbar min-h-0">
              {filteredMovements.length === 0 ? (
                <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-center px-6 py-12">
                  <ArrowLeftRight className="text-gray-300 dark:text-gray-600 mb-3" size={40} strokeWidth={1.25} />
                  <p className="text-gray-700 dark:text-gray-300 font-medium">Журнал движений пуст</p>
                  <p className="text-sm text-gray-500 mt-1">Добавьте операцию через `+` в шапке.</p>
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
                    {filteredMovements.map(m => {
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
            <div className="flex-1 overflow-auto custom-scrollbar min-h-0 p-4 sm:p-5">
              {revisions.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-12 px-4 rounded-2xl border border-dashed border-gray-200 dark:border-[#333] bg-slate-50/50 dark:bg-[#141414]">
                  <ClipboardCheck className="text-gray-300 dark:text-gray-600 mb-3" size={40} strokeWidth={1.25} />
                  <p className="text-gray-700 dark:text-gray-300 font-medium">Ревизий пока нет</p>
                  <p className="text-sm text-gray-500 dark:text-gray-500 mt-1 max-w-md">Выберите склад в фильтрах (иконка в шапке) и нажмите «Новая ревизия».</p>
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
                              <button
                                type="button"
                                className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-[#444] text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2e2e2e]"
                                onClick={() => {
                                  const whBalances = balances.filter(b => b.warehouseId === rev.warehouseId);
                                  const lines = whBalances.map(b => ({ itemId: b.itemId, quantitySystem: b.quantity, quantityFact: b.quantity }));
                                  onUpdateRevision({ ...rev, lines });
                                }}
                              >
                                Подтянуть остатки
                              </button>
                              {onPostRevision && (
                                <button
                                  type="button"
                                  className="px-2.5 py-1.5 rounded-lg text-xs text-white bg-emerald-600 hover:bg-emerald-700"
                                  onClick={() => onPostRevision(rev.id, currentUserId)}
                                >
                                  Провести
                                </button>
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

          <input
            ref={importInputRef}
            type="file"
            accept=".csv,.txt"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              await handleImportBalances(file);
              e.currentTarget.value = '';
            }}
          />

          <StandardModal
            isOpen={isCreateItemOpen}
            onClose={() => setIsCreateItemOpen(false)}
            title="Новая номенклатура"
            size="lg"
            footer={
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateItemOpen(false)}
                  className="px-3 py-2 rounded-lg border border-gray-200 dark:border-[#444] text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2e2e2e]"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleCreateItem}
                  className="px-3 py-2 rounded-lg text-sm text-white bg-emerald-600 hover:bg-emerald-700"
                >
                  Создать
                </button>
              </div>
            }
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Код</span>
                <input value={newItemSku} onChange={e => setNewItemSku(e.target.value)} placeholder="Например: 123" className="rounded-xl border border-gray-200 dark:border-[#333] px-3 py-2.5 text-sm bg-gray-50 dark:bg-[#252525]" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Название *</span>
                <input value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder="Номенклатура" className="rounded-xl border border-gray-200 dark:border-[#333] px-3 py-2.5 text-sm bg-gray-50 dark:bg-[#252525]" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Ед. изм.</span>
                <input value={newItemUnit} onChange={e => setNewItemUnit(e.target.value)} placeholder="шт, кг..." className="rounded-xl border border-gray-200 dark:border-[#333] px-3 py-2.5 text-sm bg-gray-50 dark:bg-[#252525]" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Категория</span>
                <input value={newItemCategory} onChange={e => setNewItemCategory(e.target.value)} placeholder="Опционально" className="rounded-xl border border-gray-200 dark:border-[#333] px-3 py-2.5 text-sm bg-gray-50 dark:bg-[#252525]" />
              </label>
              <label className="flex flex-col gap-1.5 md:col-span-2">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Комментарий</span>
                <input value={newItemNotes} onChange={e => setNewItemNotes(e.target.value)} placeholder="Опционально" className="rounded-xl border border-gray-200 dark:border-[#333] px-3 py-2.5 text-sm bg-gray-50 dark:bg-[#252525]" />
              </label>
              <NomenclatureExtendedFields
                uploadKey={newItemDraftKey}
                barcode={newItemBarcode}
                setBarcode={setNewItemBarcode}
                manufacturer={newItemManufacturer}
                setManufacturer={setNewItemManufacturer}
                consumptionHint={newItemConsumptionHint}
                setConsumptionHint={setNewItemConsumptionHint}
                attributes={newItemAttributes}
                setAttributes={setNewItemAttributes}
                attachments={newItemAttachments}
                setAttachments={setNewItemAttachments}
                setAlertMessage={setAlertMessage}
              />
            </div>
          </StandardModal>

          <StandardModal
            isOpen={isEditItemOpen}
            onClose={() => setIsEditItemOpen(false)}
            title="Редактировать номенклатуру"
            size="lg"
            footer={
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleDeleteEditedItem}
                  className="px-3 py-2 rounded-lg text-sm text-white bg-red-600 hover:bg-red-700"
                >
                  Удалить
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditItemOpen(false)}
                    className="px-3 py-2 rounded-lg border border-gray-200 dark:border-[#444] text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2e2e2e]"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEditedItem}
                    className="px-3 py-2 rounded-lg text-sm text-white bg-emerald-600 hover:bg-emerald-700"
                  >
                    Сохранить
                  </button>
                </div>
              </div>
            }
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Код</span>
                <input value={editItemSku} onChange={e => setEditItemSku(e.target.value)} placeholder="Например: 123" className="rounded-xl border border-gray-200 dark:border-[#333] px-3 py-2.5 text-sm bg-gray-50 dark:bg-[#252525]" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Название *</span>
                <input value={editItemName} onChange={e => setEditItemName(e.target.value)} placeholder="Номенклатура" className="rounded-xl border border-gray-200 dark:border-[#333] px-3 py-2.5 text-sm bg-gray-50 dark:bg-[#252525]" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Ед. изм.</span>
                <input value={editItemUnit} onChange={e => setEditItemUnit(e.target.value)} placeholder="шт, кг..." className="rounded-xl border border-gray-200 dark:border-[#333] px-3 py-2.5 text-sm bg-gray-50 dark:bg-[#252525]" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Категория</span>
                <input value={editItemCategory} onChange={e => setEditItemCategory(e.target.value)} placeholder="Опционально" className="rounded-xl border border-gray-200 dark:border-[#333] px-3 py-2.5 text-sm bg-gray-50 dark:bg-[#252525]" />
              </label>
              <label className="flex flex-col gap-1.5 md:col-span-2">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Комментарий</span>
                <input value={editItemNotes} onChange={e => setEditItemNotes(e.target.value)} placeholder="Опционально" className="rounded-xl border border-gray-200 dark:border-[#333] px-3 py-2.5 text-sm bg-gray-50 dark:bg-[#252525]" />
              </label>
              {editingItemId && (
                <NomenclatureExtendedFields
                  uploadKey={editingItemId}
                  barcode={editItemBarcode}
                  setBarcode={setEditItemBarcode}
                  manufacturer={editItemManufacturer}
                  setManufacturer={setEditItemManufacturer}
                  consumptionHint={editItemConsumptionHint}
                  setConsumptionHint={setEditItemConsumptionHint}
                  attributes={editItemAttributes}
                  setAttributes={setEditItemAttributes}
                  attachments={editItemAttachments}
                  setAttachments={setEditItemAttachments}
                  setAlertMessage={setAlertMessage}
                />
              )}
            </div>
          </StandardModal>

          <StandardModal
            isOpen={isCreateWarehouseOpen}
            onClose={() => setIsCreateWarehouseOpen(false)}
            title="Новый склад"
            size="md"
            footer={
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateWarehouseOpen(false)}
                  className="px-3 py-2 rounded-lg border border-gray-200 dark:border-[#444] text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2e2e2e]"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleCreateWarehouse}
                  className="px-3 py-2 rounded-lg text-sm text-white bg-emerald-600 hover:bg-emerald-700"
                >
                  Создать
                </button>
              </div>
            }
          >
            <div className="grid grid-cols-1 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Название склада *</span>
                <input value={newWarehouseName} onChange={e => setNewWarehouseName(e.target.value)} placeholder="Например: Основной" className="rounded-xl border border-gray-200 dark:border-[#333] px-3 py-2.5 text-sm bg-gray-50 dark:bg-[#252525]" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Локация</span>
                <input value={newWarehouseLocation} onChange={e => setNewWarehouseLocation(e.target.value)} placeholder="Опционально" className="rounded-xl border border-gray-200 dark:border-[#333] px-3 py-2.5 text-sm bg-gray-50 dark:bg-[#252525]" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Подразделение</span>
                <select value={newWarehouseDepartmentId} onChange={(e) => setNewWarehouseDepartmentId(e.target.value)} className="rounded-xl border border-gray-200 dark:border-[#333] px-3 py-2.5 text-sm bg-gray-50 dark:bg-[#252525]">
                  <option value="">Без подразделения</option>
                  {departments.filter((d) => !d.isArchived).map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </label>
            </div>
          </StandardModal>

          <SystemConfirmDialog
            open={confirmDeleteItemOpen}
            title="Удалить номенклатуру?"
            message="Номенклатура будет удалена. Операции и остатки останутся в истории, но элемент пропадёт из списков."
            onCancel={() => setConfirmDeleteItemOpen(false)}
            onConfirm={confirmDeleteItem}
            cancelText="Отмена"
            confirmText="Удалить"
            danger
          />

          <StandardModal
            isOpen={isCreateMovementOpen}
            onClose={() => setIsCreateMovementOpen(false)}
            title="Новая складская операция"
            size="lg"
            footer={
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateMovementOpen(false)}
                  className="px-3 py-2 rounded-lg border border-gray-200 dark:border-[#444] text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2e2e2e]"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleCreateMovement}
                  className="px-3 py-2 rounded-lg text-sm text-white bg-emerald-600 hover:bg-emerald-700"
                >
                  Провести
                </button>
              </div>
            }
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Тип операции</span>
                <select value={movementType} onChange={e => setMovementType(e.target.value as 'receipt' | 'transfer' | 'writeoff' | 'adjustment')} className="rounded-xl border border-gray-200 dark:border-[#333] px-3 pr-10 py-2.5 text-sm bg-gray-50 dark:bg-[#252525]">
                  <option value="receipt">Оприходование</option>
                  <option value="transfer">Перемещение</option>
                  <option value="writeoff">Списание</option>
                  <option value="adjustment">Корректировка</option>
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Склад (быстрый выбор)</span>
                <select value={movementWarehouseId} onChange={e => setMovementWarehouseId(e.target.value)} className="rounded-xl border border-gray-200 dark:border-[#333] px-3 pr-10 py-2.5 text-sm bg-gray-50 dark:bg-[#252525]">
                  <option value="">—</option>
                  {warehouses.filter(w => !w.isArchived).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </label>
              {movementType !== 'receipt' && movementType !== 'adjustment' && (
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Со склада</span>
                  <select value={fromWarehouseId} onChange={e => setFromWarehouseId(e.target.value)} className="rounded-xl border border-gray-200 dark:border-[#333] px-3 pr-10 py-2.5 text-sm bg-gray-50 dark:bg-[#252525]">
                    <option value="">—</option>
                    {warehouses.filter(w => !w.isArchived).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </label>
              )}
              {movementType !== 'writeoff' && (
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-300">На склад</span>
                  <select value={toWarehouseId} onChange={e => setToWarehouseId(e.target.value)} className="rounded-xl border border-gray-200 dark:border-[#333] px-3 pr-10 py-2.5 text-sm bg-gray-50 dark:bg-[#252525]">
                    <option value="">—</option>
                    {warehouses.filter(w => !w.isArchived).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </label>
              )}
              <label className="flex flex-col gap-1.5 md:col-span-2">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Номенклатура</span>
                <select value={movementItemId} onChange={e => setMovementItemId(e.target.value)} className="rounded-xl border border-gray-200 dark:border-[#333] px-3 pr-10 py-2.5 text-sm bg-gray-50 dark:bg-[#252525]">
                  <option value="">Выберите номенклатуру</option>
                  {items.filter(i => !i.isArchived).map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                  {movementType === 'adjustment' ? 'Изменение (±)' : 'Количество'}
                </span>
                <input value={movementQty} onChange={e => setMovementQty(e.target.value)} placeholder={movementType === 'adjustment' ? 'например -2 или 10' : 'например 5'} className="rounded-xl border border-gray-200 dark:border-[#333] px-3 py-2.5 text-sm bg-gray-50 dark:bg-[#252525]" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Комментарий</span>
                <input value={movementReason} onChange={e => setMovementReason(e.target.value)} placeholder="Опционально" className="rounded-xl border border-gray-200 dark:border-[#333] px-3 py-2.5 text-sm bg-gray-50 dark:bg-[#252525]" />
              </label>
            </div>
          </StandardModal>

          <StandardModal
            isOpen={isCreateRevisionOpen}
            onClose={() => setIsCreateRevisionOpen(false)}
            title="Новая ревизия"
            size="md"
            footer={
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateRevisionOpen(false)}
                  className="px-3 py-2 rounded-lg border border-gray-200 dark:border-[#444] text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2e2e2e]"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!onCreateRevision) return;
                    const whId = selectedWarehouseId || defaultWarehouseId || filteredWarehouses[0]?.id;
                    if (!whId) {
                      setAlertMessage('Выберите склад для ревизии.');
                      return;
                    }
                    onCreateRevision({ warehouseId: whId, date: new Date().toISOString().slice(0, 10), createdByUserId: currentUserId });
                    setIsCreateRevisionOpen(false);
                    setActiveTab('revisions');
                  }}
                  className="px-3 py-2 rounded-lg text-sm text-white bg-emerald-600 hover:bg-emerald-700"
                >
                  Создать
                </button>
              </div>
            }
          >
            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Выберите склад и создайте черновик ревизии.
              </p>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Склад</span>
                <select value={selectedWarehouseId} onChange={(e) => setSelectedWarehouseId(e.target.value)} className="w-full rounded-xl border border-gray-200 dark:border-[#333] px-3 pr-10 py-2.5 text-sm bg-gray-50 dark:bg-[#252525]">
                  <option value="">{defaultWarehouseId ? 'Основной склад (по умолчанию)' : 'Выберите склад'}</option>
                  {filteredWarehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </label>
            </div>
          </StandardModal>

          <SystemAlertDialog
            open={!!alertMessage}
            title="Склад"
            message={alertMessage || ''}
            onClose={() => setAlertMessage(null)}
          />
        </div>
      </div>
    </ModulePageShell>
  );
};

export default InventoryView;


