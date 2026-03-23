
import React from 'react';
import { 
  Task, User, Project, StatusOption, PriorityOption, ActivityLog, 
  Deal, Client, Contract, EmployeeInfo, Meeting, ContentPost, 
  Doc, Folder, TableCollection, Department, FinanceCategory, Fund,
  FinancePlan, PurchaseRequest, FinancialPlanDocument, FinancialPlanning, OrgPosition, BusinessProcess, SalesFunnel,
  ViewMode, AutomationRule, Warehouse, InventoryItem, StockBalance, StockMovement, InventoryRevision, OneTimeDeal, AccountsReceivable,
  NotificationPreferences, InboxMessage
} from '../types';

import HomeView from './HomeView';
import { HomePage } from './pages/HomePage';
import { WorkdeskView } from './pages/WorkdeskView';
import { TasksPage } from './pages/TasksPage';
import { ClientsPage } from './pages/ClientsPage';
import { InboxPage } from './pages/InboxPage';
import InboxView from './InboxView';
import SettingsView from './SettingsView';
import AnalyticsView from './AnalyticsView';
import DocEditor from './DocEditor';
import TableView from './TableView'; // Needed for Global Search
import { TasksView } from './TasksView';
import { SpacesTabsView } from './SpacesTabsView';
import { SpaceModule } from './modules/SpaceModule';
import { CRMModule } from './modules/CRMModule';
import { FinanceModule } from './modules/FinanceModule';
import { HRModule } from './modules/HRModule';
import { MeetingsModule } from './modules/MeetingsModule';
import { DocumentsModule } from './modules/DocumentsModule';
import { SitesView } from './sites/SitesView';
import InventoryView from './InventoryView';
import { AdminView } from './admin/AdminView';
import { MiniMessenger } from './features/chat/MiniMessenger';
import { PageLayout } from './ui/PageLayout';
import { Container } from './ui/Container';

interface AppRouterProps {
  currentView: string;
  viewMode: ViewMode;
  searchQuery: string;
  activeTable?: TableCollection;
  filteredTasks: Task[];
  allTasks: Task[];
  users: User[];
  currentUser: User;
  projects: Project[];
  statuses: StatusOption[];
  priorities: PriorityOption[];
  activities: ActivityLog[];
  deals: Deal[];
  clients: Client[];
  contracts: Contract[];
  oneTimeDeals?: OneTimeDeal[];
  accountsReceivable?: AccountsReceivable[];
  employeeInfos: EmployeeInfo[];
  meetings: Meeting[];
  contentPosts: ContentPost[];
  docs: Doc[];
  folders: Folder[];
  activeDoc?: Doc;
  tables: TableCollection[];
  departments: Department[];
  financeCategories: FinanceCategory[];
  funds: Fund[];
  financePlan: FinancePlan | null;
  purchaseRequests: PurchaseRequest[];
  financialPlanDocuments?: FinancialPlanDocument[];
  financialPlannings?: FinancialPlanning[];
  bdr?: { year: string; rows: unknown[] } | null;
  warehouses: Warehouse[];
  inventoryItems: InventoryItem[];
  inventoryBalances: StockBalance[];
  inventoryMovements: StockMovement[];
  inventoryRevisions?: InventoryRevision[];
  orgPositions: OrgPosition[];
  businessProcesses: BusinessProcess[];
  automationRules?: AutomationRule[];
  salesFunnels?: SalesFunnel[];
  settingsActiveTab?: string;
  activeSpaceTab?: 'content-plan' | 'backlog' | 'functionality';
  notificationPrefs?: NotificationPreferences;
  inboxMessages?: InboxMessage[];
  outboxMessages?: InboxMessage[];
  actions: any;
}

