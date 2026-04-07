import React from 'react';
import type { ModuleAccentKey } from './moduleAccent';
import { ModuleTabsScroller } from './ModuleTabsScroller';

export interface ModulePageHeaderProps {
  /** Иконка Lucide (оставлено для обратной совместимости) */
  icon: React.ReactNode;
  title: string;
  description?: string;
  accent?: ModuleAccentKey;
  /** Контролы шапки модуля: вкладки и действия */
  actions?: React.ReactNode;
  /** Левая часть шапки: вкладки/сегменты */
  tabs?: React.ReactNode;
  /** Правая часть: фильтры, плюс, доп. действия */
  controls?: React.ReactNode;
  className?: string;
  /** Скрыть блок иконка+заголовок+описание (когда название модуля уже в верхней панели приложения) */
  hideTitleBlock?: boolean;
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
  tabs,
  controls,
  className = '',
  hideTitleBlock = false,
}) => {
  const hasNewLayout = Boolean(tabs || controls);
  if (!actions && !hasNewLayout) return null;

  if (hideTitleBlock && hasNewLayout) {
    return (
      <div className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between min-w-0 ${className}`}>
        {tabs && (
          <div className="min-w-0 flex-1 overflow-hidden">
            <ModuleTabsScroller contentClassName="flex items-center gap-2">
              {tabs}
            </ModuleTabsScroller>
          </div>
        )}
        {controls && <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end sm:justify-end">{controls}</div>}
      </div>
    );
  }

  return hasNewLayout ? (
    <div className={`flex flex-row items-center justify-between gap-2 ${className}`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          {icon && (
            <span className="flex items-center justify-center w-9 h-9 rounded-xl border border-gray-200 dark:border-[#333] bg-white/70 dark:bg-[#1a1a1a] shrink-0">
              {icon}
            </span>
          )}
          <div className="min-w-0">
            <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">{title}</div>
            {description && (
              <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{description}</div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <ModuleTabsScroller contentClassName="flex items-center gap-2">
              {tabs}
            </ModuleTabsScroller>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 justify-end shrink-0">{controls}</div>
    </div>
  ) : (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>{actions}</div>
  );
};
