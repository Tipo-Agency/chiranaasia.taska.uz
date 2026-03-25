/**
 * Единая модель сделки (воронка CRM + договор/разовая продажа).
 * Старые записи без dealKind различаются через эвристику inferDealKind.
 */
import type { Deal, DealKind } from '../types';

export function inferDealKind(d: Deal): DealKind {
  if (d.dealKind) return d.dealKind;
  if (d.stage != null && String(d.stage).length > 0 && d.title) return 'funnel';
  if (d.recurring !== undefined || (d.number != null && String(d.number).length > 0)) return 'contract';
  if (d.assigneeId && d.title) return 'funnel';
  return 'contract';
}

export function getDealDisplayTitle(d: Deal): string {
  const t = d.title?.trim();
  if (t) return t;
  const n = d.number?.trim();
  if (n) return `№ ${n}`;
  return 'Без названия';
}

export function isFunnelDeal(d: Deal): boolean {
  return inferDealKind(d) === 'funnel';
}
