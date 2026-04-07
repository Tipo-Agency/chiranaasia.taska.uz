import React, { lazy, Suspense, useCallback } from 'react';
import { 
  Task, User, Project, StatusOption, PriorityOption, ActivityLog, 
  Deal, Client, Contract, EmployeeInfo, Meeting, ContentPost, ShootPlan,
  Doc, Folder, TableCollection, Department, FinanceCategory, Fund,
  FinancePlan, PurchaseRequest, FinancialPlanDocument, FinancialPlanning, OrgPosition, BusinessProcess, SalesFunnel,
  ViewMode, AutomationRule, Warehouse, InventoryItem, StockBalance, StockMovement, InventoryRevision, OneTimeDeal, AccountsReceivable,
  NotificationPreferences
} from '../types';

import type { AppActions } from '../frontend/hooks/useAppLogic';

import { WorkdeskView } from './pages/WorkdeskView';
import { TasksPage } from './pages/TasksPage';
import { InboxPage } from './pages/InboxPage';
import TableView from './TableView'; // Needed for Global Search
import { SpacesTabsView } from './SpacesTabsView';
import { MiniMessenger } from './features/chat/MiniMessenger';
import { PageLayout } from './ui/PageLayout';
import { Container } from './ui/Container';
import { RouteFallback } from './ui/RouteFallback';
import {
  createEntityFromChat as createEntityFromChatBridge,
  updateEntityFromChat as updateEntityFromChatBridge,
  startBusinessProcessFromTemplate as startBusinessProcessFromTemplateBridge,
} from '../utils/miniMessengerBridge';

/** Тяжёлые экраны подгружаются отдельными чанками (меньше initial JS). */
const SettingsViewLazy = lazy(() => import('./SettingsView'));
const DocEditorLazy = lazy(() => import('./DocEditor'));
const SpaceModuleLazy = lazy(() => import('./modules/SpaceModule').then((m) => ({ default: m.SpaceModule })));
const CRMHubModuleLazy = lazy(() => import('./modules/CRMHubModule').then((m) => ({ default: m.CRMHubModule })));
const InventoryViewLazy = lazy(() => import('./InventoryView'));
const FinanceModuleLazy = lazy(() => import('./modules/FinanceModule').then((m) => ({ default: m.FinanceModule })));
const HRModuleLazy = lazy(() => import('./modules/HRModule').then((m) => ({ default: m.HRModule })));
const MeetingsModuleLazy = lazy(() => import('./modules/MeetingsModule').then((m) => ({ default: m.MeetingsModule })));
const DocumentsModuleLazy = lazy(() => import('./modules/DocumentsModule').then((m) => ({ default: m.DocumentsModule })));

interface AppRouterProps {
  currentView: string;
  viewMode: ViewMode;
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
  shootPlans?: ShootPlan[];
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
  workdeskTab?: 'dashboard' | 'weekly' | 'tasks' | 'deals' | 'meetings' | 'documents';
  crmHubTab?: 'funnel' | 'chats' | 'clients';
  notificationPrefs?: NotificationPreferences;
  actions: AppActions;
}

