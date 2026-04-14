import React, { useState, useMemo, useCallback, useEffect, useLayoutEffect } from 'react';
import { Client, Deal, Contract, OneTimeDeal, AccountsReceivable, SalesFunnel } from '../types';
import { FilterConfig } from './FiltersPanel';
import {
  ClientsHeader,
  ClientsTabs,
  ClientsTab,
  ContractsTab,
  FinanceTab,
  ReceivablesTab,
  ClientModal,
  ContractModal,
  OneTimeDealModal,
  AccountsReceivableModal,
} from './clients';
import {
  ModulePageShell,
  MODULE_PAGE_GUTTER,
  ModuleCreateDropdown,
  ModuleFilterIconButton,
  APP_TOOLBAR_MODULE_CLUSTER,
} from './ui';
import { ModuleSelectDropdown } from './ui/ModuleSelectDropdown';
import { useAppToolbar } from '../contexts/AppToolbarContext';
import { AlertCircle, Briefcase, Building2, FileText } from 'lucide-react';

interface ClientsViewProps {
  clients: Client[];
  contracts: Contract[];
  oneTimeDeals?: OneTimeDeal[];
  accountsReceivable?: AccountsReceivable[];
  salesFunnels?: SalesFunnel[];
  onSaveClient: (client: Client) => void;
  onDeleteClient: (id: string) => void;
  onSaveContract: (deal: Contract) => void;
  onDeleteContract: (id: string) => void;
  onSaveOneTimeDeal?: (deal: OneTimeDeal) => void;
  onDeleteOneTimeDeal?: (id: string) => void;
  onSaveAccountsReceivable?: (receivable: AccountsReceivable) => void;
  onDeleteAccountsReceivable?: (id: string) => void;
  /** Встроено в единый хаб CRM: скрыть дублирующие кнопки создания в шапке */
  embedInCrmHub?: boolean;
}

