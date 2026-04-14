
import React from 'react';
import { Deal, Client, Contract, User, Project, Task, OneTimeDeal, AccountsReceivable, Meeting, SalesFunnel } from '../../types';
import type { AppActions } from '../../frontend/hooks/useAppLogic';
import SalesFunnelView from '../SalesFunnelView';
import ClientsView from '../ClientsView';

interface CRMModuleProps {
  view: 'sales-funnel' | 'clients';
  /** Скрыть дублирующие кнопки в шапке страницы «Клиенты» — действия в верхней панели приложения */
  embedInCrmHub?: boolean;
  forcedFunnelViewMode?: 'kanban' | 'list' | 'rejected';
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
  currentUser?: User | null;
  actions: AppActions;
  autoOpenCreateModal?: boolean;
}

export const CRMModule: React.FC<CRMModuleProps> = ({ view, embedInCrmHub = false, forcedFunnelViewMode, deals, clients, contracts, oneTimeDeals = [], accountsReceivable = [], users, salesFunnels = [], projects, tasks, meetings = [], currentUser, actions, autoOpenCreateModal = false }) => {
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
            currentUser={currentUser}
            onSaveDeal={actions.saveDeal} 
            onDeleteDeal={actions.deleteDeal}
            onCreateTask={actions.openTaskModal ? (task) => actions.openTaskModal(task) : undefined}
            onCreateClient={actions.saveClient}
            onOpenTask={actions.openTaskModal}
            onSaveMeeting={actions.saveMeeting}
            onDeleteMeeting={actions.deleteMeeting}
            onUpdateMeetingSummary={actions.updateMeetingSummary}
            autoOpenCreateModal={autoOpenCreateModal}
            forcedViewMode={forcedFunnelViewMode}
          />
        </div>
      );
  }
  
  if (view === 'clients') {
      return (
        <div className="h-full min-h-0 flex flex-col">
          <ClientsView 
            clients={clients} 
            contracts={contracts}
            oneTimeDeals={oneTimeDeals}
            accountsReceivable={accountsReceivable}
            salesFunnels={salesFunnels}
            embedInCrmHub={embedInCrmHub}
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
