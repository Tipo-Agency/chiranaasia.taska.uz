import React from 'react';
import { MODULE_ACCENTS, type ModuleAccentKey } from './moduleAccent';

export interface ModulePageHeaderProps {
  /** Иконка Lucide (уже с size/strokeWidth) */
  icon: React.ReactNode;
  title: string;
  description?: string;
  accent?: ModuleAccentKey;
  /** Кнопки справа (фильтры, создать и т.д.) */
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Шапка модуля в стиле «Встречи»: градиентная иконка, заголовок, подзаголовок.
 */
export const ModulePageHeader: React.FC<ModulePageHeaderProps> = ({
  icon,
  title,
  description,
  accent = 'indigo',
  actions,
  className = '',
}) => {
  const a = MODULE_ACCENTS[accent];
  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 ${className}`}
    >
      <div className="flex items-start gap-3 min-w-0">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${a.iconBox}`}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
            {title}
          </h1>
          {description ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2 shrink-0 self-end sm:self-start sm:mt-1">
          {actions}
        </div>
      ) : null}
    </div>
  );
};
