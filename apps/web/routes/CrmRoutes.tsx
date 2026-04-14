import React, { lazy, Suspense } from 'react';
import { RouteFallback } from '../components/ui/RouteFallback';
import type { AppRouterProps } from '../components/appRouterTypes';

const CRMHubModuleLazy = lazy(() =>
  import('../components/modules/CRMHubModule').then((m) => ({ default: m.CRMHubModule }))
);

export function CrmRoutesView(props: AppRouterProps) {
  const { actions } = props;
  return (
    <Suspense fallback={<RouteFallback />}>
      <CRMHubModuleLazy
        tab={props.crmHubTab ?? 'funnel'}
        onTabChange={actions.setCrmHubTab}
        headerSearchQuery={props.searchQuery}
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
