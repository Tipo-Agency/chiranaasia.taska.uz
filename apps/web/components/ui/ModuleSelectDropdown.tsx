import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Check, ChevronDown } from 'lucide-react';
import { Button } from './Button';
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
  /** Optional prefix shown on >= sm screens */
  prefixLabel?: string;
  disabled?: boolean;
  align?: 'left' | 'right';
  className?: string;
}

/**
 * Компактный селект-кнопкой (для мобилки): в шапках модулей вместо широкого Select.
 */
export const ModuleSelectDropdown: React.FC<ModuleSelectDropdownProps> = ({
  accent = 'indigo',
  items,
  valueLabel,
  prefixLabel,
  disabled = false,
  align = 'left',
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

  return (
    <div className={`relative ${className}`} ref={ref}>
      <Button
        variant="secondary"
        size="sm"
        disabled={disabled}
        icon={ChevronDown as unknown as LucideIcon}
        iconPosition="right"
        onClick={() => setOpen((o) => !o)}
        className="max-w-[220px] sm:max-w-[260px]"
      >
        <span className="truncate">{buttonText as any}</span>
      </Button>

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
                {item.label === valueLabel && (
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

