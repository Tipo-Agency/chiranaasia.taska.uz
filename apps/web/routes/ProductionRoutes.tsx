import React, { lazy, Suspense } from 'react';
import { RouteFallback } from '../components/ui/RouteFallback';
import type { AppRouterProps } from '../components/appRouterTypes';

const ProductionViewLazy = lazy(() => import('../components/ProductionView'));

export function ProductionRoutesView(props: AppRouterProps) {
  return (
    <Suspense fallback={<RouteFallback />}>
      <ProductionViewLazy users={props.users} departments={props.departments} currentUser={props.currentUser} />
    </Suspense>
  );
}
