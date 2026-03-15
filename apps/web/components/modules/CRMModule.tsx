
import React from 'react';
import { Deal, Client, Contract, User, Project, Task, OneTimeDeal, AccountsReceivable, Meeting } from '../../types';
import SalesFunnelView from '../SalesFunnelView';
import ClientsView from '../ClientsView';

interface CRMModuleProps {
  view: 'sales-funnel' | 'clients';
  deals: Deal[];
  clients: Client[];
  contracts: Contract[];
  oneTimeDeals?: OneTimeDeal[];
  accountsReceivable?: AccountsReceivable[];
  users: User[];
  projects?: Project[];
  tasks?: Task[];
  meetings?: Meeting[];
  currentUser?: User | null;
  actions: any;
  autoOpenCreateModal?: boolean;
}

export const CRMModule: React.FC<CRMModuleProps> = ({ view, deals, clients, contracts, oneTimeDeals = [], accountsReceivable = [], users, salesFunnels = [], projects, tasks, meetings = [], currentUser, actions, autoOpenCreateModal = false }) => {
  if (view === 'sales-funnel') {
      return <SalesFunnelView 
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
        onOpenSettings={actions.openSettings ? () => actions.openSettings('sales-funnels') : undefined}
        autoOpenCreateModal={autoOpenCreateModal}
      />;
  }
  
  if (view === 'clients') {
      return <ClientsView 
        clients={clients} 
        contracts={contracts}
        oneTimeDeals={oneTimeDeals}
        accountsReceivable={accountsReceivable}
        salesFunnels={salesFunnels}
        onSaveClient={actions.saveClient} 
        onDeleteClient={actions.deleteClient} 
        onSaveContract={actions.saveContract} 
        onDeleteContract={actions.deleteContract}
        onSaveOneTimeDeal={actions.saveOneTimeDeal}
        onDeleteOneTimeDeal={actions.deleteOneTimeDeal}
        onSaveAccountsReceivable={actions.saveAccountsReceivable}
        onDeleteAccountsReceivable={actions.deleteAccountsReceivable}
      />;
  }

  return null;
};
