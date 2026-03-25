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
}) => {
  void icon;
  void title;
  void description;
  void accent;

  const hasNewLayout = Boolean(tabs || controls);
  if (!actions && !hasNewLayout) return null;

  return hasNewLayout ? (
    <div className={`flex flex-row items-center justify-between gap-2 ${className}`}>
      <div className="min-w-0 flex-1">
        <ModuleTabsScroller contentClassName="flex items-center gap-2">
          {tabs}
        </ModuleTabsScroller>
      </div>
      <div className="flex items-center gap-2 justify-end shrink-0">{controls}</div>
    </div>
  ) : (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>{actions}</div>
  );
};
