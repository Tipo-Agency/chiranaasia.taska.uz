import React, { useLayoutEffect, useMemo } from 'react';
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
import { ModuleSegmentedControl } from '../ui';
import { CRMModule } from './CRMModule';
import { ClientChatsPage } from '../pages/ClientChatsPage';

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
      {options.length > 1 && (
        <div className="shrink-0 border-b border-gray-200 dark:border-[#333] px-4 py-3 md:px-6">
          <ModuleSegmentedControl
            variant="neutral"
            value={effectiveTab}
            onChange={(v) => onTabChange(v as CrmHubTab)}
            options={options}
          />
        </div>
      )}
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
