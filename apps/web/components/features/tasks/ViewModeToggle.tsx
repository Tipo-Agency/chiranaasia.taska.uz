/**
 * ViewModeToggle — Таблица / Канбан / Гант в стиле модулей.
 */
import React from 'react';
import { ViewMode } from '../../../types';
import { ModuleSegmentedControl } from '../../ui/ModuleSegmentedControl';
import { LayoutGrid, Table2, BarChart3 } from 'lucide-react';

interface ViewModeToggleProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export const ViewModeToggle: React.FC<ViewModeToggleProps> = ({
  viewMode,
  onViewModeChange,
}) => {
  return (
    <ModuleSegmentedControl
      size="sm"
      variant="neutral"
      value={viewMode}
      onChange={(v) => onViewModeChange(v as ViewMode)}
      options={[
        { value: ViewMode.TABLE, label: 'Таблица', icon: <Table2 size={16} /> },
        { value: ViewMode.KANBAN, label: 'Канбан', icon: <LayoutGrid size={16} /> },
        { value: ViewMode.GANTT, label: 'Гант', icon: <BarChart3 size={16} /> },
      ]}
    />
  );
};
