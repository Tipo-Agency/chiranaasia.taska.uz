import type { ProductionRouteOrder, ProductionRoutePipeline } from '../types';

export function normalizeProductionPipeline(raw: unknown): ProductionRoutePipeline | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = String(r.id || '');
  if (!id) return null;
  const stagesIn = Array.isArray(r.stages) ? r.stages : [];
  const stages = stagesIn
    .map((s: unknown, i: number) => {
      if (!s || typeof s !== 'object') return null;
      const o = s as Record<string, unknown>;
      const sid = String(o.id || '');
      if (!sid) return null;
      return {
        id: sid,
        label: String(o.label || o.title || sid),
        color: (o.color as string) || undefined,
        position: typeof o.position === 'number' ? o.position : i,
        defaultAssigneeUserId: (o.defaultAssigneeUserId as string) || undefined,
      };
    })
    .filter(Boolean) as ProductionRoutePipeline['stages'];
  return {
    id,
    name: String(r.name || r.title || 'Маршрут'),
    color: (r.color as string) || undefined,
    stages,
    createdAt: r.createdAt as string | undefined,
    updatedAt: r.updatedAt as string | undefined,
    isArchived: Boolean(r.isArchived),
  };
}

export function normalizeProductionOrder(raw: unknown): ProductionRouteOrder | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = String(r.id || '');
  if (!id) return null;
  let pendingHandoff: ProductionRouteOrder['pendingHandoff'];
  if (r.pendingHandoff && typeof r.pendingHandoff === 'object') {
    const h = r.pendingHandoff as Record<string, unknown>;
    pendingHandoff = {
      id: String(h.id || ''),
      orderId: String(h.orderId || ''),
      fromStageId: String(h.fromStageId || ''),
      toStageId: String(h.toStageId || ''),
      status: String(h.status || ''),
      handedOverByUserId: (h.handedOverByUserId as string) || null,
      handedOverAt: String(h.handedOverAt || ''),
      acceptedByUserId: (h.acceptedByUserId as string) || null,
      acceptedAt: (h.acceptedAt as string) || null,
      hasDefects: Boolean(h.hasDefects),
      defectNotes: (h.defectNotes as string) || null,
      notes: (h.notes as string) || null,
    };
  }
  return {
    id,
    version: typeof r.version === 'number' ? r.version : 1,
    pipelineId: String(r.pipelineId || ''),
    currentStageId: String(r.currentStageId || ''),
    title: String(r.title || ''),
    notes: (r.notes as string) || null,
    status: String(r.status || 'open'),
    createdAt: String(r.createdAt || ''),
    updatedAt: (r.updatedAt as string) || null,
    isArchived: Boolean(r.isArchived),
    pendingHandoff,
  };
}

export function pipelineToBulk(p: ProductionRoutePipeline): Record<string, unknown> {
  return {
    id: p.id,
    name: p.name,
    title: p.name,
    color: p.color,
    stages: (p.stages || []).map((s, i) => ({
      id: s.id,
      title: s.label,
      label: s.label,
      color: s.color,
      position: s.position ?? i,
      defaultAssigneeUserId: s.defaultAssigneeUserId || undefined,
    })),
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    isArchived: p.isArchived ?? false,
  };
}
