/**
 * Разбиение календарного месяца на недели (пн–вс).
 * Каждая неделя относится к тому месяцу, в котором у неё больше календарных дней;
 * в разбиение месяца YYYY-MM попадают только недели, «приписанные» к этому месяцу.
 */

import type { FinancialPlanWeekSlice } from '../types/finance';
import { moneyToTiyin, splitTiyinProportionally, tiyinToMoney } from './uzsMoney';

function addDays(d: Date, n: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  return x;
}

function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function monthKeyFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Понедельник ISO-недели для даты (локальный календарь). */
export function isoWeekMonday(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(d, diff);
}

function daysInCalendarMonth(y: number, monthIndex0: number): number {
  return new Date(y, monthIndex0 + 1, 0).getDate();
}

export interface MonthWeekSegment {
  start: string;
  end: string;
  label: string;
  /** Якорный месяц YYYY-MM (к которому отнесена неделя). */
  anchorMonth: string;
  /** Дней сегмента внутри запрошенного месяца (для пропорций). */
  daysInTargetMonth: number;
}

export function parseYearMonth(ym: string): { y: number; m0: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(ym.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  if (mo < 0 || mo > 11) return null;
  return { y, m0: mo };
}

/**
 * Недели, пересекающие календарный месяц `ym`, у которых большинство дней падает в этот же месяц.
 */
export function splitMonthIntoWeekSegments(ym: string): MonthWeekSegment[] {
  const parsed = parseYearMonth(ym);
  if (!parsed) return [];
  const { y, m0 } = parsed;
  const first = new Date(y, m0, 1);
  const lastDay = daysInCalendarMonth(y, m0);
  const last = new Date(y, m0, lastDay);

  const weekMondayKeys = new Set<string>();
  for (let d = new Date(first); d <= last; d = addDays(d, 1)) {
    weekMondayKeys.add(dateKey(isoWeekMonday(d)));
  }

  const sortedMondays = Array.from(weekMondayKeys).sort();
  const segments: MonthWeekSegment[] = [];
  let idx = 0;

  for (const monStr of sortedMondays) {
    const monday = new Date(`${monStr}T12:00:00`);
    const sunday = addDays(monday, 6);
    const counts = new Map<string, number>();
    for (let d = new Date(monday); d <= sunday; d = addDays(d, 1)) {
      const mk = monthKeyFromDate(d);
      counts.set(mk, (counts.get(mk) || 0) + 1);
    }
    let anchorMonth = ym;
    let best = -1;
    for (const [mk, c] of counts) {
      if (c > best) {
        best = c;
        anchorMonth = mk;
      }
    }
    if (anchorMonth !== ym) continue;

    /** Полная календарная неделя пн–вс (не обрезать по 1–му/последнему дню месяца). */
    const start = dateKey(monday);
    const end = dateKey(sunday);
    let daysInTarget = 0;
    for (let d = new Date(monday); d <= sunday; d = addDays(d, 1)) {
      if (monthKeyFromDate(d) === ym) daysInTarget += 1;
    }
    idx += 1;
    segments.push({
      start,
      end,
      label: `Неделя ${idx} (${start} — ${end})`,
      anchorMonth: ym,
      daysInTargetMonth: daysInTarget,
    });
  }

  return segments;
}

/**
 * Границы «месяца по большинству дней в неделе»: от понедельника первой такой недели
 * до воскресенья последней (например апрель 2026: 2026-03-30 … 2026-05-03).
 */
export function getMajorityBasedMonthBounds(ym: string): { start: string; end: string } | null {
  const segs = splitMonthIntoWeekSegments(ym);
  if (!segs.length) return null;
  return { start: segs[0].start, end: segs[segs.length - 1].end };
}

/**
 * Распределить итоги месяца по неделям пропорционально числу дней недели в этом месяце.
 * Суммы в целых тийинах: сумма по неделям по доходу и по каждой статье совпадает с месячными полями.
 */
export function allocateMonthPlanToWeekSlices(
  ym: string,
  monthIncome: number,
  monthExpenses: Record<string, number>,
  categoryIds: string[]
): FinancialPlanWeekSlice[] {
  const segs = splitMonthIntoWeekSegments(ym);
  if (!segs.length) return [];
  const dayWeights = segs.map((s) => s.daysInTargetMonth);

  const incomeTiyin = splitTiyinProportionally(moneyToTiyin(monthIncome), dayWeights);

  const expenseTiyinByCat = new Map<string, number[]>();
  for (const catId of categoryIds) {
    expenseTiyinByCat.set(
      catId,
      splitTiyinProportionally(moneyToTiyin(Number(monthExpenses[catId]) || 0), dayWeights)
    );
  }

  return segs.map((seg, i) => {
    const expenses: Record<string, number> = {};
    for (const catId of categoryIds) {
      const parts = expenseTiyinByCat.get(catId);
      expenses[catId] = tiyinToMoney(parts?.[i] ?? 0);
    }
    return {
      start: seg.start,
      end: seg.end,
      label: seg.label,
      income: tiyinToMoney(incomeTiyin[i] ?? 0),
      expenses,
    };
  });
}
