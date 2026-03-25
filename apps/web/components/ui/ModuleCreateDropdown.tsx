/**
 * Кнопка только с «+» (как во «Встречах») + выпадающий список вариантов.
 */
import React, { useState, useEffect, useRef } from 'react';
import { type LucideIcon } from 'lucide-react';
import { ModuleCreateIconButton } from './ModuleCreateIconButton';
import { MODULE_ACCENTS, type ModuleAccentKey } from './moduleAccent';

export interface ModuleCreateMenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  /** Класс для иконки пункта (цвет модуля), например text-indigo-600 */
  iconClassName?: string;
}

interface ModuleCreateDropdownProps {
  items: ModuleCreateMenuItem[];
  /** Акцент кнопки «+» (как у модуля) */
  accent?: ModuleAccentKey;
  /** @deprecated используйте accent */
  buttonClassName?: string;
  align?: 'left' | 'right';
  disabled?: boolean;
  /** Подсказка на кнопке */
  label?: string;
}

export const ModuleCreateDropdown: React.FC<ModuleCreateDropdownProps> = ({
  items,
  accent = 'indigo',
  buttonClassName,
  align = 'right',
  disabled = false,
  label = 'Создать',
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const defaultIconClass = MODULE_ACCENTS[accent].menuIcon;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (!items.length) return null;

  return (
    <div className="relative" ref={ref}>
      <ModuleCreateIconButton
        accent={accent}
        label={label}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={buttonClassName ?? ''}
      />

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[15] cursor-default"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div
            className={`absolute top-full mt-2 w-56 bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl shadow-xl py-1 z-20 ${
              align === 'right' ? 'right-0' : 'left-0'
            }`}
          >
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    item.onClick();
                    setOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-[#333] text-left"
                >
                  <Icon
                    size={16}
                    className={
                      item.iconClassName ?? defaultIconClass
                    }
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
