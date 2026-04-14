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
  /** neutral — серый активный чип; accent — полупрозрачный фон как у иконки в сайдбаре */
  variant?: 'neutral' | 'accent';
  accent?: ModuleAccentKey;
  className?: string;
  /** sm — высота как у кнопки «+» в шапке (min-h-8), md — прежний размер */
  size?: 'sm' | 'md';
}

const shellMd = 'inline-flex flex-nowrap items-center gap-1 max-w-full';

const shellSm = 'inline-flex flex-nowrap items-center gap-0.5 max-w-full';

const baseBtnMd =
  'inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors shrink-0';

const baseBtnSm =
  'inline-flex items-center justify-center gap-1 min-h-8 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors shrink-0';

const inactive = 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#252525]';

const neutralActive =
  'bg-gray-200 text-gray-900 dark:bg-[#2f2f2f] dark:text-gray-100 font-medium';

/**
 * Вкладки / сегменты в едином стиле с сайдбаром: активный — navIconActive (полупрозрачный), не сплошная заливка.
 */
export function ModuleSegmentedControl<T extends string>({
  value,
  onChange,
  options,
  className = '',
  size = 'md',
  variant = 'accent',
  accent = 'indigo',
}: ModuleSegmentedControlProps<T>) {
  const shell = size === 'sm' ? shellSm : shellMd;
  const baseBtn = size === 'sm' ? baseBtnSm : baseBtnMd;
  const activeClass =
    variant === 'neutral' ? neutralActive : MODULE_ACCENTS[accent].navIconActive;

  return (
    <ModuleTabsScroller contentClassName={`${shell} ${className}`} shadows>
      <div role="tablist" className="inline-flex items-center gap-1.5">
        {options.map((opt) => {
          const isActive = opt.value === value;
          return (
            <button
              key={String(opt.value)}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(opt.value)}
              className={`${baseBtn} ${isActive ? activeClass : inactive}`}
            >
              {opt.icon ? <span className="inline-flex shrink-0 [&>svg]:block">{opt.icon}</span> : null}
              {opt.label}
            </button>
          );
        })}
      </div>
    </ModuleTabsScroller>
  );
}
