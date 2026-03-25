import React from 'react';
import { Filter } from 'lucide-react';
import { MODULE_ACCENTS, type ModuleAccentKey } from './moduleAccent';

interface ModuleFilterIconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  accent?: ModuleAccentKey;
  active?: boolean;
  activeCount?: number;
  label?: string;
}

export const ModuleFilterIconButton: React.FC<ModuleFilterIconButtonProps> = ({
  accent = 'indigo',
  active = false,
  activeCount = 0,
  label = 'Фильтры',
  className = '',
  type = 'button',
  disabled,
  ...rest
}) => {
  const activeClass = MODULE_ACCENTS[accent].filterActive;
  return (
    <button
      type={type}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`relative inline-flex items-center justify-center w-11 h-11 rounded-xl shrink-0 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
        active
          ? activeClass
          : 'bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#333] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#252525]'
      } ${className}`}
      {...rest}
    >
      <Filter size={18} />
      {active && activeCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-black/85 text-white text-[10px] font-bold leading-[18px] text-center">
          {activeCount > 99 ? '99+' : activeCount}
        </span>
      )}
    </button>
  );
};
