import React from 'react';

/** Плашка названия модуля слева в AppToolbar — высота как у кнопки «+» (min-h-8) */
export function ToolbarModuleLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center min-h-8 px-3 rounded-xl border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1a1a1a] text-xs font-semibold text-gray-900 dark:text-white shadow-sm shrink-0">
      {children}
    </span>
  );
}
