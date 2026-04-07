import React from 'react';
import { MODULE_ACCENTS, type ModuleAccentKey } from './moduleAccent';
import { ModuleTabsScroller } from './ModuleTabsScroller';

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
  /** sm — высота как у кнопки «+» в шапке (min-h-8), md — прежний размер */
  size?: 'sm' | 'md';
}

const shellMd =
  'inline-flex flex-nowrap items-center gap-1.5 rounded-2xl bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#333] p-1 shadow-sm max-w-full';

const shellSm =
  'inline-flex flex-nowrap items-center gap-0.5 rounded-xl bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#333] p-0.5 shadow-sm max-w-full';

const baseBtnMd =
  'inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors shrink-0';

const baseBtnSm =
  'inline-flex items-center justify-center gap-1 min-h-8 px-2.5 py-0.5 rounded-lg text-xs font-medium transition-colors shrink-0';

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
  className = '',
  size = 'md',
}: ModuleSegmentedControlProps<T>) {
  const activeAccent = MODULE_ACCENTS[accent].segmentActive;
  const shell = size === 'sm' ? shellSm : shellMd;
  const baseBtn = size === 'sm' ? baseBtnSm : baseBtnMd;
  return (
    <ModuleTabsScroller contentClassName={`${shell} ${className}`} shadows>
      <div role="tablist" className="inline-flex items-center gap-1.5">
        {options.map((opt) => {
          const isActive = opt.value === value;
          const activeClass =
            variant === 'accent'
              ? activeAccent
              : 'bg-gray-900 dark:bg-[#3337AD] text-white shadow-sm';
          return (
            <button
              key={String(opt.value)}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(opt.value)}
              className={`${baseBtn} ${isActive ? activeClass : inactive}`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </ModuleTabsScroller>
  );
}
