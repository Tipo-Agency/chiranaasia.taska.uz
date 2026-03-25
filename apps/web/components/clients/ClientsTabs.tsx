import React from 'react';
import { ModuleSegmentedControl } from '../ui/ModuleSegmentedControl';

interface ClientsTabsProps {
  activeTab: 'clients' | 'contracts' | 'finance' | 'receivables';
  onTabChange: (tab: 'clients' | 'contracts' | 'finance' | 'receivables') => void;
}

export const ClientsTabs: React.FC<ClientsTabsProps> = ({ activeTab, onTabChange }) => {
  return (
    <ModuleSegmentedControl
      variant="neutral"
      value={activeTab}
      onChange={(v) => onTabChange(v as 'clients' | 'contracts' | 'finance' | 'receivables')}
      className="flex-nowrap whitespace-nowrap"
      options={[
        { value: 'clients', label: 'База клиентов' },
        { value: 'contracts', label: 'Договоры и продажи' },
        { value: 'finance', label: 'Финансы / оплаты' },
        { value: 'receivables', label: 'Задолженности' },
      ]}
    />
  );
};
