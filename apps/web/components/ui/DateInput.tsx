/**
 * DateInput — выбор даты с кастомным календарём (не нативный popup ОС).
 * Значение наружу: строка YYYY-MM-DD (как у input type="date").
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
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

const YEARS_AROUND = 15;

function buildYears(center: number): number[] {
  const years: number[] = [];
  for (let y = center - YEARS_AROUND; y <= center + YEARS_AROUND; y++) years.push(y);
  return years;
}

function getPopoverPosition(triggerEl: HTMLElement | null, width = 300) {
  if (!triggerEl) return { top: 0, left: 0 };
  const rect = triggerEl.getBoundingClientRect();
  const margin = 8;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let left = rect.left;
  if (left + width > vw - margin) left = Math.max(margin, vw - width - margin);
  const spaceBottom = vh - rect.bottom;
  const top = spaceBottom >= 320 ? rect.bottom + 6 : Math.max(margin, rect.top - 320 - 6);
  return { top, left };
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
  disabled?: boolean;
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
  disabled = false,
}) => {
  const compact = size === 'compact';
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });

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
    if (disabled) setOpen(false);
  }, [disabled]);

  useEffect(() => {
    if (!open || disabled) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popRef.current?.contains(t)) return;
      if (wrapRef.current?.contains(t)) return;
      if (buttonRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    const recalc = () => setPopoverPos(getPopoverPosition(buttonRef.current));
    recalc();
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    window.addEventListener('resize', recalc);
    window.addEventListener('scroll', recalc, true);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onEsc);
      window.removeEventListener('resize', recalc);
      window.removeEventListener('scroll', recalc, true);
    };
  }, [open, disabled]);

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
    setShowMonthPicker(false);
    setShowYearPicker(false);
    if (viewMonth0 === 0) {
      setViewMonth0(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth0((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    setShowMonthPicker(false);
    setShowYearPicker(false);
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
  const years = useMemo(() => buildYears(viewYear), [viewYear]);

  const calendarPanel = (
    <div
      ref={popRef}
      className="fixed z-[320] w-[300px] rounded-xl border border-gray-200 dark:border-[#444] bg-white dark:bg-[#252525] shadow-2xl p-3"
      style={{ top: popoverPos.top, left: popoverPos.left }}
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
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setShowMonthPicker((v) => !v);
              setShowYearPicker(false);
            }}
            className="text-sm font-semibold text-gray-800 dark:text-gray-100 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-[#333]"
          >
            {MONTHS_RU[viewMonth0]}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowYearPicker((v) => !v);
              setShowMonthPicker(false);
            }}
            className="text-sm font-semibold text-gray-800 dark:text-gray-100 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-[#333]"
          >
            {viewYear}
          </button>
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

      {showMonthPicker ? (
        <div className="grid grid-cols-3 gap-1 mb-2">
          {MONTHS_RU.map((m, idx) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setViewMonth0(idx);
                setShowMonthPicker(false);
              }}
              className={`px-2 py-2 rounded-lg text-xs ${idx === viewMonth0 ? 'bg-[#3337AD] text-white' : 'hover:bg-gray-100 dark:hover:bg-[#333] text-gray-700 dark:text-gray-300'}`}
            >
              {m.slice(0, 3)}
            </button>
          ))}
        </div>
      ) : showYearPicker ? (
        <div className="grid grid-cols-3 gap-1 mb-2 max-h-48 overflow-y-auto custom-scrollbar">
          {years.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => {
                setViewYear(y);
                setShowYearPicker(false);
              }}
              className={`px-2 py-2 rounded-lg text-xs ${y === viewYear ? 'bg-[#3337AD] text-white' : 'hover:bg-gray-100 dark:hover:bg-[#333] text-gray-700 dark:text-gray-300'}`}
            >
              {y}
            </button>
          ))}
        </div>
      ) : (
        <>
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
        </>
      )}

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
  );

  return (
    <div className={`relative ${className}`} ref={wrapRef}>
      {label && (
        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((o) => !o);
          setShowMonthPicker(false);
          setShowYearPicker(false);
        }}
        className={`relative w-full text-left bg-white dark:bg-[#252525] text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-[#555] ${btnPad} focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all flex items-center justify-between gap-2 ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        <span className={!value ? 'text-gray-400 dark:text-gray-500' : ''}>{display}</span>
        <Calendar size={iconSz} className={`absolute ${iconRight} top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 shrink-0 pointer-events-none`} />
      </button>

      {open && createPortal(calendarPanel, document.body)}
    </div>
  );
};

interface DateRangeInputProps {
  startDate: string;
  endDate: string;
  onChange: (startDate: string, endDate: string) => void;
  className?: string;
  required?: boolean;
  size?: 'default' | 'compact';
  /** Если задано (например 7), диапазон подставляется в 1 клик от выбранной даты */
  autoRangeDays?: number;
  /** Минимальная дата (YYYY-MM-DD); более ранние дни в календаре не выбираются */
  minDate?: string;
}

