/**
 * ClientsPage — отдельная композиция (поиск по API клиентов + вкладки).
 */
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Client, Deal, AccountsReceivable, SalesFunnel } from '../../types';
import { api } from '../../backend/api';
import { clientFromApi } from '../../services/apiClient';
import { PageLayout } from '../ui/PageLayout';
import { Container } from '../ui/Container';
import { FilterConfig } from '../FiltersPanel';
import {
  ClientsHeader,
  ClientsTabs,
  ClientsTab,
  ContractsTab,
  ReceivablesTab,
  ClientModal,
  ContractModal,
  OneTimeDealModal,
  AccountsReceivableModal,
} from '../clients';

interface ClientsPageProps {
  clients: Client[];
  contracts: Deal[];
  oneTimeDeals?: Deal[];
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

export const ClientsPage: React.FC<ClientsPageProps> = ({
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
  const [activeTab, setActiveTab] = useState<'clients' | 'contracts' | 'receivables'>('clients');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [serverClientHits, setServerClientHits] = useState<Client[] | null>(null);
  const [clientSearchLoading, setClientSearchLoading] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => window.clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    const q = debouncedSearch.trim();
    if (!q) {
      setServerClientHits(null);
      setClientSearchLoading(false);
      return;
    }
    let cancelled = false;
    setClientSearchLoading(true);
    void (async () => {
      try {
        const page = await api.clients.list({
          search: q,
          limit: 200,
          is_archived: false,
        });
        if (!cancelled) {
          setServerClientHits((page.items ?? []).map((row) => clientFromApi(row as Record<string, unknown>)));
        }
      } catch {
        if (!cancelled) setServerClientHits([]);
      } finally {
        if (!cancelled) setClientSearchLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch]);

  const [contractStatusFilter, setContractStatusFilter] = useState<string>('all');
  const [selectedFunnelId, setSelectedFunnelId] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

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

  const filteredClients = useMemo(() => {
    if (!clients || !Array.isArray(clients)) {
      return [];
    }
    const activeClients = clients.filter((c) => c && !c.isArchived);
    const q = debouncedSearch.trim();
    if (!q) return activeClients;
    if (clientSearchLoading && serverClientHits === null) return [];
    return serverClientHits ?? [];
  }, [clients, debouncedSearch, serverClientHits, clientSearchLoading]);

  const filteredContracts = useMemo(() => {
    if (!contracts || !Array.isArray(contracts)) {
      return [];
    }
    const activeContracts = contracts.filter((c) => c && !c.isArchived);
    return activeContracts.filter((c) => {
      if (selectedFunnelId && c.funnelId !== selectedFunnelId) return false;

      const matchesSearch =
        !debouncedSearch.trim() ||
        (c.number && c.number.includes(debouncedSearch)) ||
        clients.some(
          (cl) =>
            cl &&
            cl.id === c.clientId &&
            cl.name &&
            cl.name.toLowerCase().includes(debouncedSearch.toLowerCase())
        );

      const matchesStatus = contractStatusFilter === 'all' || c.status === contractStatusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [contracts, clients, debouncedSearch, contractStatusFilter, selectedFunnelId]);

  const contractFilters: FilterConfig[] = useMemo(
    () => [
      {
        label: 'Статус',
        value: contractStatusFilter,
        onChange: setContractStatusFilter,
        options: [
          { value: 'all', label: 'Все статусы' },
          { value: 'active', label: 'Активен' },
          { value: 'pending', label: 'Ожидание' },
          { value: 'completed', label: 'Закрыт' },
        ],
      },
    ],
    [contractStatusFilter]
  );

  const hasActiveContractFilters = useMemo(() => contractStatusFilter !== 'all', [contractStatusFilter]);

  const clearContractFilters = useCallback(() => {
    setContractStatusFilter('all');
  }, []);

  const activeFiltersCount = useMemo(
    () => contractFilters.filter((f) => f.value && f.value !== 'all' && f.value !== '').length,
    [contractFilters]
  );

  const handleCreateClient = () => {
    setEditingClient(null);
    setIsClientModalOpen(true);
  };

  const handleEditClient = (client: Client) => {
    setEditingClient(client);
    setIsClientModalOpen(true);
  };

  const handleSaveClient = (client: Client) => {
    onSaveClient(client);
    setIsClientModalOpen(false);
    setEditingClient(null);
  };

  const handleCreateContract = (clientId?: string) => {
    setEditingContract(null);
    setTargetClientId(clientId || '');
    setIsContractModalOpen(true);
  };

  const handleEditContract = (contract: Deal) => {
    setEditingContract(contract);
    setTargetClientId(contract.clientId);
    setIsContractModalOpen(true);
  };

  const handleSaveContract = (deal: Deal) => {
    onSaveContract(deal);
    setIsContractModalOpen(false);
    setEditingContract(null);
    setTargetClientId('');
  };

  const handleCreateOneTimeDeal = (clientId?: string) => {
    setEditingOneTimeDeal(null);
    setOneTimeDealClientId(clientId || '');
    setIsOneTimeDealModalOpen(true);
  };

  const handleEditOneTimeDeal = (deal: Deal) => {
    setEditingOneTimeDeal(deal);
    setOneTimeDealClientId(deal.clientId);
    setIsOneTimeDealModalOpen(true);
  };

  const handleSaveOneTimeDeal = (deal: Deal) => {
    if (onSaveOneTimeDeal) {
      onSaveOneTimeDeal(deal);
    }
    setIsOneTimeDealModalOpen(false);
    setEditingOneTimeDeal(null);
    setOneTimeDealClientId('');
  };

  const handleCreateReceivable = (clientId?: string) => {
    setEditingReceivable(null);
    setReceivableClientId(clientId || '');
    setIsReceivableModalOpen(true);
  };

  const handleEditReceivable = (receivable: AccountsReceivable) => {
    setEditingReceivable(receivable);
    setReceivableClientId(receivable.clientId);
    setIsReceivableModalOpen(true);
  };

  const handleSaveReceivableBatch = (rows: AccountsReceivable[]) => {
    if (!onSaveAccountsReceivable) return;
    rows.forEach((r) => onSaveAccountsReceivable(r));
    setIsReceivableModalOpen(false);
    setEditingReceivable(null);
    setReceivableClientId('');
  };

  return (
    <PageLayout>
      <Container safeArea className="py-4 flex flex-col flex-1">
        <ClientsHeader
          embedSearch={{ value: searchQuery, onChange: setSearchQuery, placeholder: 'Поиск клиентов…' }}
          salesFunnels={salesFunnels}
          selectedFunnelId={selectedFunnelId}
          onFunnelChange={setSelectedFunnelId}
          showFunnelFilter={activeTab === 'clients' || activeTab === 'contracts'}
          activeTab={activeTab}
          onCreateClient={handleCreateClient}
          onCreateContract={() => handleCreateContract()}
          onCreateSale={() => handleCreateOneTimeDeal()}
          onCreateReceivable={() => handleCreateReceivable()}
          onFiltersClick={activeTab === 'contracts' ? () => setShowFilters((v) => !v) : undefined}
          showFilters={showFilters}
          hasActiveFilters={hasActiveContractFilters}
          activeFiltersCount={activeFiltersCount}
          tabs={<ClientsTabs activeTab={activeTab} onTabChange={setActiveTab} />}
        />

        {activeTab === 'clients' && (
          <ClientsTab
            clients={filteredClients}
            contracts={contracts || []}
            onEditClient={handleEditClient}
            onCreateContract={handleCreateContract}
          />
        )}

        {activeTab === 'contracts' && (
          <ContractsTab
            contracts={filteredContracts}
            clients={clients}
            filters={contractFilters}
            showFilters={showFilters}
            onClearFilters={clearContractFilters}
            onEditContract={handleEditContract}
          />
        )}

        {activeTab === 'receivables' && (
          <ReceivablesTab
            receivables={accountsReceivable || []}
            clients={clients}
            onOpenReceivable={handleEditReceivable}
            onDeleteReceivable={onDeleteAccountsReceivable}
          />
        )}

        <ClientModal
          isOpen={isClientModalOpen}
          editingClient={editingClient}
          contracts={contracts}
          oneTimeDeals={oneTimeDeals}
          onClose={() => {
            setIsClientModalOpen(false);
            setEditingClient(null);
          }}
          onSave={handleSaveClient}
          onDelete={onDeleteClient}
          onEditContract={handleEditContract}
          onEditOneTimeDeal={handleEditOneTimeDeal}
        />

        <ContractModal
          isOpen={isContractModalOpen}
          editingContract={editingContract}
          targetClientId={targetClientId}
          clients={clients}
          onClose={() => {
            setIsContractModalOpen(false);
            setEditingContract(null);
            setTargetClientId('');
          }}
          onSave={handleSaveContract}
        />

        {onSaveOneTimeDeal && (
          <OneTimeDealModal
            isOpen={isOneTimeDealModalOpen}
            editingDeal={editingOneTimeDeal}
            clientId={oneTimeDealClientId}
            clients={clients}
            onClose={() => {
              setIsOneTimeDealModalOpen(false);
              setEditingOneTimeDeal(null);
              setOneTimeDealClientId('');
            }}
            onSave={handleSaveOneTimeDeal}
            onDelete={onDeleteOneTimeDeal}
          />
        )}

        {onSaveAccountsReceivable && (
          <AccountsReceivableModal
            isOpen={isReceivableModalOpen}
            editingReceivable={editingReceivable}
            clientId={receivableClientId}
            clients={clients}
            deals={[...contracts, ...oneTimeDeals]}
            onClose={() => {
              setIsReceivableModalOpen(false);
              setEditingReceivable(null);
              setReceivableClientId('');
            }}
            onSave={handleSaveReceivableBatch}
            onDelete={onDeleteAccountsReceivable}
          />
        )}
      </Container>
    </PageLayout>
  );
};
