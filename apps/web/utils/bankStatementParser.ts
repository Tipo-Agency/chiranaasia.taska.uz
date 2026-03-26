/**
 * Парсер банковских выписок (xlsx/csv).
 * Поддерживает «плоский» формат (заголовок в первой строке) и
 * выписки Узбекистана / АПП (шапка сверху, таблица операций ниже — как AccountStatementForPeriod.xlsx).
 */
import type { BankStatementLineApi } from '../services/apiClient';
import * as XLSX from 'xlsx';

export interface ParsedStatement {
  name?: string;
  period?: string;
  lines: BankStatementLineApi[];
}

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[._-]/g, '');
}

function parseDateCell(value: unknown): string {
  if (value == null || value === '') return '';
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      const m = String(parsed.m).padStart(2, '0');
      const d = String(parsed.d).padStart(2, '0');
      return `${parsed.y}-${m}-${d}`;
    }
  }
  const raw = String(value).trim();
  const iso = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  const dmy = raw.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  return raw.slice(0, 10);
}

function parseAmount(value: unknown): number {
  const normalized = String(value ?? '0')
    .replace(/\s/g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

/** Индексы колонок по строке заголовков */
function detectIndexes(header: unknown[]) {
  const normalized = header.map(normalizeHeader);
  const findCol = (candidates: string[]) => {
    for (let i = 0; i < normalized.length; i++) {
      const h = normalized[i];
      for (const c of candidates) {
        if (!c) continue;
        if (h === c || h.includes(c)) return i;
      }
    }
    return -1;
  };

  return {
    date: findCol([
      'датадокумента',
      'датаоперации',
      'date',
      'operationdate',
      'дата',
    ]),
    desc: findCol([
      'назначениеплатежа',
      'назначение',
      'описание',
      'description',
      'details',
      'комментарий',
    ]),
    amount: findCol(['amount', 'сумма', 'sum']),
    inAmount: findCol([
      'оборотыпокредиту',
      'кредит',
      'credit',
      'приход',
      'поступление',
      'income',
    ]),
    outAmount: findCol([
      'оборотыподебету',
      'дебет',
      'debit',
      'расход',
      'списание',
      'expense',
    ]),
    type: findCol(['type', 'тип', 'операция']),
  };
}

/** Строка с «Дата документа» + обороты дебет/кредит (типичная выписка АПП Узбекистана). */
function findTableHeaderRowIndex(rows: unknown[][]): number {
  for (let r = 0; r < Math.min(rows.length, 80); r++) {
    const cells = rows[r] || [];
    const normalized = cells.map(normalizeHeader);
    const hasDocDate = normalized.some((h) => h.includes('датадокумента'));
    const hasDebit = normalized.some((h) => h.includes('оборотыподебету') || h === 'дебет');
    const hasCredit = normalized.some((h) => h.includes('оборотыпокредиту') || h === 'кредит');
    if (hasDocDate && hasDebit && hasCredit) return r;
  }
  return 0;
}

function extractUzMeta(rows: unknown[][], headerRow: number): { name?: string; period?: string } {
  let name: string | undefined;
  const flat = rows.slice(0, headerRow).flat();
  for (const cell of flat) {
    const s = String(cell ?? '').trim();
    if (!s) continue;
    if (/выписка/i.test(s) || /лицевых/i.test(s)) {
      name = s.length > 120 ? `${s.slice(0, 117)}…` : s;
      break;
    }
  }
  const joined = flat.map((c) => String(c ?? '')).join(' ');
  const periodRe = joined.match(
    /за\s*(\d{1,2})[./](\d{1,2})[./](\d{4})\s*по\s*(\d{1,2})[./](\d{1,2})[./](\d{4})/i
  );
  let period: string | undefined;
  if (periodRe) {
    const y = periodRe[3];
    const mo = periodRe[2].padStart(2, '0');
    period = `${y}-${mo}`;
  }
  return { name, period };
}

function lineId(i: number): string {
  return `ln-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Строка итогов/подвала выписки — не операция, иначе дублирует суммы с реальными проводками. */
function isStatementSummaryRow(description: string, row: unknown[]): boolean {
  const d = String(description ?? '').toLowerCase();
  if (
    /^\s*итого\b|итого\s+оборот|итого\s+по|всего\s+оборот|оборот\s+за\s*период|сводн|subtotal|^total\b/i.test(
      d
    )
  ) {
    return true;
  }
  const nonEmpty = row.filter((c) => c !== '' && c != null).length;
  if (nonEmpty <= 2 && /итого|всего|остаток|сальдо/i.test(d)) return true;
  return false;
}

export async function parseBankStatementFile(file: ArrayBuffer | File): Promise<ParsedStatement> {
  const data = file instanceof File ? await file.arrayBuffer() : file;
  const workbook = XLSX.read(data, { type: 'array', cellDates: false });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return { lines: [] };
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, raw: true });
  if (!rows.length) return { lines: [] };

  const headerRowIdx = findTableHeaderRowIndex(rows);
  const header = rows[headerRowIdx] || [];
  const idx = detectIndexes(header);
  const meta = headerRowIdx > 0 ? extractUzMeta(rows, headerRowIdx) : {};

  const dataRows = rows.slice(headerRowIdx + 1);
  const lines: BankStatementLineApi[] = [];

  dataRows.forEach((row, i) => {
    if (!row || !Array.isArray(row)) return;

    const date = idx.date >= 0 ? parseDateCell(row[idx.date]) : '';
    const description = idx.desc >= 0 ? String(row[idx.desc] ?? '').trim() : '';

    let amount = 0;
    let lineType: 'in' | 'out' = 'in';

    const hasSplitAmounts = idx.inAmount >= 0 && idx.outAmount >= 0;
    if (hasSplitAmounts) {
      const inVal = Math.abs(parseAmount(row[idx.inAmount]));
      const outVal = Math.abs(parseAmount(row[idx.outAmount]));
      if (inVal > 0 && outVal === 0) {
        amount = inVal;
        lineType = 'in';
      } else if (outVal > 0 && inVal === 0) {
        amount = outVal;
        lineType = 'out';
      } else if (inVal > 0 && outVal > 0) {
        if (inVal >= outVal) {
          amount = inVal;
          lineType = 'in';
        } else {
          amount = outVal;
          lineType = 'out';
        }
      } else {
        return;
      }
    } else {
      if (idx.inAmount >= 0 || idx.outAmount >= 0) {
        const inVal = idx.inAmount >= 0 ? parseAmount(row[idx.inAmount]) : 0;
        const outVal = idx.outAmount >= 0 ? parseAmount(row[idx.outAmount]) : 0;
        if (inVal >= outVal) {
          amount = Math.abs(inVal);
          lineType = 'in';
        } else {
          amount = Math.abs(outVal);
          lineType = 'out';
        }
      } else {
        amount = Math.abs(parseAmount(idx.amount >= 0 ? row[idx.amount] : 0));
        if (idx.type >= 0) {
          const t = String(row[idx.type] ?? '').toLowerCase();
          lineType = t.includes('рас') || t.includes('debit') || t.includes('out') ? 'out' : 'in';
        } else {
          const signed = parseAmount(idx.amount >= 0 ? row[idx.amount] : 0);
          lineType = signed < 0 ? 'out' : 'in';
        }
      }
    }

    if (!date && !description && !amount) return;
    if (!amount) return;
    if (isStatementSummaryRow(description, row)) return;

    lines.push({
      id: lineId(i),
      lineDate: date || new Date().toISOString().slice(0, 10),
      description,
      amount,
      lineType,
    });
  });

  const periodFromLines = lines[0]?.lineDate?.slice(0, 7);
  return {
    name: meta.name || sheetName || 'Выписка',
    period: meta.period || periodFromLines,
    lines,
  };
}

/** Одинаковые строки из разных загрузок выписок (пересекающиеся периоды) — учитываем один раз. */
export function dedupeBankStatementFlatLines<
  T extends { lineDate: string; lineType: 'in' | 'out'; amount: number; description?: string },
>(lines: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const l of lines) {
    const key = `${l.lineDate}|${l.lineType}|${l.amount}|${String(l.description ?? '').trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(l);
  }
  return out;
}
