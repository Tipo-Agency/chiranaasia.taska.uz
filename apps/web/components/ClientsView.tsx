import React, { useState, useMemo, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { Client, Deal, Contract, OneTimeDeal, AccountsReceivable, SalesFunnel } from '../types';
import { FilterConfig } from './FiltersPanel';
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
} from './clients';
import {
  ModulePageShell,
  MODULE_PAGE_GUTTER,
  ModuleCreateDropdown,
  ModuleFilterIconButton,
  APP_TOOLBAR_MODULE_CLUSTER,
} from './ui';
import { TasksFilters } from './features/tasks/TasksFilters';
import { useAppToolbar } from '../contexts/AppToolbarContext';
import { AlertCircle, Briefcase, Building2, FileText } from 'lucide-react';
import { isFunnelDeal } from '../utils/dealModel';

type ClientsAreaTab = 'clients' | 'contracts' | 'receivables';

/** Сегмент / жизненный цикл (в т.ч. для фильтров в хабе CRM). */
type ClientLifecycleFilter = 'all' | 'in_progress' | 'active' | 'former' | 'potential';

interface ClientsViewProps {
  /** Сделки воронки — для фильтра «статус» в списке клиентов. */
  deals?: Deal[];
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
  /** Встроено в хаб CRM: кнопки в верхней панели приложения. */
  embedInCrmHub?: boolean;
  /** Подраздел из верхних вкладок CRM (без локальных вкладок «Клиенты / договоры …»). */
  crmHubSection?: ClientsAreaTab;
}

