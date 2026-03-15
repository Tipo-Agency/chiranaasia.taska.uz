import React, { useState, useMemo, useCallback } from 'react';
import { Client, Deal, AccountsReceivable, SalesFunnel } from '../types';
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

interface ClientsViewProps {
  clients: Client[];
  contracts: Deal[]; // Договоры (recurring: true)
  oneTimeDeals?: Deal[]; // Продажи (recurring: false)
  accountsReceivable?: AccountsReceivable[];
  salesFunnels?: SalesFunnel[];
  onSaveClient: (client: Client) => void;
  onDeleteClient: (id: string) => void;
  onSaveContract: (deal: Deal) => void;
  onDeleteContract: (id: string) => void;
  onSaveOneTimeDeal?: (deal: Deal) => void;
  onDeleteOneTimeDeal?: (id: string) => void;
  onSaveAccountsReceivable?: (receivable: AccountsReceivable) => void;
  onDeleteAccountsReceivable?: (id: string) => void;
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
}) => {
  const [activeTab, setActiveTab] = useState<'clients' | 'contracts' | 'finance' | 'receivables'>('clients');
  const [searchQuery, setSearchQuery] = useState('');
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
    const activeClients = clients.filter(c => !c.isArchived);
    let filtered = activeClients;
    
    if (selectedFunnelId) {
      filtered = filtered.filter(c => c.funnelId === selectedFunnelId);
    }
    
    if (searchQuery) {
    const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c => c.name.toLowerCase().includes(query));
    }
    
    return filtered;
  }, [clients, searchQuery, selectedFunnelId]);

  const filteredContracts = useMemo(() => {
    const activeContracts = contracts.filter(c => !c.isArchived);
    return activeContracts.filter(c => {
      if (selectedFunnelId && c.funnelId !== selectedFunnelId) return false;
      
      const matchesSearch = !searchQuery || 
        c.number.includes(searchQuery) || 
        clients.some(cl => cl.id === c.clientId && cl.name.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesStatus = contractStatusFilter === 'all' || c.status === contractStatusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [contracts, clients, searchQuery, contractStatusFilter, selectedFunnelId]);

  const filteredReceivables = useMemo(() => {
    const activeReceivables = accountsReceivable.filter(r => !r.isArchived);
    if (!searchQuery) return activeReceivables;
    const query = searchQuery.toLowerCase();
    return activeReceivables.filter(r => {
      const client = clients.find(c => c.id === r.clientId);
      return client?.name.toLowerCase().includes(query) || 
             r.description?.toLowerCase().includes(query) ||
             r.amount.toString().includes(query);
    });
  }, [accountsReceivable, clients, searchQuery]);

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

  // Handler for create button - depends on active tab
  const handleCreateClick = () => {
    if (activeTab === 'clients') {
      handleOpenClientCreate();
    } else if (activeTab === 'contracts') {
      handleOpenContractCreate('');
    } else if (activeTab === 'finance') {
      // Finance tab doesn't have create functionality
    } else if (activeTab === 'receivables') {
      handleOpenReceivableCreate('');
    }
  };

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

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="max-w-7xl mx-auto w-full pt-8 px-6 flex-shrink-0">
        <ClientsHeader
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          salesFunnels={salesFunnels}
          selectedFunnelId={selectedFunnelId}
          onFunnelChange={setSelectedFunnelId}
          showFunnelFilter={activeTab === 'clients' || activeTab === 'contracts'}
          activeTab={activeTab}
          onCreateClick={handleCreateClick}
          onFiltersClick={activeTab === 'contracts' ? () => setShowFilters(!showFilters) : undefined}
          showFilters={showFilters}
          hasActiveFilters={hasActiveContractFilters}
          activeFiltersCount={activeFiltersCount}
        />

        <ClientsTabs activeTab={activeTab} onTabChange={setActiveTab} />
                </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="max-w-7xl mx-auto w-full px-6 pb-24 md:pb-32 h-full overflow-y-auto overflow-x-hidden custom-scrollbar">
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
              onDeleteReceivable={onDeleteAccountsReceivable}
            />
                    )}
                </div>
            </div>
            
      {/* Modals */}
      <ClientModal
        isOpen={isClientModalOpen}
        editingClient={editingClient}
        salesFunnels={salesFunnels}
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
    </div>
  );
};

export default ClientsView;
