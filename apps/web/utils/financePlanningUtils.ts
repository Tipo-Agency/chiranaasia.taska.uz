import type {
  FinancialPlanDocument,
  FinancialPlanning,
  FinancialPlanningFundMovement,
  IncomeReport,
  PurchaseRequest,
  FinanceCategory,
} from '../types';
import {
  moneyToTiyin,
  roundMoney,
  splitMoneyIntoWholeSumsProportionally,
  splitTiyinProportionally,
  subtractMoney,
  sumMoney,
  tiyinToMoney,
} from './uzsMoney';

export function sumIncomeReportInRange(report: IncomeReport | undefined, start: string, end: string): number {
  if (!report?.data) return 0;
  const ds = start <= end ? start : end;
  const de = start <= end ? end : start;
  const parts: number[] = [];
  for (const [day, val] of Object.entries(report.data)) {
    if (day >= ds && day <= de) parts.push(Number(val) || 0);
  }
  return sumMoney(parts);
}

/** Сумма по нескольким справкам за интервал дат (даты YYYY-MM-DD). */
export function sumIncomeReportsInRange(
  reports: IncomeReport[] | undefined,
  ids: string[],
  start: string,
  end: string
): number {
  if (!reports?.length || !ids.length) return 0;
  const byId = new Map(reports.map((r) => [r.id, r]));
  const parts: number[] = [];
  for (const id of ids) {
    parts.push(sumIncomeReportInRange(byId.get(id), start, end));
  }
  return sumMoney(parts);
}

/** Распределить доход бюджета по статьям пропорционально «весам» из выбранных планов. */
export function distributeIncomeFromPlanDocuments(
  income: number,
  planDocs: FinancialPlanDocument[],
  categories: FinanceCategory[]
): Record<string, number> {
  if (income <= 0 || !planDocs.length) return {};
  let totalWeight = 0;
  const catWeight: Record<string, number> = {};
  for (const doc of planDocs) {
    const inc = Number(doc.income) || 0;
    if (inc <= 0) continue;
    for (const [cid, raw] of Object.entries(doc.expenses || {})) {
      const v = Number(raw) || 0;
      if (v <= 0) continue;
      const cat = categories.find((c) => c.id === cid);
      const weight = cat?.type === 'percent' ? (v / 100) * inc : v;
      catWeight[cid] = (catWeight[cid] || 0) + weight;
      totalWeight += weight;
    }
  }
  if (totalWeight <= 0) return {};
  const entries = Object.entries(catWeight).sort(([a], [b]) => a.localeCompare(b));
  const weights = entries.map(([, w]) => w);
  const parts = splitTiyinProportionally(moneyToTiyin(income), weights);
  const out: Record<string, number> = {};
  entries.forEach(([cid], i) => {
    out[cid] = tiyinToMoney(parts[i] ?? 0);
  });
  return out;
}

export function parseRequestAmountUzs(req: PurchaseRequest): number {
  const s = String(req.amount ?? '0').replace(/\s/g, '').replace(/,/g, '.');
  const n = Number(s);
  return Number.isFinite(n) ? roundMoney(n) : 0;
}

/** Суммы одобренных заявок по фондам в рамках бюджета. */
export function approvedAmountByFund(
  planning: FinancialPlanning,
  requests: PurchaseRequest[],
  excludeRequestId?: string
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const rid of planning.requestIds || []) {
    if (rid === excludeRequestId) continue;
    const req = requests.find((r) => r.id === rid);
    if (!req || req.status !== 'approved') continue;
    const fid = planning.requestFundIds?.[rid];
    if (!fid) continue;
    out[fid] = sumMoney([out[fid] || 0, parseRequestAmountUzs(req)]);
  }
  return out;
}

export function fundAvailableBalances(planning: FinancialPlanning, requests: PurchaseRequest[]): Record<string, number> {
  const alloc = planning.fundAllocations || {};
  const used = approvedAmountByFund(planning, requests);
  const out: Record<string, number> = {};
  for (const fid of new Set([...Object.keys(alloc), ...Object.keys(used)])) {
    const a = Number(alloc[fid]) || 0;
    const u = Number(used[fid]) || 0;
    out[fid] = subtractMoney(a, u);
  }
  return out;
}

/** Дата заявки YYYY-MM-DD для сравнения с периодом (без сдвига по часовому поясу). */
export function purchaseRequestDayKey(req: PurchaseRequest): string | null {
  const raw = req.date ?? (req as { createdAt?: string }).createdAt;
  if (!raw) return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(raw).trim());
  return m ? m[1] : null;
}

/**
 * Заявки в окне дат бюджета: дата (или createdAt) в [start,end], то же подразделение, не архив.
 * Отклонённые не показываем; оплаченные показываем (остаток по фондам их не списывает как «одобренные»).
 */
export function filterRequestsForPlanningWindow(
  requests: readonly PurchaseRequest[],
  windowStart: string,
  windowEnd: string,
  departmentId: string
): PurchaseRequest[] {
  const ds = windowStart.slice(0, 10);
  const de = windowEnd.slice(0, 10);
  return requests.filter((req) => {
    const dk = purchaseRequestDayKey(req);
    if (dk && (dk < ds || dk > de)) return false;
    if (!dk) return false;
    if (!departmentId || req.departmentId !== departmentId) return false;
    if (req.isArchived) return false;
    if (req.status === 'rejected') return false;
    return true;
  });
}

/** Равные доли дохода по списку фондов (целые сумы UZS, остаток на последний фонд). */
export function computeEqualFundAllocationsByIncome(income: number, fundIds: string[]): Record<string, number> {
  const ids = fundIds.filter(Boolean);
  if (!ids.length) return {};
  const inc = Number(income) || 0;
  if (inc <= 0) {
    const z: Record<string, number> = {};
    for (const id of ids) z[id] = 0;
    return z;
  }
  const weights = ids.map(() => 1);
  const parts = splitMoneyIntoWholeSumsProportionally(inc, weights);
  const out: Record<string, number> = {};
  ids.forEach((id, i) => {
    out[id] = parts[i] ?? 0;
  });
  return out;
}

/** База — равные доли по фондам, затем последовательное применение переносов между фондами. */
export function fundAllocationsAfterMovements(
  income: number,
  fundIds: string[],
  movements: readonly FinancialPlanningFundMovement[]
): Record<string, number> {
  let alloc = computeEqualFundAllocationsByIncome(income, fundIds);
  for (const m of movements) {
    const amt = roundMoney(Number(m.amount) || 0);
    if (amt <= 0) continue;
    alloc = {
      ...alloc,
      [m.fromFundId]: subtractMoney(alloc[m.fromFundId] || 0, amt),
      [m.toFundId]: sumMoney([alloc[m.toFundId] || 0, amt]),
    };
  }
  return alloc;
}
