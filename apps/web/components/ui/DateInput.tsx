/**
 * DateInput — выбор даты с кастомным календарём (не нативный popup ОС).
 * Значение наружу: строка YYYY-MM-DD (как у input type="date").
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

export const isoFromParts = (y: number, m: number, d: number) =>
  `${y}-${pad(m)}-${pad(d)}`;

export const parseISODate = (s: string): { y: number; m: number; d: number } | null => {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return { y, m, d };
};

const formatDisplayRu = (iso: string) => {
  const p = parseISODate(iso);
  if (!p) return '—';
  return `${pad(p.d)}.${pad(p.m)}.${p.y}`;
};

const MONTHS_RU = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

const WEEKDAYS_RU = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

/** Понедельник = 0 … Воскресенье = 6 */
function weekdayMon0(d: Date) {
  return (d.getDay() + 6) % 7;
}

/** 42 дня: с понедельника недели, где есть 1-е число месяца */
function buildMonthCellsFixed(viewYear: number, viewMonth0: number): Date[] {
  const first = new Date(viewYear, viewMonth0, 1);
  const startOffset = weekdayMon0(first);
  const start = new Date(viewYear, viewMonth0, 1 - startOffset);
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push(d);
  }
  return cells;
}

interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
  required?: boolean;
  min?: string;
  max?: string;
  size?: 'default' | 'compact';
}

export const DateInput: React.FC<DateInputProps> = ({
  value,
  onChange,
  label,
  className = '',
  required = false,
  min,
  max,
  size = 'default',
}) => {
  const compact = size === 'compact';
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [viewYear, setViewYear] = useState(() => {
    const p = parseISODate(value);
    return p ? p.y : new Date().getFullYear();
  });
  const [viewMonth0, setViewMonth0] = useState(() => {
    const p = parseISODate(value);
    return p ? p.m - 1 : new Date().getMonth();
  });

  useEffect(() => {
    const p = parseISODate(value);
    if (p) {
      setViewYear(p.y);
      setViewMonth0(p.m - 1);
    }
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const isDisabledDay = useCallback(
    (y: number, m0: number, d: number) => {
      const iso = isoFromParts(y, m0 + 1, d);
      if (min && iso < min) return true;
      if (max && iso > max) return true;
      return false;
    },
    [min, max]
  );

  const pickDay = (y: number, m0: number, d: number) => {
    if (isDisabledDay(y, m0, d)) return;
    onChange(isoFromParts(y, m0 + 1, d));
    setOpen(false);
  };

  const cells = useMemo(() => buildMonthCellsFixed(viewYear, viewMonth0), [viewYear, viewMonth0]);

  const isInViewMonth = (d: Date) => d.getMonth() === viewMonth0 && d.getFullYear() === viewYear;

  const goPrevMonth = () => {
    if (viewMonth0 === 0) {
      setViewMonth0(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth0((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    if (viewMonth0 === 11) {
      setViewMonth0(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth0((m) => m + 1);
    }
  };

  const btnPad = compact
    ? 'px-2.5 py-1.5 pr-9 h-8 text-sm leading-none rounded-md'
    : 'px-3 py-2 pr-10 min-h-[40px] text-sm rounded-lg';
  const iconRight = compact ? 'right-2' : 'right-3';
  const iconSz = compact ? 14 : 16;

  const display = value ? formatDisplayRu(value) : 'Выберите дату';

  return (
    <div className={`relative ${className}`} ref={wrapRef}>
      {label && (
        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`relative w-full text-left bg-white dark:bg-[#252525] text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-[#555] ${btnPad} focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all flex items-center justify-between gap-2`}
      >
        <span className={!value ? 'text-gray-400 dark:text-gray-500' : ''}>{display}</span>
        <Calendar size={iconSz} className={`absolute ${iconRight} top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 shrink-0 pointer-events-none`} />
      </button>

      {open && (
        <div
          className="absolute top-full left-0 z-[200] mt-1 w-[min(calc(100vw-1.5rem),280px)] rounded-xl border border-gray-200 dark:border-[#444] bg-white dark:bg-[#252525] shadow-xl p-3"
          role="dialog"
          aria-label="Календарь"
        >
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={goPrevMonth}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[#333] text-gray-600 dark:text-gray-300"
              aria-label="Предыдущий месяц"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              {MONTHS_RU[viewMonth0]} {viewYear}
            </div>
            <button
              type="button"
              onClick={goNextMonth}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[#333] text-gray-600 dark:text-gray-300"
              aria-label="Следующий месяц"
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-semibold text-gray-400 dark:text-gray-500 mb-1">
            {WEEKDAYS_RU.map((w) => (
              <div key={w} className="py-1">
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((cellDate, idx) => {
              const y = cellDate.getFullYear();
              const m0 = cellDate.getMonth();
              const d = cellDate.getDate();
              const inMonth = isInViewMonth(cellDate);
              const iso = isoFromParts(y, m0 + 1, d);
              const isSel = value === iso;
              const dis = isDisabledDay(y, m0, d);
              return (
                <button
                  key={idx}
                  type="button"
                  disabled={dis}
                  onClick={() => pickDay(y, m0, d)}
                  className={`
                    aspect-square max-h-9 rounded-lg text-xs font-medium transition-colors
                    ${!inMonth ? 'text-gray-300 dark:text-gray-600' : 'text-gray-800 dark:text-gray-200'}
                    ${inMonth && !dis ? 'hover:bg-indigo-50 dark:hover:bg-indigo-950/40' : ''}
                    ${isSel ? 'bg-[#3337AD] text-white hover:bg-[#2d3199]' : ''}
                    ${dis ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                >
                  {d}
                </button>
              );
            })}
          </div>
          {!required && (
            <div className="mt-2 flex justify-end gap-2 border-t border-gray-100 dark:border-[#333] pt-2">
              <button
                type="button"
                className="text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
              >
                Очистить
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
