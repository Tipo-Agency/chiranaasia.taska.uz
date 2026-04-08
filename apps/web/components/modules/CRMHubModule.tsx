import React, { useEffect, useLayoutEffect, useMemo } from 'react';
import {
  Deal,
  Client,
  Contract,
  User,
  Project,
  Task,
  OneTimeDeal,
  AccountsReceivable,
  Meeting,
  SalesFunnel,
} from '../../types';
import type { AppActions } from '../../frontend/hooks/useAppLogic';
import { hasPermission } from '../../utils/permissions';
import { CRMModule } from './CRMModule';
import { ClientChatsPage } from '../pages/ClientChatsPage';
import { useAppToolbar } from '../../contexts/AppToolbarContext';

export type CrmHubTab = 'funnel' | 'chats' | 'clients' | 'rejected';

interface CRMHubModuleProps {
  tab: CrmHubTab;
  onTabChange: (tab: CrmHubTab) => void;
  currentUser: User;
  deals: Deal[];
  clients: Client[];
  contracts: Contract[];
  oneTimeDeals?: OneTimeDeal[];
  accountsReceivable?: AccountsReceivable[];
  users: User[];
  salesFunnels?: SalesFunnel[];
  projects?: Project[];
  tasks?: Task[];
  meetings?: Meeting[];
  actions: AppActions;
}

export const CRMHubModule: React.FC<CRMHubModuleProps> = ({
  tab,
  onTabChange,
  currentUser,
  deals,
  clients,
  contracts,
  oneTimeDeals = [],
  accountsReceivable = [],
  users,
  salesFunnels = [],
  projects,
  tasks = [],
  meetings = [],
  actions,
}) => {
  const { setLeading } = useAppToolbar();
  const canFunnel = hasPermission(currentUser, 'crm.sales_funnel');
  const canChats = hasPermission(currentUser, 'crm.client_chats');
  const canClients = hasPermission(currentUser, 'crm.clients');

  const options = useMemo(() => {
    const o: { value: CrmHubTab; label: string }[] = [];
    if (canFunnel) o.push({ value: 'funnel', label: 'Воронка' });
    if (canChats) o.push({ value: 'chats', label: 'Диалоги' });
    if (canClients) o.push({ value: 'clients', label: 'Клиенты и договора' });
    if (canFunnel) o.push({ value: 'rejected', label: 'Отказы' });
    return o;
  }, [canFunnel, canChats, canClients]);

  const effectiveTab: CrmHubTab = useMemo(() => {
    if (options.some((x) => x.value === tab)) return tab;
    return options[0]?.value || 'funnel';
  }, [options, tab]);

  useLayoutEffect(() => {
    if (!options.length) return;
    if (tab !== effectiveTab) onTabChange(effectiveTab);
  }, [options.length, tab, effectiveTab, onTabChange]);

  /** Создание сущностей из шапки воронки — переключаем на «Клиенты» и открываем нужную модалку */
  useEffect(() => {
    const onHubCreate = (event: Event) => {
      const t = (event as CustomEvent<{ type?: string }>).detail?.type;
      if (!t || t === 'deal') return;
      onTabChange('clients');
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent('clients:openModal', { detail: { kind: t } }));
      }, 100);
    };
    window.addEventListener('crmHub:createEntity', onHubCreate as EventListener);
    return () => window.removeEventListener('crmHub:createEntity', onHubCreate as EventListener);
  }, [onTabChange]);

  useLayoutEffect(() => {
    if (options.length <= 1) {
      setLeading(null);
      return () => setLeading(null);
    }
    const activeBox = 'bg-[#3337AD] text-white shadow-sm';
    const idleBox = 'text-gray-600 dark:text-gray-400';
    setLeading(
      <div className="flex items-center gap-0.5 sm:gap-1 shrink-0 flex-wrap sm:flex-nowrap" role="tablist" aria-label="CRM">
        {options.map((o) => {
          const active = effectiveTab === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onTabChange(o.value)}
              className={`px-2 sm:px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                active ? activeBox : `${idleBox} hover:bg-gray-100 dark:hover:bg-[#252525]`
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    );
    return () => setLeading(null);
  }, [options, effectiveTab, onTabChange, setLeading]);

  const sharedCrm = {
    deals,
    clients,
    contracts,
    oneTimeDeals,
    accountsReceivable,
    users,
    salesFunnels,
    projects,
    tasks,
    meetings,
    currentUser,
    actions,
  };

  if (!options.length) {
    return (
      <div className="h-full flex items-center justify-center p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
        Нет доступа к разделам воронки и CRM.
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 flex flex-col bg-white dark:bg-[#191919]">
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {effectiveTab === 'funnel' && canFunnel && <CRMModule view="sales-funnel" {...sharedCrm} />}
        {effectiveTab === 'chats' && canChats && (
          <ClientChatsPage
            layout="embedded"
            deals={deals}
            users={users}
            currentUser={currentUser}
            salesFunnels={salesFunnels}
            onSaveDeal={actions.saveDeal}
            onOpenInFunnel={(deal) => {
              onTabChange('funnel');
              window.setTimeout(() => {
                window.dispatchEvent(new CustomEvent('openDealFromChat', { detail: { dealId: deal.id } }));
              }, 0);
            }}
          />
        )}
        {effectiveTab === 'clients' && canClients && <CRMModule view="clients" embedInCrmHub {...sharedCrm} />}
        {effectiveTab === 'rejected' && canFunnel && <CRMModule view="sales-funnel" forcedFunnelViewMode="rejected" {...sharedCrm} />}
      </div>
    </div>
  );
};
