import React from 'react';
import { MODULE_ACCENTS, type ModuleAccentKey } from './moduleAccent';

/** Название модуля слева в шапке — как активная вкладка (без лишней рамки). */
export function ToolbarModuleLabel({
  children,
  accent = 'indigo',
}: {
  children: React.ReactNode;
  accent?: ModuleAccentKey;
}) {
  return (
    <span
      className={`inline-flex items-center min-h-8 px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 ${MODULE_ACCENTS[accent].navIconActive}`}
    >
      {children}
    </span>
  );
}
