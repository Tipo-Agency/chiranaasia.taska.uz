import React, { useCallback } from 'react';
import {
  createEntityFromChat as createEntityFromChatBridge,
  updateEntityFromChat as updateEntityFromChatBridge,
  startBusinessProcessFromTemplate as startBusinessProcessFromTemplateBridge,
} from '../utils/miniMessengerBridge';
import type { AppRouterProps } from './appRouterTypes';
export type { AppRouterProps } from './appRouterTypes';
import { DashboardRoutesView } from '../routes/DashboardRoutes';
import { TaskRoutesView } from '../routes/TaskRoutes';
import { ChatRoutesView } from '../routes/ChatRoutes';
import { InboxRoutesView } from '../routes/InboxRoutes';
import { AdminRoutesView } from '../routes/AdminRoutes';
import { DocumentsRoutesView } from '../routes/DocumentsRoutes';
import { CrmRoutesView } from '../routes/CrmRoutes';
import { FinanceRoutesView } from '../routes/FinanceRoutes';
import { HrRoutesView } from '../routes/HrRoutes';
import { ProductionRoutesView } from '../routes/ProductionRoutes';
import { InventoryRoutesView } from '../routes/InventoryRoutes';

export const AppRouter: React.FC<AppRouterProps> = (props) => {
  const { currentView, actions } = props;

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

  const onQuickCreateTask = useCallback(() => {
    actions.openTaskModal(null);
  }, [actions]);

  const onOpenDocModalFromWorkdesk = useCallback(() => {
    actions.openDocModal();
  }, [actions]);

  const onQuickCreateDeal = useCallback(() => {
    actions.setCurrentView('sales-funnel');
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent('openCreateDealModal'));
    }, 150);
  }, [actions]);

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

  if (!props.currentUser) {
    return (
      <div className="h-full flex items-center justify-center bg-white dark:bg-[#191919]">
        <div className="p-10 text-center text-gray-500 dark:text-gray-400">Пользователь не найден</div>
      </div>
    );
  }

  const view = currentView || 'home';

  const dashboardExtra = {
    createEntityFromChat,
    updateEntityFromChat,
    startBusinessProcessFromTemplate,
    onQuickCreateTask,
    onOpenDocModalFromWorkdesk,
    onQuickCreateDeal,
  };

  const chatExtra = {
    createEntityFromChat,
    updateEntityFromChat,
    startBusinessProcessFromTemplate,
  };

  if (view === 'home') {
    return <DashboardRoutesView {...props} {...dashboardExtra} />;
  }

  if (view === 'tasks' || view === 'spaces' || view === 'search' || view === 'table') {
    return <TaskRoutesView {...props} view={view} />;
  }

  if (view === 'chat') {
    return <ChatRoutesView {...props} {...chatExtra} />;
  }

  if (view === 'inbox') {
    return <InboxRoutesView {...props} />;
  }

  if (view === 'settings') {
    return <AdminRoutesView {...props} />;
  }

  if (view === 'doc-editor' && props.activeDoc) {
    return <DocumentsRoutesView {...props} />;
  }

  if (view === 'sales-funnel') {
    return <CrmRoutesView {...props} />;
  }

  if (view === 'finance') {
    return <FinanceRoutesView {...props} />;
  }

  if (view === 'employees') {
    return <HrRoutesView {...props} hrView="employees" />;
  }

  if (view === 'business-processes') {
    return <HrRoutesView {...props} hrView="business-processes" />;
  }

  if (view === 'production') {
    return <ProductionRoutesView {...props} />;
  }

  if (view === 'inventory') {
    return <InventoryRoutesView {...props} />;
  }

  return <DashboardRoutesView {...props} {...dashboardExtra} />;
};
