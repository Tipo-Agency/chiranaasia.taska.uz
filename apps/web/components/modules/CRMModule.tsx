import React from 'react';
import { Deal, Client, Contract, User, Project, Task, OneTimeDeal, AccountsReceivable, Meeting, SalesFunnel } from '../../types';
import type { ProductionRoutePipeline, ProductionRouteOrder } from '../../types';
import type { AppActions } from '../../frontend/hooks/useAppLogic';
import SalesFunnelView from '../SalesFunnelView';
import ClientsView from '../ClientsView';

interface CRMModuleProps {
  view: 'sales-funnel' | 'clients' | 'crm-clients';
  /** Скрыть дублирующие кнопки в шапке страницы «Клиенты» — действия в верхней панели приложения */
  embedInCrmHub?: boolean;
  /** Внутри хаба CRM: какой подраздел показать (вкладки вынесены в верхнее меню). */
  crmClientsSection?: 'clients' | 'contracts' | 'receivables';
  deals: Deal[];
  clients: Client[];
  contracts: Contract[];
  oneTimeDeals?: OneTimeDeal[];
  accountsReceivable?: AccountsReceivable[];
  users: User[];
  projects?: Project[];
  tasks?: Task[];
  meetings?: Meeting[];
  salesFunnels?: SalesFunnel[];
  productionPipelines?: ProductionRoutePipeline[];
  productionOrders?: ProductionRouteOrder[];
  currentUser?: User | null;
  actions: AppActions;
  autoOpenCreateModal?: boolean;
  /** Фильтр карточек воронки по строке поиска в шапке приложения */
  headerSearchQuery?: string;
}

export const CRMModule: React.FC<CRMModuleProps> = ({
  view,
  embedInCrmHub = false,
  crmClientsSection = 'clients',
  deals,
  clients,
  contracts,
  oneTimeDeals = [],
  accountsReceivable = [],
  users,
  salesFunnels = [],
  productionPipelines = [],
  productionOrders = [],
  projects,
  tasks,
  meetings = [],
  currentUser,
  actions,
  autoOpenCreateModal = false,
  headerSearchQuery = '',
}) => {
  if (view === 'sales-funnel') {
      return (
        <div className="h-full min-h-0 flex flex-col">
          <SalesFunnelView
            deals={deals}
            clients={clients}
            users={users}
            projects={projects}
            tasks={tasks}
            meetings={meetings}
            salesFunnels={salesFunnels}
            productionPipelines={productionPipelines}
            productionOrders={productionOrders}
            currentUser={currentUser}
            headerSearchQuery={headerSearchQuery}
            onSaveDeal={actions.saveDeal}
            onDeleteDeal={actions.deleteDeal}
            onCreateTask={actions.openTaskModal ? (task) => actions.openTaskModal(task) : undefined}
            onCreateClient={actions.saveClient}
            onOpenTask={actions.openTaskModal}
            onSaveMeeting={actions.saveMeeting}
            onDeleteMeeting={actions.deleteMeeting}
            onUpdateMeetingSummary={actions.updateMeetingSummary}
            onCreateProductionOrder={actions.createProductionRouteOrder}
            autoOpenCreateModal={autoOpenCreateModal}
          />
        </div>
      );
  }
  
  if (view === 'clients' || view === 'crm-clients') {
      return (
        <div className="h-full min-h-0 flex flex-col">
          <ClientsView 
            deals={deals}
            clients={clients} 
            contracts={contracts}
            oneTimeDeals={oneTimeDeals}
            accountsReceivable={accountsReceivable}
            salesFunnels={salesFunnels}
            embedInCrmHub={embedInCrmHub}
            crmHubSection={view === 'crm-clients' ? crmClientsSection : undefined}
            onSaveClient={actions.saveClient} 
            onDeleteClient={actions.deleteClient} 
            onSaveContract={actions.saveContract} 
            onDeleteContract={actions.deleteContract}
            onSaveOneTimeDeal={actions.saveOneTimeDeal}
            onDeleteOneTimeDeal={actions.deleteOneTimeDeal}
            onSaveAccountsReceivable={actions.saveAccountsReceivable}
            onDeleteAccountsReceivable={actions.deleteAccountsReceivable}
          />
        </div>
      );
  }

  return null;
};
