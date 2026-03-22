import React from 'react';
import { Search, Plus, Filter, Users } from 'lucide-react';
import { Button } from '../ui/Button';
import { TaskSelect } from '../TaskSelect';
import { SalesFunnel } from '../../types';
import { ModulePageHeader } from '../ui/ModulePageHeader';

interface ClientsHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  salesFunnels?: SalesFunnel[];
  selectedFunnelId: string;
  onFunnelChange: (funnelId: string) => void;
  showFunnelFilter?: boolean;
  activeTab: 'clients' | 'contracts' | 'finance' | 'receivables';
  onCreateClick: () => void;
  onFiltersClick?: () => void;
  showFilters?: boolean;
  hasActiveFilters?: boolean;
  activeFiltersCount?: number;
}

export const ClientsHeader: React.FC<ClientsHeaderProps> = ({
  searchQuery,
  onSearchChange,
  salesFunnels = [],
  selectedFunnelId,
  onFunnelChange,
  showFunnelFilter = false,
  activeTab,
  onCreateClick,
  onFiltersClick,
  showFilters = false,
  hasActiveFilters = false,
  activeFiltersCount = 0,
}) => {
  return (
    <div className="mb-6 space-y-5">
      <ModulePageHeader
        accent="violet"
        icon={<Users size={24} strokeWidth={2} />}
        title="Клиенты и договора"
        description="Управление клиентами и контрактами"
        actions={
          <>
            {showFunnelFilter && salesFunnels.length > 0 && (
              <div className="min-w-[180px]">
                <TaskSelect
                  value={selectedFunnelId}
                  onChange={onFunnelChange}
                  options={[
                    { value: '', label: 'Все воронки' },
                    ...salesFunnels.map((f) => ({ value: f.id, label: f.name })),
                  ]}
                  className="bg-white dark:bg-[#333] border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                />
              </div>
            )}
            {activeTab === 'contracts' && onFiltersClick && (
              <Button
                variant={showFilters || hasActiveFilters ? 'primary' : 'secondary'}
                size="sm"
                icon={Filter}
                onClick={onFiltersClick}
              >
                <span className="hidden sm:inline">Фильтры</span>
                {hasActiveFilters && (
                  <span className="bg-white/20 dark:bg-white/20 text-white px-1.5 py-0.5 rounded text-xs font-semibold ml-1">
                    {activeFiltersCount}
                  </span>
                )}
              </Button>
            )}
            <Button variant="primary" size="sm" icon={Plus} onClick={onCreateClick}>
              <span className="hidden sm:inline">Создать</span>
            </Button>
          </>
        }
      />

      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
          size={18}
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Поиск клиентов, договоров..."
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-[#333] rounded-xl bg-white dark:bg-[#252525] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 outline-none text-sm"
        />
      </div>
    </div>
  );
};
