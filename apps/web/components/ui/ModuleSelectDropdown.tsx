import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { MODULE_ACCENTS, type ModuleAccentKey } from './moduleAccent';

export interface ModuleSelectDropdownItem {
  id: string;
  label: string;
  onClick: () => void;
}

interface ModuleSelectDropdownProps {
  accent?: ModuleAccentKey;
  items: ModuleSelectDropdownItem[];
  valueLabel: string;
  /** Selected item id for checkmark (preferred over label compare) */
  selectedId?: string;
  /** Optional prefix shown on >= sm screens */
  prefixLabel?: string;
  disabled?: boolean;
  align?: 'left' | 'right';
  /** sm — по высоте как кнопки в верхней панели (w-9 h-9) */
  size?: 'md' | 'sm';
  className?: string;
}

/**
 * Компактный селект-кнопкой (для мобилки): в шапках модулей вместо широкого Select.
 */
export const ModuleSelectDropdown: React.FC<ModuleSelectDropdownProps> = ({
  accent = 'indigo',
  items,
  valueLabel,
  selectedId,
  prefixLabel,
  disabled = false,
  align = 'left',
  size = 'md',
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuIconClass = MODULE_ACCENTS[accent].menuIcon;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const buttonText = useMemo(() => {
    const v = valueLabel || '—';
    if (!prefixLabel) return v;
    return (
      <>
        <span className="hidden sm:inline">{prefixLabel}: </span>
        <span className="inline">{v}</span>
      </>
    );
  }, [prefixLabel, valueLabel]);

  if (!items.length) return null;

  const buttonSizeClass =
    size === 'sm'
      ? 'max-w-[200px] sm:max-w-[220px] rounded-lg px-2.5 pr-9 py-1.5 text-xs font-semibold min-h-[36px]'
      : 'max-w-[220px] sm:max-w-[260px] rounded-lg px-3 pr-10 py-2 text-sm font-medium min-h-[44px]';
  const chevronSize = size === 'sm' ? 14 : 16;

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`
          relative
          inline-flex items-center
          w-auto
          ${buttonSizeClass}
          border border-gray-300 dark:border-gray-600
          bg-gray-100 dark:bg-[#252525]
          text-gray-900 dark:text-white
          hover:bg-gray-200 dark:hover:bg-[#303030]
          transition-colors
          focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500
          disabled:opacity-50 disabled:cursor-not-allowed
        `.trim()}
      >
        <span className="truncate">
          {buttonText as any}
        </span>
        <ChevronDown
          size={chevronSize}
          className={`absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[15] cursor-default"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div
            className={`absolute top-full mt-2 w-72 max-w-[85vw] bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl shadow-xl py-1 z-20 ${
              align === 'right' ? 'right-0' : 'left-0'
            }`}
          >
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  item.onClick();
                  setOpen(false);
                }}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-[#333] text-left"
              >
                <span className="truncate">{item.label}</span>
                {(selectedId ? item.id === selectedId : item.label === valueLabel) && (
                  <Check size={16} className={menuIconClass} />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

