import React from 'react';
import { MODULE_ACCENTS, type ModuleAccentKey } from './moduleAccent';

export interface ModuleSegmentOption<T extends string = string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
}

interface ModuleSegmentedControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: ModuleSegmentOption<T>[];
  /** neutral — как фильтры «Все / С клиентами»; accent — как «Список / Календарь» */
  variant?: 'neutral' | 'accent';
  accent?: ModuleAccentKey;
  className?: string;
}

const shell =
  'inline-flex flex-wrap items-center gap-1.5 rounded-2xl bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#333] p-1 shadow-sm';

const baseBtn =
  'inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors';

const inactive = 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#252525]';

/**
 * Вкладки / сегменты в едином стиле с модулем «Встречи».
 */
export function ModuleSegmentedControl<T extends string>({
  value,
  onChange,
  options,
  variant = 'neutral',
  accent = 'teal',
}: ModuleSegmentedControlProps<T>) {
  const activeAccent = MODULE_ACCENTS[accent].segmentActive;
  return (
    <div className={shell} role="tablist">
      {options.map((opt) => {
        const isActive = opt.value === value;
        const activeClass =
          variant === 'accent'
            ? activeAccent
            : 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-sm';
        return (
          <button
            key={String(opt.value)}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(opt.value)}
            className={`${baseBtn} ${isActive ? activeClass : inactive}`}
          >
            {opt.icon ? <span className="shrink-0">{opt.icon}</span> : null}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
