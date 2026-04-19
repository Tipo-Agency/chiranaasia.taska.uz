import React, { useCallback, lazy, Suspense } from 'react';
import {
  createEntityFromChat as createEntityFromChatBridge,
  updateEntityFromChat as updateEntityFromChatBridge,
  startBusinessProcessFromTemplate as startBusinessProcessFromTemplateBridge,
} from '../utils/miniMessengerBridge';
import type { AppRouterProps } from './appRouterTypes';
export type { AppRouterProps } from './appRouterTypes';
import { RouteFallback } from './ui/RouteFallback';

const DashboardRoutesView = lazy(() =>
  import('../routes/DashboardRoutes').then((m) => ({ default: m.DashboardRoutesView }))
);
const TaskRoutesView = lazy(() => import('../routes/TaskRoutes').then((m) => ({ default: m.TaskRoutesView })));
const ChatRoutesView = lazy(() => import('../routes/ChatRoutes').then((m) => ({ default: m.ChatRoutesView })));
const InboxRoutesView = lazy(() => import('../routes/InboxRoutes').then((m) => ({ default: m.InboxRoutesView })));
const AdminRoutesView = lazy(() => import('../routes/AdminRoutes').then((m) => ({ default: m.AdminRoutesView })));
const DocumentsRoutesView = lazy(() =>
  import('../routes/DocumentsRoutes').then((m) => ({ default: m.DocumentsRoutesView }))
);
const CrmRoutesView = lazy(() => import('../routes/CrmRoutes').then((m) => ({ default: m.CrmRoutesView })));
const FinanceRoutesView = lazy(() => import('../routes/FinanceRoutes').then((m) => ({ default: m.FinanceRoutesView })));
const HrRoutesView = lazy(() => import('../routes/HrRoutes').then((m) => ({ default: m.HrRoutesView })));
const ProductionRoutesView = lazy(() =>
  import('../routes/ProductionRoutes').then((m) => ({ default: m.ProductionRoutesView }))
);
const InventoryRoutesView = lazy(() =>
  import('../routes/InventoryRoutes').then((m) => ({ default: m.InventoryRoutesView }))
);

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

  const suspense = (node: React.ReactNode) => <Suspense fallback={<RouteFallback />}>{node}</Suspense>;

  if (view === 'home') {
    return suspense(<DashboardRoutesView {...props} {...dashboardExtra} />);
  }

  if (view === 'tasks' || view === 'spaces' || view === 'search' || view === 'table') {
    return suspense(<TaskRoutesView {...props} view={view} />);
  }

  if (view === 'chat') {
    return suspense(<ChatRoutesView {...props} {...chatExtra} />);
  }

  if (view === 'inbox') {
    return suspense(<InboxRoutesView {...props} />);
  }

  if (view === 'settings') {
    return suspense(<AdminRoutesView {...props} />);
  }

  if (view === 'doc-editor' && props.activeDoc) {
    return suspense(<DocumentsRoutesView {...props} />);
  }

  if (view === 'sales-funnel') {
    return suspense(<CrmRoutesView {...props} />);
  }

  if (view === 'finance') {
    return suspense(<FinanceRoutesView {...props} />);
  }

  if (view === 'employees') {
    return suspense(<HrRoutesView {...props} hrView="employees" />);
  }

  if (view === 'business-processes') {
    return suspense(<HrRoutesView {...props} hrView="business-processes" />);
  }

  if (view === 'production') {
    return suspense(<ProductionRoutesView {...props} />);
  }

  if (view === 'inventory') {
    return suspense(<InventoryRoutesView {...props} />);
  }

  return suspense(<DashboardRoutesView {...props} {...dashboardExtra} />);
};
