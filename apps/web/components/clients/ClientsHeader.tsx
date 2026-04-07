import React from 'react';
import { AlertCircle, Briefcase, Building2, FileText, Filter, Users } from 'lucide-react';
import { Button } from '../ui/Button';
import { ModuleCreateDropdown } from '../ui/ModuleCreateDropdown';
import { SalesFunnel } from '../../types';
import { ModulePageHeader } from '../ui/ModulePageHeader';
import { MODULE_ACCENTS } from '../ui/moduleAccent';
import { ModuleSelectDropdown } from '../ui/ModuleSelectDropdown';

interface ClientsHeaderProps {
  salesFunnels?: SalesFunnel[];
  selectedFunnelId: string;
  onFunnelChange: (funnelId: string) => void;
  showFunnelFilter?: boolean;
  activeTab: 'clients' | 'contracts' | 'finance' | 'receivables';
  onCreateClient: () => void;
  onCreateContract: () => void;
  onCreateSale: () => void;
  onCreateReceivable: () => void;
  onFiltersClick?: () => void;
  showFilters?: boolean;
  hasActiveFilters?: boolean;
  activeFiltersCount?: number;
  tabs?: React.ReactNode;
}

export const ClientsHeader: React.FC<ClientsHeaderProps> = ({
  salesFunnels = [],
  selectedFunnelId,
  onFunnelChange,
  showFunnelFilter = false,
  activeTab,
  onCreateClient,
  onCreateContract,
  onCreateSale,
  onCreateReceivable,
  onFiltersClick,
  showFilters = false,
  hasActiveFilters = false,
  activeFiltersCount = 0,
  tabs,
}) => {
  const filterActiveClass = MODULE_ACCENTS.violet.filterActive;

  return (
    <div className="mb-3">
      <ModulePageHeader
        accent="violet"
        icon={<Users size={24} strokeWidth={2} />}
        title="Клиенты и договора"
        description="Управление клиентами и контрактами"
        hideTitleBlock
        tabs={tabs}
        controls={
          <div className="flex items-center gap-2">
            {showFunnelFilter && salesFunnels.length > 0 && (
              <ModuleSelectDropdown
                accent="violet"
                size="sm"
                selectedId={selectedFunnelId || 'all'}
                valueLabel={
                  selectedFunnelId
                    ? (salesFunnels.find((f) => f.id === selectedFunnelId)?.name || '—')
                    : 'Все'
                }
                items={[
                  {
                    id: 'all',
                    label: 'Все',
                    onClick: () => onFunnelChange(''),
                  },
                  ...salesFunnels.map((f) => ({
                    id: f.id,
                    label: f.name,
                    onClick: () => onFunnelChange(f.id),
                  })),
                ]}
              />
            )}
            {activeTab === 'contracts' && onFiltersClick && (
              <Button
                variant="secondary"
                size="sm"
                icon={Filter}
                onClick={onFiltersClick}
                className={showFilters || hasActiveFilters ? filterActiveClass : ''}
              >
                <span className="hidden sm:inline">Фильтры</span>
                {hasActiveFilters && (
                  <span className="bg-white/20 dark:bg-white/20 text-white px-1.5 py-0.5 rounded text-xs font-semibold ml-1">
                    {activeFiltersCount}
                  </span>
                )}
              </Button>
            )}
            <ModuleCreateDropdown
              accent="violet"
              label="Создать"
              items={[
                { id: 'create-client', label: 'Клиент', icon: Building2, onClick: onCreateClient },
                { id: 'create-contract', label: 'Договор', icon: FileText, onClick: onCreateContract },
                { id: 'create-sale', label: 'Продажа', icon: Briefcase, onClick: onCreateSale },
                { id: 'create-receivable', label: 'Задолженность', icon: AlertCircle, onClick: onCreateReceivable },
              ]}
            />
          </div>
        }
      />
    </div>
  );
};
