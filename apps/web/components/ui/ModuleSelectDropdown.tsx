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
  /** xs/sm — компакт для верхней панели */
  size?: 'md' | 'sm' | 'xs';
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
        <span className="hidden sm:inline text-gray-500 dark:text-gray-400 font-medium">{prefixLabel}: </span>
        <span className="inline font-semibold">{v}</span>
      </>
    );
  }, [prefixLabel, valueLabel]);

  if (!items.length) return null;

  const buttonSizeClass =
    size === 'xs'
      ? 'h-8 max-w-[min(100%,220px)] sm:max-w-[280px] rounded-lg pl-2.5 pr-10 text-xs font-semibold'
      : size === 'sm'
        ? 'h-8 max-w-[min(100%,240px)] sm:max-w-[300px] rounded-lg pl-3 pr-11 text-sm font-semibold'
        : 'min-h-[44px] max-w-[min(100%,280px)] sm:max-w-[320px] rounded-xl pl-3 pr-12 py-2 text-sm font-medium';
  const chevronRight = size === 'xs' ? 'right-2.5' : size === 'sm' ? 'right-3' : 'right-3.5';
  const chevronSize = size === 'xs' ? 14 : size === 'sm' ? 15 : 16;

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
          border border-gray-200/90 dark:border-[#444]
          bg-white dark:bg-[#1f1f1f]
          text-gray-900 dark:text-white
          shadow-sm
          hover:bg-gray-50 dark:hover:bg-[#2a2a2a]
          transition-colors
          focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-[#3337AD]/35 dark:focus:ring-[#a5a8f5]/25
          disabled:opacity-50 disabled:cursor-not-allowed
        `.trim()}
      >
        <span className="truncate text-left">
          {buttonText as any}
        </span>
        <ChevronDown
          size={chevronSize}
          className={`absolute ${chevronRight} top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none transition-transform shrink-0 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[100] cursor-default bg-black/10 dark:bg-black/25"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div
            className={`absolute top-full mt-1.5 w-[min(100vw-2rem,20rem)] max-w-[min(100vw-2rem,20rem)] max-h-[min(70vh,22rem)] overflow-y-auto overscroll-contain bg-white dark:bg-[#1f1f1f] border border-gray-200 dark:border-[#333] rounded-xl shadow-xl py-1 z-[110] ${
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
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-[#2a2a2a] text-left border-b border-gray-100/80 dark:border-[#333]/80 last:border-b-0"
              >
                <span className="truncate">{item.label}</span>
                {(selectedId ? item.id === selectedId : item.label === valueLabel) && (
                  <Check size={16} className={`${menuIconClass} shrink-0`} />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

