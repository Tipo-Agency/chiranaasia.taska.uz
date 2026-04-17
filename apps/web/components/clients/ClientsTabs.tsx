import React from 'react';
import { ModuleSegmentedControl } from '../ui/ModuleSegmentedControl';

interface ClientsTabsProps {
  activeTab: 'clients' | 'contracts' | 'receivables';
  onTabChange: (tab: 'clients' | 'contracts' | 'receivables') => void;
}

export const ClientsTabs: React.FC<ClientsTabsProps> = ({ activeTab, onTabChange }) => {
  return (
    <ModuleSegmentedControl
      variant="accent"
      accent="violet"
      size="sm"
      value={activeTab}
      onChange={(v) => onTabChange(v as 'clients' | 'contracts' | 'receivables')}
      className="flex-nowrap whitespace-nowrap"
      options={[
        { value: 'clients', label: 'Клиенты' },
        { value: 'contracts', label: 'Договоры и продажи' },
        { value: 'receivables', label: 'Задолженности' },
      ]}
    />
  );
};
