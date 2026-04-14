/**
 * ClientsPage - страница клиентов (рефакторенная версия)
 * 
 * Зачем отдельно:
 * - Только композиция компонентов
 * - Не содержит бизнес-логику
 * - Использует переиспользуемые компоненты
 */
import React, { useState, useMemo, useEffect } from 'react';
import { Client, Deal, AccountsReceivable, SalesFunnel } from '../../types';
import { api } from '../../backend/api';
import { clientFromApi } from '../../services/apiClient';
import { PageLayout } from '../ui/PageLayout';
import { Container } from '../ui/Container';
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
} from '../clients';

interface ClientsPageProps {
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
  const [activeTab, setActiveTab] = useState<'clients' | 'contracts' | 'finance' | 'receivables'>('clients');
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
          setServerClientHits(
            (page.items ?? []).map((row) => clientFromApi(row as Record<string, unknown>))
          );
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
    const activeContracts = contracts.filter(c => c && !c.isArchived);
    return activeContracts.filter(c => {
      if (selectedFunnelId && c.funnelId !== selectedFunnelId) return false;
      
      const matchesSearch = !debouncedSearch.trim() ||
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

  const handleSaveReceivable = (receivable: AccountsReceivable) => {
    if (onSaveAccountsReceivable) {
      onSaveAccountsReceivable(receivable);
    }
    setIsReceivableModalOpen(false);
    setEditingReceivable(null);
    setReceivableClientId('');
  };

  return (
    <PageLayout>
      <Container safeArea className="py-4 flex flex-col flex-1">
        <ClientsHeader
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          showFilters={showFilters}
          onToggleFilters={() => setShowFilters(!showFilters)}
          onCreateClick={handleCreateClient}
          selectedFunnelId={selectedFunnelId}
          onFunnelChange={setSelectedFunnelId}
          salesFunnels={salesFunnels}
          activeTab={activeTab}
        />
        
        <ClientsTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
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
            contractStatusFilter={contractStatusFilter}
            onStatusFilterChange={setContractStatusFilter}
            onEditContract={handleEditContract}
            onDeleteContract={onDeleteContract}
          />
        )}

        {activeTab === 'finance' && (
          <FinanceTab
            contracts={contracts || []}
            clients={clients || []}
            onOpenContractEdit={handleEditContract}
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

        {/* Modals */}
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
        />

        <ContractModal
          isOpen={isContractModalOpen}
          onClose={() => {
            setIsContractModalOpen(false);
            setEditingContract(null);
            setTargetClientId('');
          }}
          contract={editingContract}
          onSave={handleSaveContract}
          clients={clients}
          targetClientId={targetClientId}
          salesFunnels={salesFunnels}
        />

        <OneTimeDealModal
          isOpen={isOneTimeDealModalOpen}
          onClose={() => {
            setIsOneTimeDealModalOpen(false);
            setEditingOneTimeDeal(null);
            setOneTimeDealClientId('');
          }}
          deal={editingOneTimeDeal}
          onSave={handleSaveOneTimeDeal}
          clients={clients}
          targetClientId={oneTimeDealClientId}
          salesFunnels={salesFunnels}
        />

        <AccountsReceivableModal
          isOpen={isReceivableModalOpen}
          onClose={() => {
            setIsReceivableModalOpen(false);
            setEditingReceivable(null);
            setReceivableClientId('');
          }}
          receivable={editingReceivable}
          onSave={handleSaveReceivable}
          clients={clients}
          contracts={contracts}
          oneTimeDeals={oneTimeDeals}
          targetClientId={receivableClientId}
        />
      </Container>
    </PageLayout>
  );
};
