export interface Warehouse {
  id: string;
  name: string;
  departmentId?: string;
  location?: string;
  isDefault?: boolean;
  isArchived?: boolean;
}

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  unit: string;
  category?: string;
  notes?: string;
  isArchived?: boolean;
}

export interface InventoryRevisionLine {
  itemId: string;
  quantitySystem: number;
  quantityFact: number;
}

export interface InventoryRevision {
  id: string;
  number: string;
  warehouseId: string;
  date: string;
  status: 'draft' | 'posted';
  lines: InventoryRevisionLine[];
  reason?: string;
  createdByUserId: string;
  postedAt?: string;
}

export type StockMovementType = 'receipt' | 'transfer' | 'writeoff' | 'adjustment';

export interface StockMovementItem {
  itemId: string;
  quantity: number;
  price?: number;
}

export interface StockMovement {
  id: string;
  type: StockMovementType;
  date: string;
  fromWarehouseId?: string;
  toWarehouseId?: string;
  items: StockMovementItem[];
  reason?: string;
  createdByUserId: string;
}

export interface StockBalance {
  warehouseId: string;
  itemId: string;
  quantity: number;
}
