/**
 * Разбиение календарного месяца на недели (пн–вс).
 * Каждая неделя относится к тому месяцу, в котором у неё больше календарных дней;
 * в разбиение месяца YYYY-MM попадают только недели, «приписанные» к этому месяцу.
 */

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

    const overlapStart = first > monday ? first : monday;
    const overlapEnd = last < sunday ? last : sunday;
    if (overlapStart > overlapEnd) continue;

    idx += 1;
    const start = dateKey(overlapStart);
    const end = dateKey(overlapEnd);
    let daysInTarget = 0;
    for (let d = new Date(overlapStart); d <= overlapEnd; d = addDays(d, 1)) {
      if (monthKeyFromDate(d) === ym) daysInTarget += 1;
    }
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
