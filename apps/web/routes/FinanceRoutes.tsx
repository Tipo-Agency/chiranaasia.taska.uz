import React, { lazy, Suspense } from 'react';
import { RouteFallback } from '../components/ui/RouteFallback';
import type { AppRouterProps } from '../components/appRouterTypes';

const FinanceModuleLazy = lazy(() =>
  import('../components/modules/FinanceModule').then((m) => ({ default: m.FinanceModule }))
);

export function FinanceRoutesView(props: AppRouterProps) {
  const { actions } = props;
  return (
    <Suspense fallback={<RouteFallback />}>
      <FinanceModuleLazy
        categories={props.financeCategories}
        funds={props.funds}
        plan={props.financePlan}
        requests={props.purchaseRequests}
        departments={props.departments}
        users={props.users}
        currentUser={props.currentUser}
        financialPlanDocuments={props.financialPlanDocuments}
        financialPlannings={props.financialPlannings}
        bdr={props.bdr}
        actions={actions}
      />
    </Suspense>
  );
}
