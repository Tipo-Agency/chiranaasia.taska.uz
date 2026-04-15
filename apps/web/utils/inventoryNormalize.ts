import type { InventoryItem, NomenclatureAttachment, NomenclatureAttribute } from '../types/inventory';

function normAttr(raw: Record<string, unknown>): NomenclatureAttribute {
  const opts = raw.options;
  return {
    id: String(raw.id ?? `a-${Date.now()}`),
    label: String(raw.label ?? ''),
    unit: raw.unit != null ? String(raw.unit) : undefined,
    value: String(raw.value ?? ''),
    kind:
      raw.kind === 'number' || raw.kind === 'select' || raw.kind === 'text'
        ? raw.kind
        : 'text',
    options: Array.isArray(opts) ? opts.map((x) => String(x)) : undefined,
  };
}

function normAtt(raw: Record<string, unknown>): NomenclatureAttachment {
  return {
    id: String(raw.id ?? `f-${Date.now()}`),
    name: String(raw.name ?? ''),
    url: String(raw.url ?? ''),
    type: String(raw.type ?? ''),
    uploadedAt: raw.uploadedAt != null ? String(raw.uploadedAt) : raw.uploaded_at != null ? String(raw.uploaded_at) : undefined,
    storagePath:
      raw.storagePath != null
        ? String(raw.storagePath)
        : raw.storage_path != null
          ? String(raw.storage_path)
          : undefined,
  };
}

export function normalizeInventoryItem(raw: unknown): InventoryItem {
  const r = raw as Record<string, unknown>;
  const attrs = r.attributes;
  const atts = r.attachments;
  return {
    id: String(r.id ?? ''),
    sku: String(r.sku ?? ''),
    name: String(r.name ?? ''),
    unit: String(r.unit ?? ''),
    category: r.category != null ? String(r.category) : undefined,
    notes: r.notes != null ? String(r.notes) : undefined,
    attributes: Array.isArray(attrs) ? attrs.map((x) => normAttr(x as Record<string, unknown>)) : [],
    attachments: Array.isArray(atts) ? atts.map((x) => normAtt(x as Record<string, unknown>)) : [],
    barcode: r.barcode != null ? String(r.barcode) : undefined,
    manufacturer: r.manufacturer != null ? String(r.manufacturer) : undefined,
    consumptionHint:
      r.consumptionHint != null
        ? String(r.consumptionHint)
        : r.consumption_hint != null
          ? String(r.consumption_hint)
          : undefined,
    isArchived: Boolean(r.isArchived ?? r.is_archived),
  };
}