const ClientsView: React.FC<ClientsViewProps> = ({
  deals = [],
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
  crmHubSection,
}) => {
  const { setModule } = useAppToolbar();
  const [activeTab, setActiveTab] = useState<ClientsAreaTab>('clients');
  const [clientLifecycle, setClientLifecycle] = useState<ClientLifecycleFilter>('all');
  const [contractStatusFilter, setContractStatusFilter] = useState<string>('all');
  const [selectedFunnelId, setSelectedFunnelId] = useState<string>('');
  const [clientsFiltersOpen, setClientsFiltersOpen] = useState(false);
  const [contractsFiltersOpen, setContractsFiltersOpen] = useState(false);
  const [receivablesFiltersOpen, setReceivablesFiltersOpen] = useState(false);
  const [receivableClientIdFilter, setReceivableClientIdFilter] = useState('');

  const displayTab: ClientsAreaTab = crmHubSection ?? activeTab;

  useEffect(() => {
    if (crmHubSection) setActiveTab(crmHubSection);
  }, [crmHubSection]);

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

  const funnelDeals = useMemo(
    () => deals.filter((d) => isFunnelDeal(d) && !d.isArchived),
    [deals]
  );

  const clientIdsByDealPredicate = useCallback(
    (pred: (d: Deal) => boolean) => {
      const s = new Set<string>();
      for (const d of funnelDeals) {
        if (!d.clientId) continue;
        if (pred(d)) s.add(d.clientId);
      }
      return s;
    },
    [funnelDeals]
  );

  const inFunnelClientIds = useMemo(
    () => clientIdsByDealPredicate((d) => d.stage !== 'won' && d.stage !== 'lost'),
    [clientIdsByDealPredicate]
  );
  const wonClientIds = useMemo(() => clientIdsByDealPredicate((d) => d.stage === 'won'), [clientIdsByDealPredicate]);
  const lostClientIds = useMemo(() => clientIdsByDealPredicate((d) => d.stage === 'lost'), [clientIdsByDealPredicate]);

  const withContractClientIds = useMemo(() => {
    const s = new Set<string>();
    for (const c of contracts) {
      if (c.isArchived) continue;
      if (c.status === 'active' || c.status === 'pending') {
        if (c.clientId) s.add(c.clientId);
      }
    }
    return s;
  }, [contracts]);

  const oneTimeDealIdSet = useMemo(() => new Set(oneTimeDeals.map((d) => d.id)), [oneTimeDeals]);

  const combinedContractRows = useMemo(
    () => [...contracts, ...oneTimeDeals].filter((c) => !c.isArchived),
    [contracts, oneTimeDeals]
  );

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

  const clientsForTable = useMemo(() => {
    if (displayTab !== 'clients' || clientLifecycle === 'all') return filteredClients;
    return filteredClients.filter((c) => {
      const id = c.id;
      const inF = inFunnelClientIds.has(id);
      const won = wonClientIds.has(id);
      const lost = lostClientIds.has(id);
      const contract = withContractClientIds.has(id);
      switch (clientLifecycle) {
        case 'in_progress':
          return inF;
        case 'former':
          return lost && !inF;
        case 'active':
          return (won || contract) && !inF;
        case 'potential':
          return !inF && !won && !lost && !contract;
        default:
          return true;
      }
    });
  }, [
    displayTab,
    clientLifecycle,
    filteredClients,
    inFunnelClientIds,
    wonClientIds,
    lostClientIds,
    withContractClientIds,
  ]);

  const filteredContracts = useMemo(() => {
    return combinedContractRows.filter((c) => {
      if (selectedFunnelId && String(c.funnelId || '') !== String(selectedFunnelId)) return false;
      const matchesStatus = contractStatusFilter === 'all' || c.status === contractStatusFilter;
      return matchesStatus;
    });
  }, [combinedContractRows, contractStatusFilter, selectedFunnelId]);

  const filteredReceivables = useMemo(() => {
    let rows = accountsReceivable.filter((r) => !r.isArchived);
    if (receivableClientIdFilter) rows = rows.filter((r) => r.clientId === receivableClientIdFilter);
    return rows;
  }, [accountsReceivable, receivableClientIdFilter]);

  const clientHubFilters: FilterConfig[] = useMemo(() => {
    const funnelOpts = [
      { value: '', label: 'Все воронки' },
      ...salesFunnels.map((f) => ({ value: f.id, label: f.name })),
    ];
    const lifecycleOpts: { value: ClientLifecycleFilter; label: string }[] = [
      { value: 'all', label: 'Все' },
      { value: 'in_progress', label: 'В работе' },
      { value: 'active', label: 'Активный клиент' },
      { value: 'former', label: 'Бывший клиент' },
      { value: 'potential', label: 'Потенциальный' },
    ];
    return [
      ...(salesFunnels.length
        ? [
            {
              label: 'Воронка',
              value: selectedFunnelId,
              onChange: (v: string) => setSelectedFunnelId(v),
              options: funnelOpts,
            },
          ]
        : []),
      {
        label: 'Статус клиента',
        value: clientLifecycle,
        onChange: (v: string) => setClientLifecycle(v as ClientLifecycleFilter),
        options: lifecycleOpts,
      },
    ];
  }, [salesFunnels, selectedFunnelId, clientLifecycle]);

  const hasActiveClientFilters = useMemo(
    () => Boolean(selectedFunnelId) || clientLifecycle !== 'all',
    [selectedFunnelId, clientLifecycle]
  );

  const clearClientFilters = useCallback(() => {
    setSelectedFunnelId('');
    setClientLifecycle('all');
  }, []);

  const activeClientFiltersCount = useMemo(
    () => clientHubFilters.filter((f) => f.value !== '' && f.value !== 'all').length,
    [clientHubFilters]
  );

  const contractFilters: FilterConfig[] = useMemo(() => {
    const funnelOpts = [
      { value: '', label: 'Все воронки' },
      ...salesFunnels.map((f) => ({ value: f.id, label: f.name })),
    ];
    return [
      ...(salesFunnels.length
        ? [
            {
              label: 'Воронка',
              value: selectedFunnelId,
              onChange: (v: string) => setSelectedFunnelId(v),
              options: funnelOpts,
            },
          ]
        : []),
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
    ];
  }, [contractStatusFilter, selectedFunnelId, salesFunnels]);

  const hasActiveContractFilters = useMemo(
    () => contractStatusFilter !== 'all' || Boolean(selectedFunnelId),
    [contractStatusFilter, selectedFunnelId]
  );

  const clearContractFilters = useCallback(() => {
    setContractStatusFilter('all');
    setSelectedFunnelId('');
  }, []);

  const activeContractFiltersCount = useMemo(
    () =>
      contractFilters.filter((f) => {
        const v = f.value;
        return v !== undefined && v !== null && String(v) !== '' && v !== 'all';
      }).length,
    [contractFilters]
  );

  const receivableFilters: FilterConfig[] = useMemo(
    () => [
      {
        label: 'Клиент',
        value: receivableClientIdFilter,
        onChange: setReceivableClientIdFilter,
        options: [
          { value: '', label: 'Все клиенты' },
          ...clients
            .filter((c) => !c.isArchived)
            .map((c) => ({ value: c.id, label: c.name || c.id })),
        ],
      },
    ],
    [receivableClientIdFilter, clients]
  );

  const hasActiveReceivableFilters = useMemo(() => Boolean(receivableClientIdFilter), [receivableClientIdFilter]);

  const activeReceivableFiltersCount = useMemo(() => (hasActiveReceivableFilters ? 1 : 0), [hasActiveReceivableFilters]);

  const clearReceivableFilters = useCallback(() => {
    setReceivableClientIdFilter('');
  }, []);

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

  const handleSaveAccountsReceivable = (receivables: AccountsReceivable[]) => {
    if (!onSaveAccountsReceivable) return;
    receivables.forEach((receivable) => {
      onSaveAccountsReceivable(receivable);
    });
  };

  const hubModalOpenRef = useRef({
    openClient: handleOpenClientCreate,
    openContract: handleOpenContractCreate,
    openOneTime: handleOpenOneTimeDealCreate,
    openReceivable: handleOpenReceivableCreate,
  });
  hubModalOpenRef.current = {
    openClient: handleOpenClientCreate,
    openContract: handleOpenContractCreate,
    openOneTime: handleOpenOneTimeDealCreate,
    openReceivable: handleOpenReceivableCreate,
  };

  useEffect(() => {
    const onOpen = (event: Event) => {
      const kind = (event as CustomEvent<{ kind?: string }>).detail?.kind;
      const h = hubModalOpenRef.current;
      if (kind === 'client') h.openClient();
      else if (kind === 'contract') h.openContract('');
      else if (kind === 'sale') h.openOneTime('');
      else if (kind === 'receivable') h.openReceivable('');
    };
    window.addEventListener('clients:openModal', onOpen as EventListener);
    return () => window.removeEventListener('clients:openModal', onOpen as EventListener);
  }, []);

  useLayoutEffect(() => {
    if (!embedInCrmHub) return;

    const createItems =
      displayTab === 'clients'
        ? [{ id: 'create-client', label: 'Клиент', icon: Building2, onClick: handleOpenClientCreate }]
        : displayTab === 'contracts'
          ? [
              { id: 'create-contract', label: 'Договор', icon: FileText, onClick: () => handleOpenContractCreate('') },
              { id: 'create-sale', label: 'Продажа', icon: Briefcase, onClick: () => handleOpenOneTimeDealCreate('') },
            ]
          : [
              {
                id: 'create-receivable',
                label: 'Задолженность',
                icon: AlertCircle,
                onClick: () => handleOpenReceivableCreate(''),
              },
            ];

    setModule(
      <div className={APP_TOOLBAR_MODULE_CLUSTER}>
        {displayTab === 'clients' && (
          <ModuleFilterIconButton
            accent="violet"
            size="sm"
            active={clientsFiltersOpen || hasActiveClientFilters}
            activeCount={activeClientFiltersCount}
            onClick={() => setClientsFiltersOpen((v) => !v)}
            label="Фильтры"
          />
        )}
        {displayTab === 'contracts' && (
          <ModuleFilterIconButton
            accent="violet"
            size="sm"
            active={contractsFiltersOpen || hasActiveContractFilters}
            activeCount={activeContractFiltersCount}
            onClick={() => setContractsFiltersOpen((v) => !v)}
            label="Фильтры"
          />
        )}
        {displayTab === 'receivables' && (
          <ModuleFilterIconButton
            accent="violet"
            size="sm"
            active={receivablesFiltersOpen || hasActiveReceivableFilters}
            activeCount={activeReceivableFiltersCount}
            onClick={() => setReceivablesFiltersOpen((v) => !v)}
            label="Фильтры"
          />
        )}
        <ModuleCreateDropdown accent="violet" buttonSize="sm" label="Создать" items={createItems} />
      </div>
    );

    return () => setModule(null);
  }, [
    embedInCrmHub,
    displayTab,
    clientsFiltersOpen,
    contractsFiltersOpen,
    receivablesFiltersOpen,
    hasActiveClientFilters,
    activeClientFiltersCount,
    hasActiveContractFilters,
    activeContractFiltersCount,
    hasActiveReceivableFilters,
    activeReceivableFiltersCount,
    setModule,
  ]);

  return (
    <ModulePageShell className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {!embedInCrmHub && (
        <div className={`${MODULE_PAGE_GUTTER} pt-6 md:pt-8 flex-shrink-0 space-y-5`}>
          <ClientsHeader
            salesFunnels={salesFunnels}
            selectedFunnelId={selectedFunnelId}
            onFunnelChange={setSelectedFunnelId}
            showFunnelFilter={false}
            hideCreateActions={false}
            activeTab={displayTab}
            onCreateClient={handleOpenClientCreate}
            onCreateContract={() => handleOpenContractCreate('')}
            onCreateSale={() => handleOpenOneTimeDealCreate('')}
            onCreateReceivable={() => handleOpenReceivableCreate('')}
            onFiltersClick={
              displayTab === 'clients'
                ? () => setClientsFiltersOpen((v) => !v)
                : displayTab === 'contracts'
                  ? () => setContractsFiltersOpen((v) => !v)
                  : displayTab === 'receivables'
                    ? () => setReceivablesFiltersOpen((v) => !v)
                    : undefined
            }
            showFilters={
              (displayTab === 'clients' && clientsFiltersOpen) ||
              (displayTab === 'contracts' && contractsFiltersOpen) ||
              (displayTab === 'receivables' && receivablesFiltersOpen)
            }
            hasActiveFilters={
              displayTab === 'clients'
                ? hasActiveClientFilters
                : displayTab === 'contracts'
                  ? hasActiveContractFilters
                  : displayTab === 'receivables'
                    ? hasActiveReceivableFilters
                    : false
            }
            activeFiltersCount={
              displayTab === 'clients'
                ? activeClientFiltersCount
                : displayTab === 'contracts'
                  ? activeContractFiltersCount
                  : displayTab === 'receivables'
                    ? activeReceivableFiltersCount
                    : 0
            }
            tabs={crmHubSection ? undefined : <ClientsTabs activeTab={displayTab} onTabChange={setActiveTab} />}
          />
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <div
          className={`${MODULE_PAGE_GUTTER} ${embedInCrmHub ? 'pt-4 md:pt-6' : 'mt-3'} flex-1 min-h-0 flex flex-col overflow-hidden pb-4`}
        >
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar">
            {displayTab === 'clients' && (
              <>
                {clientsFiltersOpen && (
                  <TasksFilters filters={clientHubFilters} onClear={clearClientFilters} className="mb-4" />
                )}
                <ClientsTab
                  clients={clientsForTable}
                  contracts={contracts}
                  onEditClient={handleOpenClientEdit}
                  onCreateContract={handleOpenContractCreate}
                />
              </>
            )}
            {displayTab === 'contracts' && (
              <ContractsTab
                contracts={filteredContracts}
                clients={clients}
                filters={contractFilters}
                showFilters={contractsFiltersOpen}
                onClearFilters={clearContractFilters}
                onEditContract={handleOpenContractEdit}
                isOneTimeDeal={(id) => oneTimeDealIdSet.has(id)}
                onEditOneTimeDeal={handleOpenOneTimeDealEdit}
              />
            )}
            {displayTab === 'receivables' && (
              <ReceivablesTab
                receivables={filteredReceivables}
                clients={clients}
                filters={receivableFilters}
                showFilters={receivablesFiltersOpen}
                onClearFilters={clearReceivableFilters}
                onOpenReceivable={handleOpenReceivableEdit}
                onDeleteReceivable={onDeleteAccountsReceivable}
              />
            )}
          </div>
        </div>
      </div>

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
          deals={[...contracts, ...oneTimeDeals]}
          onClose={() => setIsReceivableModalOpen(false)}
          onSave={handleSaveAccountsReceivable}
          onDelete={onDeleteAccountsReceivable}
        />
      )}
    </ModulePageShell>
  );
};

export default ClientsView;
