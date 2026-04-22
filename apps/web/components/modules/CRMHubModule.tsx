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
  type CrmHubTab,
  type PurchaseRequest,
  type Department,
  type FinanceCategory,
} from '../../types';
import type { AppActions } from '../../frontend/hooks/useAppLogic';
import { hasPermission } from '../../utils/permissions';
import { CRMModule } from './CRMModule';
import { CrmHubRequestsPanel } from './CrmHubRequestsPanel';
import { useAppToolbar } from '../../contexts/AppToolbarContext';
import { MODULE_ACCENTS, MODULE_TOOLBAR_TAB_IDLE } from '../ui/moduleAccent';

interface CRMHubModuleProps {
  tab: CrmHubTab;
  onTabChange: (tab: CrmHubTab) => void;
  /** Строка поиска в шапке — фильтр сделок на вкладке «Воронка». */
  headerSearchQuery?: string;
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
  purchaseRequests?: PurchaseRequest[];
  departments?: Department[];
  financeCategories?: FinanceCategory[];
  actions: AppActions;
}

export const CRMHubModule: React.FC<CRMHubModuleProps> = ({
  tab,
  onTabChange,
  headerSearchQuery = '',
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
  purchaseRequests = [],
  departments = [],
  financeCategories = [],
  actions,
}) => {
  const { setLeading } = useAppToolbar();
  const canFunnel = hasPermission(currentUser, 'crm.sales_funnel');
  const canClients = hasPermission(currentUser, 'crm.clients');

  const options = useMemo(() => {
    const o: { value: CrmHubTab; label: string }[] = [];
    if (canFunnel) {
      o.push({ value: 'funnel', label: 'Воронка' });
      o.push({ value: 'requests', label: 'Заявки' });
    }
    if (canClients) {
      o.push({ value: 'clients', label: 'Клиенты' });
      o.push({ value: 'contracts', label: 'Договоры и продажи' });
      o.push({ value: 'receivables', label: 'Задолженности' });
    }
    return o;
  }, [canFunnel, canClients]);

  const effectiveTab: CrmHubTab = useMemo(() => {
    if (options.some((x) => x.value === tab)) return tab;
    return options[0]?.value || 'funnel';
  }, [options, tab]);

  useLayoutEffect(() => {
    if (!options.length) return;
    if (tab !== effectiveTab) onTabChange(effectiveTab);
  }, [options.length, tab, effectiveTab, onTabChange]);

  /** Создание из шапки воронки — переключаем вкладку CRM и открываем модалку. */
  useEffect(() => {
    const onHubCreate = (event: Event) => {
      const t = (event as CustomEvent<{ type?: string }>).detail?.type;
      if (!t || t === 'deal') return;
      if (t === 'client') {
        onTabChange('clients');
      } else if (t === 'contract' || t === 'sale') {
        onTabChange('contracts');
      } else if (t === 'receivable') {
        onTabChange('receivables');
      } else {
        onTabChange('clients');
      }
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
    const activeBox = MODULE_ACCENTS.violet.navIconActive;
    const idleBox = MODULE_TOOLBAR_TAB_IDLE;
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
                active ? activeBox : idleBox
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
    headerSearchQuery,
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
        {effectiveTab === 'requests' && canFunnel && (
          <CrmHubRequestsPanel
            purchaseRequests={purchaseRequests}
            users={users}
            financeCategories={financeCategories}
            departments={departments}
            onOpenFinance={() => actions.setCurrentView('finance')}
          />
        )}
        {effectiveTab === 'clients' && canClients && (
          <CRMModule view="crm-clients" embedInCrmHub crmClientsSection="clients" {...sharedCrm} />
        )}
        {effectiveTab === 'contracts' && canClients && (
          <CRMModule view="crm-clients" embedInCrmHub crmClientsSection="contracts" {...sharedCrm} />
        )}
        {effectiveTab === 'receivables' && canClients && (
          <CRMModule view="crm-clients" embedInCrmHub crmClientsSection="receivables" {...sharedCrm} />
        )}
      </div>
    </div>
  );
};
