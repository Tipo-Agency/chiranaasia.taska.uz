/**
 * Парсер банковских выписок (xlsx/csv).
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
  const dmy = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
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

function detectIndexes(header: unknown[]) {
  const normalized = header.map(normalizeHeader);
  const findAny = (candidates: string[]) => normalized.findIndex((h) => candidates.includes(h));
  return {
    date: findAny(['date', 'дата', 'operationdate']),
    desc: findAny(['description', 'назначение', 'комментарий', 'details']),
    amount: findAny(['amount', 'сумма', 'sum']),
    inAmount: findAny(['credit', 'приход', 'поступление', 'income']),
    outAmount: findAny(['debit', 'расход', 'списание', 'expense']),
    type: findAny(['type', 'тип', 'операция']),
  };
}

export async function parseBankStatementFile(file: ArrayBuffer | File): Promise<ParsedStatement> {
  const data = file instanceof File ? await file.arrayBuffer() : file;
  const workbook = XLSX.read(data, { type: 'array', cellDates: false });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return { lines: [] };
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, raw: true });
  if (!rows.length) return { lines: [] };

  const header = rows[0] || [];
  const idx = detectIndexes(header);
  const lines: BankStatementLineApi[] = [];

  rows.slice(1).forEach((row, i) => {
    const date = idx.date >= 0 ? parseDateCell(row[idx.date]) : '';
    const description = idx.desc >= 0 ? String(row[idx.desc] ?? '').trim() : '';

    let amount = 0;
    let lineType: 'in' | 'out' = 'in';
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

    if (!date && !description && !amount) return;
    lines.push({
      id: `ln-${Date.now()}-${i}`,
      lineDate: date || new Date().toISOString().slice(0, 10),
      description,
      amount,
      lineType,
    });
  });

  const period = lines[0]?.lineDate?.slice(0, 7);
  return {
    name: sheetName || 'Выписка',
    period,
    lines,
  };
}
