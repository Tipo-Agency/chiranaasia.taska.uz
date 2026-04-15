import React, { lazy, Suspense } from 'react';
import { WorkdeskView } from '../components/pages/WorkdeskView';
import { RouteFallback } from '../components/ui/RouteFallback';
import type { AppRouterProps } from '../components/appRouterTypes';
const MeetingsModuleLazy = lazy(() =>
  import('../components/modules/MeetingsModule').then((m) => ({ default: m.MeetingsModule }))
);
const DocumentsModuleLazy = lazy(() =>
  import('../components/modules/DocumentsModule').then((m) => ({ default: m.DocumentsModule }))
);

export type DashboardRoutesExtra = {
  createEntityFromChat: (type: 'task' | 'deal' | 'meeting' | 'doc', title: string) => void;
  updateEntityFromChat: (type: 'task' | 'deal' | 'meeting' | 'doc', id: string, patch: Record<string, unknown>) => void;
  startBusinessProcessFromTemplate: (processId: string) => void;
  onQuickCreateTask: () => void;
  onOpenDocModalFromWorkdesk: () => void;
  onQuickCreateDeal: () => void;
};

export function DashboardRoutesView(props: AppRouterProps & DashboardRoutesExtra) {
  const { actions } = props;
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
  let docsTable =
    props.tables.find((t) => t.type === 'docs' && t.isSystem) || props.tables.find((t) => t.type === 'docs');
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
      onCreateEntity={props.createEntityFromChat}
      onUpdateEntity={props.updateEntityFromChat}
      onOpenDocModal={props.onOpenDocModalFromWorkdesk}
      onQuickCreateTask={props.onQuickCreateTask}
      onQuickCreateDeal={props.onQuickCreateDeal}
      processTemplates={props.businessProcesses}
      onStartProcessTemplate={props.startBusinessProcessFromTemplate}
      meetingsSlot={
        <Suspense fallback={<RouteFallback />}>
          <MeetingsModuleLazy
            embedInWorkdesk
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
            embedInWorkdesk
            table={docsTable}
            docs={props.docs}
            folders={props.folders}
            tables={props.tables}
            tasks={props.allTasks}
            deals={props.deals}
            inventoryItems={props.inventoryItems}
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
}
