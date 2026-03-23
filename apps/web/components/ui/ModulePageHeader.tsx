import React from 'react';
import type { ModuleAccentKey } from './moduleAccent';

export interface ModulePageHeaderProps {
  /** Иконка Lucide (оставлено для обратной совместимости) */
  icon: React.ReactNode;
  title: string;
  description?: string;
  accent?: ModuleAccentKey;
  /** Контролы шапки модуля: вкладки и действия */
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
  void icon;
  void title;
  void description;
  void accent;

  if (!actions) return null;

  return (
    <div className={`rounded-2xl border border-gray-200 dark:border-[#333] bg-white/90 dark:bg-[#1b1b1b] p-2 shadow-sm ${className}`}>
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
    </div>
  );
};
