import type { ShootPlan } from '../types';

/** Посты, уже привязанные к другим (неархивным) планам съёмки этого контент-плана. */
export function getPostIdsReservedInOtherShootPlans(
  shootPlans: ShootPlan[],
  tableId: string,
  excludePlanId?: string
): Set<string> {
  const s = new Set<string>();
  for (const p of shootPlans) {
    if (p.tableId !== tableId || p.isArchived) continue;
    if (excludePlanId && p.id === excludePlanId) continue;
    for (const it of p.items || []) {
      if (it.postId) s.add(it.postId);
    }
  }
  return s;
}

/** Пост доступен в строке плана: не в другом плане, не занят другой строкой этого плана. */
export function isPostAvailableForShootRow(
  postId: string,
  reservedFromOtherPlans: Set<string>,
  usedInOtherRows: string[],
  currentRowPostId: string
): boolean {
  if (!postId) return true;
  if (postId === currentRowPostId) return true;
  if (usedInOtherRows.includes(postId)) return false;
  return !reservedFromOtherPlans.has(postId);
}