export const AppRouter: React.FC<AppRouterProps> = (props) => {
  const { currentView, activeTable, actions } = props;

  const messengerBridgeDeps = {
    currentUser: props.currentUser,
    statuses: props.statuses,
    priorities: props.priorities,
    tasks: props.allTasks,
    deals: props.deals,
    meetings: props.meetings,
    docs: props.docs,
    orgPositions: props.orgPositions,
    employeeInfos: props.employeeInfos,
    businessProcesses: props.businessProcesses,
    actions,
  };

  const createEntityFromChat = useCallback(
    (type: 'task' | 'deal' | 'meeting' | 'doc', title: string) =>
      createEntityFromChatBridge(messengerBridgeDeps, type, title),
    [
      props.currentUser,
      props.statuses,
      props.priorities,
      props.allTasks,
      props.deals,
      props.meetings,
      props.docs,
      props.orgPositions,
      props.employeeInfos,
      props.businessProcesses,
      actions,
    ]
  );

  const updateEntityFromChat = useCallback(
    (type: 'task' | 'deal' | 'meeting' | 'doc', id: string, patch: Record<string, unknown>) =>
      updateEntityFromChatBridge(messengerBridgeDeps, type, id, patch),
    [
      props.currentUser,
      props.statuses,
      props.priorities,
      props.allTasks,
      props.deals,
      props.meetings,
      props.docs,
      props.orgPositions,
      props.employeeInfos,
      props.businessProcesses,
      actions,
    ]
  );

  const startBusinessProcessFromTemplate = useCallback(
    (processId: string) => startBusinessProcessFromTemplateBridge(messengerBridgeDeps, processId),
    [
      props.currentUser,
      props.statuses,
      props.priorities,
      props.allTasks,
      props.deals,
      props.meetings,
      props.docs,
      props.orgPositions,
      props.employeeInfos,
      props.businessProcesses,
      actions,
    ]
  );

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

  const renderHomeWorkdesk = () => {
    let meetingsTable =
      props.tables.find((t) => t.type === 'meetings' && t.isSystem) || props.tables.find((t) => t.type === 'meetings');
    if (!meetingsTable) {
      meetingsTable = {
        id: 'meetings-system',
        name: 'Календарь',
        type: 'meetings',
        icon: 'Users',
        color: 'text-purple-500',
        isSystem: true,
      };
    }
    let docsTable = props.tables.find((t) => t.type === 'docs' && t.isSystem) || props.tables.find((t) => t.type === 'docs');
    if (!docsTable) {
      docsTable = {
        id: 'docs-system',
        name: 'Документы',
        type: 'docs',
        icon: 'FileText',
        color: 'text-yellow-500',
        isSystem: true,
      };
    }
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
        salesFunnels={props.salesFunnels}
        workdeskTab={props.workdeskTab ?? 'dashboard'}
        onWorkdeskTabChange={actions.setWorkdeskTab}
        onOpenTask={actions.openTaskModal}
        onNavigateToTasks={() => actions.setCurrentView('tasks')}
        onNavigateToMeetings={() => {
          actions.setWorkdeskTab('meetings');
          actions.setCurrentView('home');
        }}
        onNavigateToDocuments={() => {
          actions.setWorkdeskTab('documents');
          actions.setCurrentView('home');
        }}
        onNavigateToDeals={() => actions.setCurrentView('sales-funnel')}
        onOpenDocument={actions.handleDocClick}
        onCreateEntity={createEntityFromChat}
        onUpdateEntity={updateEntityFromChat}
        processTemplates={props.businessProcesses}
        onStartProcessTemplate={startBusinessProcessFromTemplate}
        meetingsSlot={
          <Suspense fallback={<RouteFallback />}>
            <MeetingsModuleLazy
              table={meetingsTable}
              meetings={props.meetings}
              users={props.users}
              projects={props.projects}
              clients={props.clients}
              deals={props.deals}
              tables={props.tables}
              notificationPrefs={props.notificationPrefs}
              shootPlans={props.shootPlans}
              contentPosts={props.contentPosts}
              actions={actions}
            />
          </Suspense>
        }
        documentsSlot={
          <Suspense fallback={<RouteFallback />}>
            <DocumentsModuleLazy
              table={docsTable}
              docs={props.docs}
              folders={props.folders}
              tables={props.tables}
              tasks={props.allTasks}
              users={props.users}
              departments={props.departments}
              employees={props.employeeInfos}
              currentUser={props.currentUser}
              actions={actions}
            />
          </Suspense>
        }
      />
    );
  };

  // 1. Global / Core Views
  if (view === 'home') {
    return renderHomeWorkdesk();
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
              onActiveSpaceTypeChange={(t) => actions.setActiveSpaceTab(t)}
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
                        onOpenTask={actions.openTaskModal}
                        onOpenDocument={props.actions.handleDocClick}
                        onOpenDocumentsModule={() => props.actions.setCurrentView('docs')}
                        onOpenDeals={() => props.actions.setCurrentView('sales-funnel')}
                        onOpenDeal={(deal) => {
                          props.actions.setCurrentView('sales-funnel');
                          window.setTimeout(() => {
                            window.dispatchEvent(new CustomEvent('openDealFromChat', { detail: { dealId: deal.id } }));
                          }, 0);
                        }}
                        onOpenMeetings={() => props.actions.setCurrentView('meetings')}
                        onOpenMeeting={(meeting) => {
                          props.actions.setCurrentView('meetings');
                          window.setTimeout(() => {
                            window.dispatchEvent(new CustomEvent('openMeetingFromChat', { detail: { meetingId: meeting.id } }));
                          }, 0);
                        }}
                        onCreateEntity={createEntityFromChat}
                        onUpdateEntity={updateEntityFromChat}
                        processTemplates={props.businessProcesses}
                        onStartProcessTemplate={startBusinessProcessFromTemplate}
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

  if (view === 'settings') {
      return (
        <Suspense fallback={<RouteFallback />}>
          <SettingsViewLazy 
              users={props.users} projects={props.projects} tasks={props.allTasks} statuses={props.statuses} priorities={props.priorities} tables={props.tables} automationRules={props.automationRules} currentUser={props.currentUser}
              departments={props.departments}
              docs={props.docs} contentPosts={props.contentPosts} financeCategories={props.financeCategories} funds={props.funds}
              employeeInfos={props.employeeInfos} deals={props.deals} clients={props.clients} contracts={props.contracts} meetings={props.meetings}
              salesFunnels={props.salesFunnels} businessProcesses={props.businessProcesses} orgPositions={props.orgPositions}
              onUpdateUsers={actions.updateUsers} onUpdateProjects={actions.updateProjects} onUpdateStatuses={actions.updateStatuses} onUpdatePriorities={actions.updatePriorities}
              onUpdateTable={actions.updateTable} onCreateTable={actions.openCreateTable} onDeleteTable={actions.deleteTable}
              onUpdateNotificationPrefs={actions.updateNotificationPrefs} onSaveAutomationRule={actions.saveAutomationRule} onDeleteAutomationRule={actions.deleteAutomationRule}
              onUpdateProfile={actions.updateProfile} onSaveDeal={actions.saveDeal} onClose={actions.closeSettings} initialTab={props.settingsActiveTab}
              onSaveDepartment={actions.saveDepartment} onDeleteDepartment={actions.deleteDepartment}
              onSaveFinanceCategory={actions.saveFinanceCategory} onDeleteFinanceCategory={actions.deleteFinanceCategory} onSaveFund={actions.saveFund} onDeleteFund={actions.deleteFund}
              onSaveWarehouse={actions.saveWarehouse} onDeleteWarehouse={actions.deleteWarehouse} warehouses={props.warehouses}
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
              onRestoreOrgPosition={actions.restoreOrgPosition}
              onRestoreAutomationRule={actions.restoreAutomationRule}
              onRestoreStatus={actions.restoreStatus}
              onRestorePriority={actions.restorePriority}
          />
        </Suspense>
      );
  }

  if (view === 'doc-editor' && props.activeDoc) {
      return (
        <Suspense fallback={<RouteFallback />}>
          <DocEditorLazy doc={props.activeDoc} onSave={actions.saveDocContent} onBack={() => { 
          actions.setCurrentView('docs'); 
      }} />
        </Suspense>
      );
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
                        return (
                        <Suspense fallback={<RouteFallback />}>
                        <SpaceModuleLazy
                            activeTable={activeTable} viewMode={props.viewMode} tasks={props.filteredTasks}
                            users={props.users} currentUser={props.currentUser} projects={props.projects}
                            statuses={props.statuses} priorities={props.priorities} tables={props.tables}
                            docs={props.docs} folders={props.folders} meetings={props.meetings}
                            contentPosts={props.contentPosts} shootPlans={props.shootPlans}
                            businessProcesses={props.businessProcesses}
                            clients={props.clients} deals={props.deals}
                            notificationPrefs={props.notificationPrefs}
                            actions={actions}
                        />
                        </Suspense>
                        );
  }

  if (view === 'sales-funnel') {
      return (
        <Suspense fallback={<RouteFallback />}>
          <CRMHubModuleLazy
            tab={props.crmHubTab ?? 'funnel'}
            onTabChange={actions.setCrmHubTab}
            currentUser={props.currentUser}
            deals={props.deals}
            clients={props.clients}
            contracts={props.contracts}
            oneTimeDeals={props.oneTimeDeals}
            accountsReceivable={props.accountsReceivable}
            users={props.users}
            salesFunnels={props.salesFunnels}
            projects={props.projects}
            tasks={props.allTasks}
            meetings={props.meetings}
            actions={actions}
          />
        </Suspense>
      );
  }

  if (view === 'finance') {
      return (
        <Suspense fallback={<RouteFallback />}>
          <FinanceModuleLazy categories={props.financeCategories} funds={props.funds} plan={props.financePlan} requests={props.purchaseRequests} departments={props.departments} users={props.users} currentUser={props.currentUser} financialPlanDocuments={props.financialPlanDocuments} financialPlannings={props.financialPlannings} bdr={props.bdr} actions={actions} />
        </Suspense>
      );
  }

  if (view === 'employees') {
      return (
        <Suspense fallback={<RouteFallback />}>
          <HRModuleLazy
            view="employees"
            employees={props.employeeInfos}
            users={props.users}
            currentUser={props.currentUser}
            departments={props.departments}
            orgPositions={props.orgPositions}
            processes={props.businessProcesses}
            tasks={props.filteredTasks}
            tables={props.tables}
            actions={actions}
          />
        </Suspense>
      );
  }

  if (view === 'business-processes') {
      return (
        <Suspense fallback={<RouteFallback />}>
          <HRModuleLazy
            view="business-processes"
            employees={props.employeeInfos}
            users={props.users}
            currentUser={props.currentUser}
            departments={props.departments}
            orgPositions={props.orgPositions}
            processes={props.businessProcesses}
            tasks={props.filteredTasks}
            tables={props.tables}
            actions={actions}
          />
        </Suspense>
      );
  }

  if (view === 'inventory') {
    return (
      <Suspense fallback={<RouteFallback />}>
        <InventoryViewLazy
          departments={props.departments}
          warehouses={props.warehouses}
          items={props.inventoryItems}
          balances={props.inventoryBalances}
          movements={props.inventoryMovements}
          revisions={props.inventoryRevisions || []}
          currentUserId={props.currentUser.id}
          onSaveWarehouse={actions.saveWarehouse}
          onDeleteWarehouse={actions.deleteWarehouse}
          onSaveItem={actions.saveInventoryItem}
          onDeleteItem={actions.deleteInventoryItem}
          onCreateMovement={actions.createInventoryMovement}
          onCreateRevision={actions.createInventoryRevision}
          onUpdateRevision={actions.updateInventoryRevision}
          onPostRevision={actions.postInventoryRevision}
        />
      </Suspense>
    );
  }

  // Fallback: если ничего не подошло, показываем home
  return renderHomeWorkdesk();
};