export const AppRouter: React.FC<AppRouterProps> = (props) => {
  const { currentView, activeTable, actions } = props;

  // Проверка на наличие currentUser
  if (!props.currentUser) {
    return (
      <div className="h-full flex items-center justify-center bg-white dark:bg-[#191919]">
        <div className="p-10 text-center text-gray-500 dark:text-gray-400">Пользователь не найден</div>
      </div>
    );
  }

  // Fallback: если currentView пустой или undefined, показываем home
  const view = currentView || 'home';

  // 1. Global / Core Views
  if (view === 'home') {
      return (
          <WorkdeskView
              currentUser={props.currentUser}
              tasks={props.filteredTasks}
              meetings={props.meetings}
              financePlan={props.financePlan}
              deals={props.deals}
              users={props.users}
              docs={props.docs}
              accountsReceivable={props.accountsReceivable}
              onOpenTask={actions.openTaskModal}
              onQuickCreateTask={() => actions.openTaskModal(null)}
              onQuickCreateProcess={() => {
                actions.setCurrentView('business-processes');
                setTimeout(() => {
                  const event = new CustomEvent('openCreateProcessModal');
                  window.dispatchEvent(event);
                }, 100);
              }}
              onQuickCreateDeal={() => {
                actions.setCurrentView('sales-funnel');
                setTimeout(() => {
                  const event = new CustomEvent('openCreateDealModal');
                  window.dispatchEvent(event);
                }, 100);
              }}
              onNavigateToTasks={() => actions.setCurrentView('tasks')}
              onNavigateToMeetings={() => actions.setCurrentView('meetings')}
              onNavigateToDeals={() => actions.setCurrentView('sales-funnel')}
              onOpenDocument={actions.handleDocClick}
          />
      );
  }

  if (view === 'tasks') {
      return (
          <TasksPage
              tasks={props.allTasks}
              users={props.users}
              projects={props.projects}
              statuses={props.statuses}
              priorities={props.priorities}
              tables={props.tables}
              businessProcesses={props.businessProcesses}
              currentUser={props.currentUser}
              onUpdateTask={(id, updates) => actions.saveTask({ id, ...updates })}
              onDeleteTask={actions.deleteTask}
              onOpenTask={actions.openTaskModal}
              onCreateTask={() => actions.openTaskModal(null)}
          />
      );
  }

  // 2. Spaces (Tabs View)
  if (view === 'spaces') {
      return (
          <SpacesTabsView
              tables={props.tables}
              currentUser={props.currentUser}
              activeTableId={props.activeTableId}
              currentView={props.currentView}
              initialTab={props.activeSpaceTab}
              onSelectTable={(id) => { actions.setActiveTableId(id); actions.setCurrentView('table'); }}
              onEditTable={actions.openEditTable}
              onDeleteTable={actions.deleteTable}
              onCreateTable={(type) => {
                  actions.openCreateTable(type);
              }}
          />
      );
  }

  if (view === 'chat') {
      return (
          <PageLayout>
              <Container safeArea className="py-4 h-full flex flex-col min-h-0 max-w-6xl mx-auto w-full">
                  <div className="flex-1 min-h-[70vh]">
                      <MiniMessenger
                        users={props.users}
                        currentUser={props.currentUser}
                        docs={props.docs}
                        tasks={props.allTasks}
                        deals={props.deals}
                        meetings={props.meetings}
                        onOpenDocument={props.actions.handleDocClick}
                        onOpenDocumentsModule={() => props.actions.setCurrentView('docs')}
                        onCreateTask={() => props.actions.openTaskModal(null)}
                        onStartProcess={() => {
                          props.actions.setCurrentView('business-processes');
                          setTimeout(() => window.dispatchEvent(new CustomEvent('openCreateProcessModal')), 120);
                        }}
                        onOpenDeals={() => props.actions.setCurrentView('sales-funnel')}
                        onOpenMeetings={() => props.actions.setCurrentView('meetings')}
                      />
                  </div>
              </Container>
          </PageLayout>
      );
  }

  if (view === 'inbox') {
      return (
          <InboxPage
              activities={props.activities}
              users={props.users}
              currentUser={props.currentUser}
              tasks={props.allTasks}
              deals={props.deals}
              purchaseRequests={props.purchaseRequests}
              onMarkAllRead={actions.markAllRead}
          />
      );
  }

  if (view === 'admin') {
      return <AdminView />;
  }

  if (view === 'settings') {
      return (
          <SettingsView 
              users={props.users} projects={props.projects} tasks={props.allTasks} statuses={props.statuses} priorities={props.priorities} tables={props.tables} automationRules={props.automationRules} currentUser={props.currentUser}
              departments={props.departments}
              docs={props.docs} contentPosts={props.contentPosts} financeCategories={props.financeCategories} funds={props.funds}
              employeeInfos={props.employeeInfos} deals={props.deals} clients={props.clients} contracts={props.contracts} meetings={props.meetings}
              salesFunnels={props.salesFunnels} businessProcesses={props.businessProcesses}
              onUpdateUsers={actions.updateUsers} onUpdateProjects={actions.updateProjects} onUpdateStatuses={actions.updateStatuses} onUpdatePriorities={actions.updatePriorities}
              onUpdateTable={actions.updateTable} onCreateTable={actions.openCreateTable} onDeleteTable={actions.deleteTable}
              onUpdateNotificationPrefs={actions.updateNotificationPrefs} onSaveAutomationRule={actions.saveAutomationRule} onDeleteAutomationRule={actions.deleteAutomationRule}
              onUpdateProfile={actions.updateProfile} onSaveDeal={actions.saveDeal} onClose={actions.closeSettings} initialTab={props.settingsActiveTab}
              onSaveDepartment={actions.saveDepartment} onDeleteDepartment={actions.deleteDepartment}
              onSaveFinanceCategory={actions.saveFinanceCategory} onDeleteFinanceCategory={actions.deleteFinanceCategory} onSaveFund={actions.saveFund} onDeleteFund={actions.deleteFund}
              onSaveSalesFunnel={actions.saveSalesFunnel} onDeleteSalesFunnel={actions.deleteSalesFunnel}
              notificationPrefs={props.notificationPrefs}
              onRestoreTask={actions.restoreTask}
              onPermanentDelete={actions.permanentDeleteTask}
              onRestoreUser={actions.restoreUser}
              onRestoreEmployee={actions.restoreEmployee}
              onRestoreDoc={actions.restoreDoc}
              onRestorePost={actions.restorePost}
              onRestoreProject={actions.restoreProject}
              onRestoreDepartment={actions.restoreDepartment}
              onRestoreFinanceCategory={actions.restoreFinanceCategory}
              onRestoreSalesFunnel={actions.restoreSalesFunnel}
              onRestoreTable={actions.restoreTable}
              onRestoreBusinessProcess={actions.restoreBusinessProcess}
              onRestoreDeal={actions.restoreDeal}
              onRestoreClient={actions.restoreClient}
              onRestoreContract={actions.restoreContract}
              onRestoreMeeting={actions.restoreMeeting}
          />
      );
  }

  if (view === 'doc-editor' && props.activeDoc) {
      return <DocEditor doc={props.activeDoc} onSave={actions.saveDocContent} onBack={() => { 
          actions.setCurrentView('docs'); 
      }} />;
  }

  if (view === 'analytics') {
      return <AnalyticsView tasks={props.filteredTasks} deals={props.deals} users={props.users} financePlan={props.financePlan} contracts={props.contracts} />;
  }

  // 2. Search (Global)
  if (view === 'search') {
      return <TableView tasks={props.filteredTasks} users={props.users} projects={props.projects} statuses={props.statuses} priorities={props.priorities} tables={props.tables} isAggregator={true} currentUser={props.currentUser} businessProcesses={props.businessProcesses} onUpdateTask={(id, updates) => actions.saveTask({ id, ...updates })} onDeleteTask={actions.deleteTask} onOpenTask={actions.openTaskModal} />;
  }

  // 4. Modules
  if (view === 'table') {
      if (!activeTable) {
          return <div className="p-10 text-center text-gray-500">Страница не найдена. Выберите страницу из списка.</div>;
      }
                        return <SpaceModule
                            activeTable={activeTable} viewMode={props.viewMode} tasks={props.filteredTasks}
                            users={props.users} currentUser={props.currentUser} projects={props.projects}
                            statuses={props.statuses} priorities={props.priorities} tables={props.tables}
                            docs={props.docs} folders={props.folders} meetings={props.meetings}
                            contentPosts={props.contentPosts} businessProcesses={props.businessProcesses}
                            clients={props.clients} deals={props.deals}
                            actions={actions}
                        />;
  }

  if (view === 'clients') {
      return (
          <ClientsPage
              clients={props.clients}
              contracts={props.contracts}
              oneTimeDeals={props.oneTimeDeals}
              accountsReceivable={props.accountsReceivable}
              salesFunnels={props.salesFunnels}
              onSaveClient={actions.saveClient}
              onDeleteClient={actions.deleteClient}
              onSaveContract={actions.saveContract}
              onDeleteContract={actions.deleteContract}
              onSaveOneTimeDeal={actions.saveOneTimeDeal}
              onDeleteOneTimeDeal={actions.deleteOneTimeDeal}
              onSaveAccountsReceivable={actions.saveAccountsReceivable}
              onDeleteAccountsReceivable={actions.deleteAccountsReceivable}
          />
      );
  }

  if (view === 'sales-funnel') {
      return <CRMModule view={view} deals={props.deals} clients={props.clients} contracts={props.contracts} oneTimeDeals={props.oneTimeDeals} accountsReceivable={props.accountsReceivable} users={props.users} salesFunnels={props.salesFunnels} projects={props.projects} tasks={props.allTasks} meetings={props.meetings} currentUser={props.currentUser} actions={actions} />;
  }

  if (view === 'finance') {
      return <FinanceModule categories={props.financeCategories} funds={props.funds} plan={props.financePlan} requests={props.purchaseRequests} departments={props.departments} users={props.users} currentUser={props.currentUser} financialPlanDocuments={props.financialPlanDocuments} financialPlannings={props.financialPlannings} bdr={props.bdr} actions={actions} />;
  }

  if (view === 'employees' || view === 'business-processes') {
      return <HRModule 
          view={view} 
          employees={props.employeeInfos} 
          users={props.users}
          currentUser={props.currentUser} 
          departments={props.departments} 
          orgPositions={props.orgPositions} 
          processes={props.businessProcesses}
          tasks={props.filteredTasks}
          tables={props.tables}
          actions={actions} 
      />;
  }

  // Meetings and Documents as separate modules (хардкодные, работают без создания таблиц)
  if (view === 'meetings') {
      // Автоматически создаем фиктивную таблицу для встреч, если её нет (не показывается в настройках)
      let meetingsTable = props.tables.find(t => t.type === 'meetings' && t.isSystem) || 
                          props.tables.find(t => t.type === 'meetings');
      if (!meetingsTable) {
          // Создаем фиктивную таблицу автоматически
          meetingsTable = { 
              id: 'meetings-system', 
              name: 'Встречи', 
              type: 'meetings', 
              icon: 'Users', 
              color: 'text-purple-500', 
              isSystem: true 
          };
          // Добавляем в таблицы, но не сохраняем (чтобы не показывалась в настройках)
          // Модуль будет работать с этой фиктивной таблицей
      }
      return <MeetingsModule table={meetingsTable} meetings={props.meetings} users={props.users} clients={props.clients} deals={props.deals} tables={props.tables} actions={actions} />;
  }

  if (view === 'docs') {
      // Автоматически создаем фиктивную таблицу для документов, если её нет (не показывается в настройках)
      let docsTable = props.tables.find(t => t.type === 'docs' && t.isSystem) || 
                     props.tables.find(t => t.type === 'docs');
      if (!docsTable) {
          // Создаем фиктивную таблицу автоматически
          docsTable = { 
              id: 'docs-system', 
              name: 'Документы', 
              type: 'docs', 
              icon: 'FileText', 
              color: 'text-yellow-500', 
              isSystem: true 
          };
          // Добавляем в таблицы, но не сохраняем (чтобы не показывалась в настройках)
          // Модуль будет работать с этой фиктивной таблицей
      }
      return <DocumentsModule table={docsTable} docs={props.docs} folders={props.folders} tables={props.tables} tasks={props.allTasks} users={props.users} currentUser={props.currentUser} actions={actions} />;
  }

  if (view === 'sites') {
      return <SitesView currentUser={props.currentUser} />;
  }

  if (view === 'inventory') {
      return (
          <InventoryView
              departments={props.departments}
              warehouses={props.warehouses}
              items={props.inventoryItems}
              balances={props.inventoryBalances}
              movements={props.inventoryMovements}
              revisions={props.inventoryRevisions || []}
              currentUserId={props.currentUser?.id || ''}
              onSaveWarehouse={actions.saveWarehouse}
              onDeleteWarehouse={actions.deleteWarehouse}
              onSaveItem={actions.saveInventoryItem}
              onDeleteItem={actions.deleteInventoryItem}
              onCreateMovement={actions.createInventoryMovement}
              onCreateRevision={actions.createInventoryRevision}
              onUpdateRevision={actions.updateInventoryRevision}
              onPostRevision={actions.postInventoryRevision}
          />
      );
  }

  // Fallback: если ничего не подошло, показываем home
  return (
      <WorkdeskView
          currentUser={props.currentUser}
          tasks={props.filteredTasks}
          meetings={props.meetings}
          financePlan={props.financePlan}
          deals={props.deals}
          users={props.users}
          docs={props.docs}
          accountsReceivable={props.accountsReceivable}
          onOpenTask={actions.openTaskModal}
          onQuickCreateTask={() => actions.openTaskModal(null)}
          onQuickCreateProcess={() => {
            actions.setCurrentView('business-processes');
            setTimeout(() => {
              const event = new CustomEvent('openCreateProcessModal');
              window.dispatchEvent(event);
            }, 100);
          }}
          onQuickCreateDeal={() => {
            actions.setCurrentView('sales-funnel');
            setTimeout(() => {
              const event = new CustomEvent('openCreateDealModal');
              window.dispatchEvent(event);
            }, 100);
          }}
          onNavigateToTasks={() => actions.setCurrentView('tasks')}
          onNavigateToMeetings={() => actions.setCurrentView('meetings')}
          onNavigateToDeals={() => actions.setCurrentView('sales-funnel')}
          onOpenDocument={actions.handleDocClick}
      />
  );
};
