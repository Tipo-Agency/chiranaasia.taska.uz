import React, { lazy, Suspense } from 'react';
import { RouteFallback } from '../components/ui/RouteFallback';
import type { AppRouterProps } from '../components/appRouterTypes';

const InventoryViewLazy = lazy(() => import('../components/InventoryView'));

export function InventoryRoutesView(props: AppRouterProps) {
  const { actions } = props;
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
