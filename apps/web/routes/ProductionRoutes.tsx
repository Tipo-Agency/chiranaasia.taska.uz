import React, { lazy, Suspense } from 'react';
import { RouteFallback } from '../components/ui/RouteFallback';
import type { AppRouterProps } from '../components/appRouterTypes';

const ProductionViewLazy = lazy(() => import('../components/ProductionView'));

export function ProductionRoutesView(props: AppRouterProps) {
  const { actions } = props;
  return (
    <Suspense fallback={<RouteFallback />}>
      <ProductionViewLazy
        users={props.users}
        departments={props.departments}
        currentUser={props.currentUser}
        productionPipelines={props.productionPipelines ?? []}
        productionBoardOrders={props.productionBoardOrders ?? []}
        onRefreshProductionRoutes={actions.refreshProductionRoutes}
        onCreateProductionRouteOrder={actions.createProductionRouteOrder}
        onProductionHandOver={actions.productionHandOver}
        onProductionResolveHandoff={actions.productionResolveHandoff}
        onProductionCompleteOrder={actions.productionCompleteOrder}
      />
    </Suspense>
  );
}
