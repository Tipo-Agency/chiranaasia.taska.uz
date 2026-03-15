/**
 * ViewModeToggle - переключатель режимов отображения (Таблица/Канбан/Гант)
 */
import React from 'react';
import { ViewMode } from '../../../types';

interface ViewModeToggleProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export const ViewModeToggle: React.FC<ViewModeToggleProps> = ({
  viewMode,
  onViewModeChange,
}) => {
  return (
    <div className="flex items-center gap-2 bg-gray-100 dark:bg-[#252525] rounded-full p-1 text-xs mb-4">
      <button
        onClick={() => onViewModeChange(ViewMode.TABLE)}
        className={`px-3 py-1.5 rounded-full transition-colors ${
          viewMode === ViewMode.TABLE
            ? 'bg-white dark:bg-[#191919] text-gray-900 dark:text-white shadow-sm'
            : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
        }`}
      >
        Таблица
      </button>
      <button
        onClick={() => onViewModeChange(ViewMode.KANBAN)}
        className={`px-3 py-1.5 rounded-full transition-colors ${
          viewMode === ViewMode.KANBAN
            ? 'bg-white dark:bg-[#191919] text-gray-900 dark:text-white shadow-sm'
            : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
        }`}
      >
        Канбан
      </button>
      <button
        onClick={() => onViewModeChange(ViewMode.GANTT)}
        className={`px-3 py-1.5 rounded-full transition-colors ${
          viewMode === ViewMode.GANTT
            ? 'bg-white dark:bg-[#191919] text-gray-900 dark:text-white shadow-sm'
            : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
        }`}
      >
        Гант
      </button>
    </div>
  );
};
