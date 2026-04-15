/**
 * Утилиты для работы с датами в локальном времени
 */

/**
 * Получить сегодняшнюю дату в формате YYYY-MM-DD в локальном времени
 */
export function getTodayLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Получить дату через N дней от сегодня в формате YYYY-MM-DD в локальном времени
 */
export function getDateDaysFromNow(days: number): string {
  const now = new Date();
  now.setDate(now.getDate() + days);
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Преобразовать дату в формате YYYY-MM-DD в объект Date в локальном времени
 */
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Сравнить две даты в формате YYYY-MM-DD
 * @returns -1 если date1 < date2, 0 если равны, 1 если date1 > date2
 */
export function compareDates(date1: string, date2: string): number {
  const d1 = parseLocalDate(date1);
  const d2 = parseLocalDate(date2);
  if (d1 < d2) return -1;
  if (d1 > d2) return 1;
  return 0;
}

/** Поднять обе границы диапазона YYYY-MM-DD не ниже floor (для запрета «дат в прошлом»). */
export function clampDateRangeNotBeforeFloor(
  start: string,
  end: string,
  floor: string
): { start: string; end: string } {
  let s = (start || '').trim() || floor;
  let e = (end || '').trim() || floor;
  if (s < floor) s = floor;
  if (e < floor) e = floor;
  if (e < s) e = s;
  return { start: s, end: e };
}

/**
 * Проверить, является ли дата сегодняшней (в локальном времени)
 */
export function isToday(dateStr: string): boolean {
  return dateStr === getTodayLocalDate();
}

/**
 * Проверить, просрочена ли дата (в локальном времени)
 */
export function isOverdue(dateStr: string): boolean {
  return compareDates(dateStr, getTodayLocalDate()) < 0;
}

/**
 * Нормализовать дату для input type="date" (конвертирует ISO в YYYY-MM-DD)
 * @param dateStr - дата в любом формате (ISO, YYYY-MM-DD, и т.д.)
 * @returns дата в формате YYYY-MM-DD или пустая строка
 */
export function normalizeDateForInput(dateStr: string | undefined | null): string {
  if (!dateStr) return '';
  
  // Если уже в формате YYYY-MM-DD, возвращаем как есть
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return dateStr;
  }
  
  // Пытаемся распарсить как ISO строку или другую дату
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return ''; // Если не удалось распарсить, возвращаем пустую строку
  }
  
  // Конвертируем в YYYY-MM-DD в локальном времени
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/** Время для API встреч (HH:mm), как на бэкенде meeting_validation.parse_meeting_wall_clock */
export function normalizeWallClockTimeForApi(time: string | undefined | null, fallback = '10:00'): string {
  const raw = (time || fallback).trim();
  const m = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?/);
  if (!m) return fallback;
  const h = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const mi = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;
}

/**
 * Локальное сравнение даты YYYY-MM-DD + времени HH:mm с «сейчас» в браузере.
 * graceMs — допуск (по умолчанию 2 мин), как на API.
 */
export function isWallClockStartInPastBeforeNow(
  dateYmd: string,
  timeHm: string,
  graceMs = 120_000
): boolean {
  const d = (dateYmd || '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const t = normalizeWallClockTimeForApi(timeHm);
  const [y, mo, day] = d.split('-').map((x) => parseInt(x, 10));
  const [h, mi] = t.split(':').map((x) => parseInt(x, 10));
  if (!Number.isFinite(y) || !Number.isFinite(h)) return false;
  const start = new Date(y, mo - 1, day, h, Number.isFinite(mi) ? mi : 0, 0, 0);
  return start.getTime() < Date.now() - graceMs;
}

/** Ключ «дата|время» для сравнения, менялось ли начало встречи. */
export function wallClockStartKey(dateYmd: string, timeHm: string): string {
  const d = (dateYmd || '').trim().slice(0, 10);
  const t = normalizeWallClockTimeForApi(timeHm);
  return `${d}|${t}`;
}

/**
 * Форматировать дату для отображения
 * @param dateStr - дата в формате YYYY-MM-DD или ISO строке
 * @param format - формат даты (по умолчанию 'DD.MM.YYYY')
 * @returns отформатированная дата
 */
export function formatDate(dateStr: string, format: string = 'DD.MM.YYYY'): string {
  if (!dateStr) return '';
  
  let date: Date;
  
  // Если дата в формате YYYY-MM-DD
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    date = parseLocalDate(dateStr);
  } else {
    // Пытаемся распарсить как ISO строку
    date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return dateStr; // Возвращаем исходную строку, если не удалось распарсить
    }
  }
  
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  
  return format
    .replace('DD', day)
    .replace('MM', month)
    .replace('YYYY', String(year))
    .replace('YY', String(year).slice(-2));
}