export const DateRangeInput: React.FC<DateRangeInputProps> = ({
  startDate,
  endDate,
  onChange,
  className = '',
  required = false,
  size = 'default',
  autoRangeDays,
  minDate,
}) => {
  const compact = size === 'compact';
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [viewYear, setViewYear] = useState(() => parseISODate(startDate)?.y || new Date().getFullYear());
  const [viewMonth0, setViewMonth0] = useState(() => (parseISODate(startDate)?.m || new Date().getMonth() + 1) - 1);
  const [draftStart, setDraftStart] = useState(startDate || '');
  const [draftEnd, setDraftEnd] = useState(endDate || '');
  const [pickingEnd, setPickingEnd] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    setDraftStart(startDate || '');
    setDraftEnd(endDate || '');
  }, [startDate, endDate]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popRef.current?.contains(t)) return;
      if (wrapRef.current?.contains(t)) return;
      if (buttonRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const recalc = () => setPopoverPos(getPopoverPosition(buttonRef.current, 320));
    recalc();
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    window.addEventListener('resize', recalc);
    window.addEventListener('scroll', recalc, true);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onEsc);
      window.removeEventListener('resize', recalc);
      window.removeEventListener('scroll', recalc, true);
    };
  }, [open]);

  const cells = useMemo(() => buildMonthCellsFixed(viewYear, viewMonth0), [viewYear, viewMonth0]);
  const years = useMemo(() => buildYears(viewYear), [viewYear]);
  const isInViewMonth = (d: Date) => d.getMonth() === viewMonth0 && d.getFullYear() === viewYear;

  const ordered = useMemo(() => {
    if (!draftStart || !draftEnd) return { s: draftStart, e: draftEnd };
    return draftStart <= draftEnd ? { s: draftStart, e: draftEnd } : { s: draftEnd, e: draftStart };
  }, [draftStart, draftEnd]);

  const isBeforeMin = useCallback(
    (iso: string) => Boolean(minDate && /^\d{4}-\d{2}-\d{2}$/.test(iso) && iso < minDate!),
    [minDate]
  );

  const addDaysISO = (iso: string, days: number) => {
    const date = new Date(`${iso}T12:00:00`);
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  };

  const pick = (iso: string) => {
    if (isBeforeMin(iso)) return;
    if (!draftStart || (draftStart && draftEnd)) {
      if (autoRangeDays && autoRangeDays > 1) {
        let start = iso;
        let autoEnd = addDaysISO(iso, autoRangeDays - 1);
        if (minDate) {
          if (start < minDate) start = minDate;
          if (autoEnd < minDate) autoEnd = minDate;
          if (autoEnd < start) autoEnd = start;
        }
        setDraftStart(start);
        setDraftEnd(autoEnd);
        onChange(start, autoEnd);
        setOpen(false);
        return;
      }
      setDraftStart(iso);
      setDraftEnd('');
      setPickingEnd(true);
      return;
    }
    if (draftStart && !draftEnd) {
      let s = iso < draftStart ? iso : draftStart;
      let e = iso < draftStart ? draftStart : iso;
      if (minDate) {
        if (s < minDate) s = minDate;
        if (e < minDate) e = minDate;
        if (e < s) e = s;
      }
      setDraftStart(s);
      setDraftEnd(e);
      onChange(s, e);
      setOpen(false);
      return;
    }
  };

  const clearRange = () => {
    setDraftStart('');
    setDraftEnd('');
    onChange('', '');
    setOpen(false);
  };

  const goPrevMonth = () => {
    setShowMonthPicker(false);
    setShowYearPicker(false);
    if (viewMonth0 === 0) {
      setViewMonth0(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth0((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    setShowMonthPicker(false);
    setShowYearPicker(false);
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

  const display = draftStart && draftEnd
    ? `${formatDisplayRu(draftStart)} - ${formatDisplayRu(draftEnd)}`
    : draftStart
      ? `${formatDisplayRu(draftStart)} - ...`
      : 'Выберите период';

  const panel = (
    <div
      ref={popRef}
      className="fixed z-[320] w-[320px] rounded-xl border border-gray-200 dark:border-[#444] bg-white dark:bg-[#252525] shadow-2xl p-3"
      style={{ top: popoverPos.top, left: popoverPos.left }}
    >
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={goPrevMonth} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[#333]">
          <ChevronLeft size={18} />
        </button>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => { setShowMonthPicker((v) => !v); setShowYearPicker(false); }} className="text-sm font-semibold px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-[#333]">
            {MONTHS_RU[viewMonth0]}
          </button>
          <button type="button" onClick={() => { setShowYearPicker((v) => !v); setShowMonthPicker(false); }} className="text-sm font-semibold px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-[#333]">
            {viewYear}
          </button>
        </div>
        <button type="button" onClick={goNextMonth} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[#333]">
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="mb-2 text-xs text-gray-500 dark:text-gray-400">
        {pickingEnd ? 'Выберите дату окончания' : 'Выберите дату начала'}
        {minDate ? (
          <span className="block mt-1 text-[10px] text-gray-400 dark:text-gray-500">
            Нельзя выбрать дату раньше {formatDisplayRu(minDate)}
          </span>
        ) : null}
      </div>

      {showMonthPicker ? (
        <div className="grid grid-cols-3 gap-1 mb-2">
          {MONTHS_RU.map((m, idx) => (
            <button key={m} type="button" onClick={() => { setViewMonth0(idx); setShowMonthPicker(false); }} className={`px-2 py-2 rounded-lg text-xs ${idx === viewMonth0 ? 'bg-[#3337AD] text-white' : 'hover:bg-gray-100 dark:hover:bg-[#333]'}`}>
              {m.slice(0, 3)}
            </button>
          ))}
        </div>
      ) : showYearPicker ? (
        <div className="grid grid-cols-3 gap-1 mb-2 max-h-48 overflow-y-auto custom-scrollbar">
          {years.map((y) => (
            <button key={y} type="button" onClick={() => { setViewYear(y); setShowYearPicker(false); }} className={`px-2 py-2 rounded-lg text-xs ${y === viewYear ? 'bg-[#3337AD] text-white' : 'hover:bg-gray-100 dark:hover:bg-[#333]'}`}>
              {y}
            </button>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-semibold text-gray-400 dark:text-gray-500 mb-1">
            {WEEKDAYS_RU.map((w) => <div key={w} className="py-1">{w}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((cellDate, idx) => {
              const y = cellDate.getFullYear();
              const m0 = cellDate.getMonth();
              const d = cellDate.getDate();
              const iso = isoFromParts(y, m0 + 1, d);
              const inMonth = isInViewMonth(cellDate);
              const isStart = ordered.s === iso;
              const isEnd = ordered.e === iso;
              const inRange = ordered.s && ordered.e && iso > ordered.s && iso < ordered.e;
              const dis = isBeforeMin(iso);
              return (
                <button
                  key={idx}
                  type="button"
                  disabled={dis}
                  onClick={() => pick(iso)}
                  className={`aspect-square max-h-9 rounded-lg text-xs font-medium transition-colors ${
                    !inMonth ? 'text-gray-300 dark:text-gray-600' : 'text-gray-800 dark:text-gray-200'
                  } ${
                    inRange ? 'bg-indigo-100 dark:bg-indigo-950/40' : ''
                  } ${
                    isStart || isEnd ? 'bg-[#3337AD] text-white' : 'hover:bg-indigo-50 dark:hover:bg-indigo-950/30'
                  } ${dis ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </>
      )}

      <div className="mt-2 flex items-center justify-between border-t border-gray-100 dark:border-[#333] pt-2">
        <button type="button" onClick={clearRange} className="text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">
          Очистить
        </button>
        {!required && draftStart && draftEnd && (
          <button
            type="button"
            onClick={() => {
              onChange(ordered.s || '', ordered.e || '');
              setOpen(false);
            }}
            className="text-xs px-2 py-1 rounded bg-[#3337AD] text-white"
          >
            Применить
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className={`relative ${className}`} ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          setShowMonthPicker(false);
          setShowYearPicker(false);
          setPickingEnd(!draftStart || !!draftEnd ? false : true);
        }}
        className={`relative w-full text-left bg-white dark:bg-[#252525] text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-[#555] ${btnPad} focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all flex items-center justify-between gap-2`}
      >
        <span className={!draftStart ? 'text-gray-400 dark:text-gray-500 truncate' : 'truncate'}>{display}</span>
        <Calendar size={iconSz} className={`absolute ${iconRight} top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 shrink-0 pointer-events-none`} />
      </button>
      {open && createPortal(panel, document.body)}
    </div>
  );
};