const ClientsView: React.FC<ClientsViewProps> = ({ 
  clients,
  contracts,
  oneTimeDeals = [],
  accountsReceivable = [],
  salesFunnels = [],
  onSaveClient,
  onDeleteClient,
  onSaveContract,
  onDeleteContract,
  onSaveOneTimeDeal,
  onDeleteOneTimeDeal,
  onSaveAccountsReceivable,
  onDeleteAccountsReceivable,
  embedInCrmHub = false,
}) => {
  const { setModule } = useAppToolbar();
  const [activeTab, setActiveTab] = useState<'clients' | 'contracts' | 'finance' | 'receivables'>('clients');
  const [contractStatusFilter, setContractStatusFilter] = useState<string>('all');
  const [selectedFunnelId, setSelectedFunnelId] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  
  // Modal states
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<Deal | null>(null);
  const [targetClientId, setTargetClientId] = useState<string>('');

  const [isOneTimeDealModalOpen, setIsOneTimeDealModalOpen] = useState(false);
  const [editingOneTimeDeal, setEditingOneTimeDeal] = useState<Deal | null>(null);
  const [oneTimeDealClientId, setOneTimeDealClientId] = useState<string>('');
  
  const [isReceivableModalOpen, setIsReceivableModalOpen] = useState(false);
  const [editingReceivable, setEditingReceivable] = useState<AccountsReceivable | null>(null);
  const [receivableClientId, setReceivableClientId] = useState<string>('');

  // Filtered data
  const filteredClients = useMemo(() => {
    const activeClients = clients.filter((c) => !c.isArchived);
    if (!selectedFunnelId) return activeClients;

    const clientIds = new Set<string>();
    for (const d of contracts) {
      if (d.isArchived) continue;
      if (String(d.funnelId || '') !== String(selectedFunnelId)) continue;
      if (d.clientId) clientIds.add(d.clientId);
    }
    for (const d of oneTimeDeals) {
      if (d.isArchived) continue;
      if (String(d.funnelId || '') !== String(selectedFunnelId)) continue;
      if (d.clientId) clientIds.add(d.clientId);
    }
    return activeClients.filter((c) => clientIds.has(c.id));
  }, [clients, selectedFunnelId, contracts, oneTimeDeals]);

  const filteredContracts = useMemo(() => {
    const activeContracts = contracts.filter(c => !c.isArchived);
    return activeContracts.filter(c => {
      if (selectedFunnelId && c.funnelId !== selectedFunnelId) return false;
      const matchesStatus = contractStatusFilter === 'all' || c.status === contractStatusFilter;

      return matchesStatus;
    });
  }, [contracts, contractStatusFilter, selectedFunnelId]);

  const filteredReceivables = useMemo(() => {
    const activeReceivables = accountsReceivable.filter(r => !r.isArchived);
    return activeReceivables;
  }, [accountsReceivable]);

  // Filters for contracts tab
  const contractFilters: FilterConfig[] = useMemo(() => [
    {
      label: 'Статус',
      value: contractStatusFilter,
      onChange: setContractStatusFilter,
      options: [
        { value: 'all', label: 'Все статусы' },
        { value: 'active', label: 'Активен' },
        { value: 'pending', label: 'Ожидание' },
        { value: 'completed', label: 'Закрыт' }
      ]
    }
  ], [contractStatusFilter]);

  const hasActiveContractFilters = useMemo(() => 
    contractStatusFilter !== 'all',
    [contractStatusFilter]
  );
  
  const clearContractFilters = useCallback(() => {
    setContractStatusFilter('all');
  }, []);

  const activeFiltersCount = useMemo(() => 
    contractFilters.filter(f => f.value && f.value !== 'all' && f.value !== '').length,
    [contractFilters]
  );

  // Handlers
  const handleOpenClientCreate = () => {
      setEditingClient(null);
      setIsClientModalOpen(true);
  };

  const handleOpenClientEdit = (client: Client) => {
      setEditingClient(client);
      setIsClientModalOpen(true);
  };

  const handleOpenContractCreate = (clientId: string) => {
      setEditingContract(null);
      setTargetClientId(clientId);
      setIsContractModalOpen(true);
  };
  
  const handleOpenContractEdit = (contract: Contract) => {
      setEditingContract(contract);
      setTargetClientId(contract.clientId);
      setIsContractModalOpen(true);
  };

  const handleOpenOneTimeDealCreate = (clientId: string) => {
    setEditingOneTimeDeal(null);
    setOneTimeDealClientId(clientId);
    setIsOneTimeDealModalOpen(true);
  };

  const handleOpenOneTimeDealEdit = (deal: OneTimeDeal) => {
    setEditingOneTimeDeal(deal);
    setOneTimeDealClientId(deal.clientId);
    setIsOneTimeDealModalOpen(true);
  };

  const handleOpenReceivableCreate = (clientId: string) => {
    setEditingReceivable(null);
    setReceivableClientId(clientId);
    setIsReceivableModalOpen(true);
  };

  const handleOpenReceivableEdit = (receivable: AccountsReceivable) => {
    setEditingReceivable(receivable);
    setReceivableClientId(receivable.clientId);
    setIsReceivableModalOpen(true);
  };

  // Wrapper for AccountsReceivableModal onSave - converts array to individual calls
  const handleSaveAccountsReceivable = (receivables: AccountsReceivable[]) => {
    if (!onSaveAccountsReceivable) return;
    receivables.forEach(receivable => {
      onSaveAccountsReceivable(receivable);
    });
  };

  useLayoutEffect(() => {
    if (!embedInCrmHub) return;

    setModule(
      <div className={APP_TOOLBAR_MODULE_CLUSTER}>
        {(activeTab === 'clients' || activeTab === 'contracts') && salesFunnels.length > 0 && (
          <ModuleSelectDropdown
            accent="violet"
            size="xs"
            align="right"
            selectedId={selectedFunnelId || 'all'}
            valueLabel={
              selectedFunnelId
                ? (salesFunnels.find((f) => f.id === selectedFunnelId)?.name || '—')
                : `Все (${salesFunnels.length})`
            }
            items={[
              { id: 'all', label: `Все (${salesFunnels.length})`, onClick: () => setSelectedFunnelId('') },
              ...salesFunnels.map((f) => ({
                id: f.id,
                label: f.name,
                onClick: () => setSelectedFunnelId(f.id),
              })),
            ]}
          />
        )}
        {activeTab === 'contracts' && (
          <ModuleFilterIconButton
            accent="violet"
            size="sm"
            active={showFilters || hasActiveContractFilters}
            activeCount={activeFiltersCount}
            onClick={() => setShowFilters((v) => !v)}
            label="Фильтры"
          />
        )}
        <ModuleCreateDropdown
          accent="violet"
          buttonSize="sm"
          label="Создать"
          items={[
            { id: 'create-client', label: 'Клиент', icon: Building2, onClick: handleOpenClientCreate },
            { id: 'create-contract', label: 'Договор', icon: FileText, onClick: () => handleOpenContractCreate('') },
            { id: 'create-sale', label: 'Продажа', icon: Briefcase, onClick: () => handleOpenOneTimeDealCreate('') },
            { id: 'create-receivable', label: 'Задолженность', icon: AlertCircle, onClick: () => handleOpenReceivableCreate('') },
          ]}
        />
      </div>
    );

    return () => setModule(null);
  }, [
    embedInCrmHub,
    activeTab,
    salesFunnels,
    selectedFunnelId,
    showFilters,
    hasActiveContractFilters,
    activeFiltersCount,
    setModule,
  ]);

  return (
    <ModulePageShell className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <div className={`${MODULE_PAGE_GUTTER} pt-6 md:pt-8 flex-shrink-0 space-y-5`}>
        <ClientsHeader
          salesFunnels={salesFunnels}
          selectedFunnelId={selectedFunnelId}
          onFunnelChange={setSelectedFunnelId}
          showFunnelFilter={!embedInCrmHub && (activeTab === 'clients' || activeTab === 'contracts')}
          hideCreateActions={embedInCrmHub}
          activeTab={activeTab}
          onCreateClient={handleOpenClientCreate}
          onCreateContract={() => handleOpenContractCreate('')}
          onCreateSale={() => handleOpenOneTimeDealCreate('')}
          onCreateReceivable={() => handleOpenReceivableCreate('')}
          onFiltersClick={!embedInCrmHub && activeTab === 'contracts' ? () => setShowFilters(!showFilters) : undefined}
          showFilters={showFilters}
          hasActiveFilters={hasActiveContractFilters}
          activeFiltersCount={activeFiltersCount}
          tabs={<ClientsTabs activeTab={activeTab} onTabChange={setActiveTab} />}
        />
      </div>

      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <div className={`${MODULE_PAGE_GUTTER} mt-3 flex-1 min-h-0 flex flex-col overflow-hidden pb-4`}>
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar">
          {activeTab === 'clients' && (
            <ClientsTab
              clients={filteredClients}
              contracts={contracts}
              onEditClient={handleOpenClientEdit}
              onCreateContract={handleOpenContractCreate}
            />
          )}
          {activeTab === 'contracts' && (
            <ContractsTab
              contracts={filteredContracts}
              clients={clients}
              filters={contractFilters}
              showFilters={showFilters}
              onClearFilters={clearContractFilters}
              onEditContract={handleOpenContractEdit}
            />
          )}
          {activeTab === 'finance' && (
            <FinanceTab
              contracts={contracts}
              clients={clients}
              onOpenContractEdit={handleOpenContractEdit}
            />
          )}
          {activeTab === 'receivables' && (
            <ReceivablesTab
              receivables={filteredReceivables}
              clients={clients}
              onOpenReceivable={handleOpenReceivableEdit}
              onDeleteReceivable={onDeleteAccountsReceivable}
            />
          )}
          </div>
        </div>
      </div>
            
      {/* Modals */}
      <ClientModal
        isOpen={isClientModalOpen}
        editingClient={editingClient}
        contracts={contracts}
        oneTimeDeals={oneTimeDeals}
        onClose={() => setIsClientModalOpen(false)}
        onSave={(client) => {
          onSaveClient(client);
          setIsClientModalOpen(false);
        }}
        onDelete={onDeleteClient}
        onEditContract={handleOpenContractEdit}
        onEditOneTimeDeal={handleOpenOneTimeDealEdit}
      />

      <ContractModal
        isOpen={isContractModalOpen}
        editingContract={editingContract}
        targetClientId={targetClientId}
        clients={clients}
        onClose={() => setIsContractModalOpen(false)}
        onSave={(contract) => {
          onSaveContract(contract);
          setIsContractModalOpen(false);
        }}
      />

      {onSaveOneTimeDeal && (
        <OneTimeDealModal
          isOpen={isOneTimeDealModalOpen}
          editingDeal={editingOneTimeDeal}
          clientId={oneTimeDealClientId}
          clients={clients}
          onClose={() => setIsOneTimeDealModalOpen(false)}
          onSave={(deal) => {
            onSaveOneTimeDeal(deal);
            setIsOneTimeDealModalOpen(false);
          }}
          onDelete={onDeleteOneTimeDeal}
        />
      )}

      {onSaveAccountsReceivable && (
        <AccountsReceivableModal
          isOpen={isReceivableModalOpen}
          editingReceivable={editingReceivable}
          clientId={receivableClientId}
          clients={clients}
          deals={[...contracts, ...oneTimeDeals]} // Объединяем договоры и продажи
          onClose={() => setIsReceivableModalOpen(false)}
          onSave={handleSaveAccountsReceivable}
          onDelete={onDeleteAccountsReceivable}
        />
       )}
    </ModulePageShell>
  );
};

export default ClientsView;
