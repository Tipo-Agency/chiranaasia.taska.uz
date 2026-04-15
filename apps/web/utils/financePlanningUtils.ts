import type { FinancialPlanDocument, FinancialPlanning, IncomeReport, PurchaseRequest, FinanceCategory } from '../types';

export function sumIncomeReportInRange(report: IncomeReport | undefined, start: string, end: string): number {
  if (!report?.data) return 0;
  const ds = start <= end ? start : end;
  const de = start <= end ? end : start;
  let s = 0;
  for (const [day, val] of Object.entries(report.data)) {
    if (day >= ds && day <= de) s += Number(val) || 0;
  }
  return s;
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
  let s = 0;
  for (const id of ids) {
    s += sumIncomeReportInRange(byId.get(id), start, end);
  }
  return s;
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
  const out: Record<string, number> = {};
  for (const [cid, w] of Object.entries(catWeight)) {
    out[cid] = Math.round(((income * w) / totalWeight) * 100) / 100;
  }
  return out;
}

export function parseRequestAmountUzs(req: PurchaseRequest): number {
  const s = String(req.amount ?? '0').replace(/\s/g, '').replace(/,/g, '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
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
    out[fid] = (out[fid] || 0) + parseRequestAmountUzs(req);
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
    out[fid] = a - u;
  }
  return out;
}
