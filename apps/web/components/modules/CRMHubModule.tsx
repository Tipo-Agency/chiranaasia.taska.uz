import React, { useLayoutEffect, useMemo } from 'react';
import { BarChart3, Briefcase, MessageCircle } from 'lucide-react';
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

export type CrmHubTab = 'funnel' | 'chats' | 'clients';

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

  useLayoutEffect(() => {
    if (options.length <= 1) {
      setLeading(null);
      return () => setLeading(null);
    }
    const activeBox = 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300';
    const idleBox = 'text-gray-500 dark:text-gray-400';
    setLeading(
      <div className="flex items-center gap-1 shrink-0" role="tablist" aria-label="CRM">
        {options.map((o) => {
          const active = effectiveTab === o.value;
          const icon =
            o.value === 'funnel' ? (
              <BarChart3 size={17} />
            ) : o.value === 'chats' ? (
              <MessageCircle size={17} />
            ) : (
              <Briefcase size={17} />
            );
          return (
            <button
              key={o.value}
              type="button"
              role="tab"
              aria-selected={active}
              title={o.label}
              onClick={() => onTabChange(o.value)}
              className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                active ? activeBox : idleBox + ' hover:bg-gray-100 dark:hover:bg-[#252525]'
              }`}
            >
              {icon}
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
        {effectiveTab === 'clients' && canClients && <CRMModule view="clients" {...sharedCrm} />}
      </div>
    </div>
  );
};
