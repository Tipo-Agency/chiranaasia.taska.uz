/**
 * Стандартная кнопка «Создать» с выпадающим списком (как на рабочем столе / HomeHeader).
 * Высота и отступы согласованы с кнопками в модулях «Сотрудники» и «Документы» (px-4 py-2, min-h-[44px]).
 * Цвет кнопки задаётся через className (акцент модуля).
 */
import React, { useState, useEffect, useRef } from 'react';
import { Plus, ChevronDown, type LucideIcon } from 'lucide-react';

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
  /** Классы фона/текста кнопки, например: bg-indigo-600 hover:bg-indigo-700 text-white */
  buttonClassName?: string;
  align?: 'left' | 'right';
  disabled?: boolean;
}

export const ModuleCreateDropdown: React.FC<ModuleCreateDropdownProps> = ({
  items,
  buttonClassName = 'bg-[#3337AD] hover:bg-[#292b8a] text-white',
  align = 'right',
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`
          px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm min-h-[44px] transition-colors
          disabled:opacity-50 disabled:cursor-not-allowed
          ${buttonClassName}
        `}
      >
        <Plus size={18} className="shrink-0" />
        <span className="hidden sm:inline">Создать</span>
        <ChevronDown size={14} className="opacity-90 shrink-0" />
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
                      item.iconClassName ?? 'text-[#3337AD] dark:text-[#8b8ee0] shrink-0'
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
