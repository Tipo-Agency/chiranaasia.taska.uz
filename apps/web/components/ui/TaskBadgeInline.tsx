import React from 'react';
import { parseBadgeIndex, TASK_BADGE_PRESETS } from '../../utils/taskBadgePresets';
import { useDarkClass } from '../../hooks/useDarkClass';

type TaskBadgeInlineProps = {
  color: string | undefined;
  children: React.ReactNode;
  className?: string;
};

/**
 * Бейдж статуса/приоритета: `badge:N` — inline hex; иначе legacy Tailwind-классы из настроек.
 */
export const TaskBadgeInline: React.FC<TaskBadgeInlineProps> = ({ color, children, className = '' }) => {
  const isDark = useDarkClass();
  const idx = parseBadgeIndex(color);
  if (idx !== null) {
    const preset = TASK_BADGE_PRESETS[idx];
    if (preset) {
      const pal = isDark ? preset.dark : preset.light;
      return (
        <span
          className={`inline-flex items-center rounded-md font-semibold border ${className}`}
          style={{
            backgroundColor: pal.bg,
            color: pal.text,
            borderColor: pal.border,
          }}
        >
          {children}
        </span>
      );
    }
  }
  const legacy = color?.trim() || 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700';
  return <span className={`inline-flex items-center rounded-md font-semibold border border-transparent ${legacy} ${className}`}>{children}</span>;
};

export function getKanbanDotStyle(color: string | undefined, isDark: boolean): React.CSSProperties | undefined {
  const idx = parseBadgeIndex(color);
  if (idx === null) return undefined;
  const preset = TASK_BADGE_PRESETS[idx];
  if (!preset) return undefined;
  return { backgroundColor: isDark ? preset.dot.dark : preset.dot.light };
}

/** Для канбана: Tailwind-классы точки (legacy-цвета из настроек). */
export function getKanbanDotClass(color: string | undefined): string {
  if (parseBadgeIndex(color) !== null) return '';
  if (!color?.trim()) return 'bg-gray-400 dark:bg-gray-600';
  const keys = [
    'gray',
    'slate',
    'blue',
    'indigo',
    'violet',
    'purple',
    'fuchsia',
    'pink',
    'rose',
    'red',
    'orange',
    'amber',
    'yellow',
    'lime',
    'emerald',
    'green',
    'teal',
    'cyan',
    'sky',
  ];
  for (const k of keys) {
    if (color.includes(k)) return `bg-${k}-500 dark:bg-${k}-600`;
  }
  return 'bg-gray-400 dark:bg-gray-600';
}
