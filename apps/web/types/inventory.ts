export interface Warehouse {
  id: string;
  name: string;
  departmentId?: string;
  location?: string;
  isDefault?: boolean;
  isArchived?: boolean;
}

/** Характеристика позиции: название + единица измерения значения + тип поля */
export interface NomenclatureAttribute {
  id: string;
  label: string;
  unit?: string;
  value: string;
  /** text — строка; number — число; select — значение из options */
  kind?: 'text' | 'number' | 'select';
  options?: string[];
}

export interface NomenclatureAttachment {
  id: string;
  name: string;
  url: string;
  type: string;
  uploadedAt?: string;
  storagePath?: string;
}

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  unit: string;
  category?: string;
  notes?: string;
  attributes?: NomenclatureAttribute[];
  attachments?: NomenclatureAttachment[];
  barcode?: string;
  manufacturer?: string;
  /** Норма расхода / упаковка (напр. «0,12 л/м²», «20 л канистра») — справочно для производства и снабжения */
  consumptionHint?: string;
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
