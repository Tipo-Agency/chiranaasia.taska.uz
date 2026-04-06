import React, { useLayoutEffect, useMemo } from 'react';
import {
  EmployeeInfo,
  User,
  Department,
  OrgPosition,
  BusinessProcess,
  Task,
  TableCollection,
  Warehouse,
  InventoryItem,
  StockBalance,
  StockMovement,
  InventoryRevision,
} from '../../types';
import type { AppActions } from '../../frontend/hooks/useAppLogic';
import { hasPermission } from '../../utils/permissions';
import { ModuleSegmentedControl } from '../ui';
import { HRModule } from './HRModule';
import InventoryView from '../InventoryView';

export type BpmHubTab = 'processes' | 'inventory';

interface BPMHubModuleProps {
  tab: BpmHubTab;
  onTabChange: (tab: BpmHubTab) => void;
  currentUser: User;
  employees: EmployeeInfo[];
  users: User[];
  departments: Department[];
  orgPositions: OrgPosition[];
  processes: BusinessProcess[];
  tasks?: Task[];
  tables?: TableCollection[];
  warehouses: Warehouse[];
  items: InventoryItem[];
  balances: StockBalance[];
  movements: StockMovement[];
  revisions: InventoryRevision[];
  actions: AppActions;
}

export const BPMHubModule: React.FC<BPMHubModuleProps> = ({
  tab,
  onTabChange,
  currentUser,
  employees,
  users,
  departments,
  orgPositions,
  processes,
  tasks = [],
  tables = [],
  warehouses,
  items,
  balances,
  movements,
  revisions,
  actions,
}) => {
  const canBpm = hasPermission(currentUser, 'org.bpm');
  const canInventory = hasPermission(currentUser, 'org.inventory');

  const options = useMemo(() => {
    const o: { value: BpmHubTab; label: string }[] = [];
    if (canBpm) o.push({ value: 'processes', label: 'Процессы' });
    if (canInventory) o.push({ value: 'inventory', label: 'Склад' });
    return o;
  }, [canBpm, canInventory]);

  const effectiveTab: BpmHubTab = useMemo(() => {
    if (options.some((x) => x.value === tab)) return tab;
    return options[0]?.value || 'processes';
  }, [options, tab]);

  useLayoutEffect(() => {
    if (!options.length) return;
    if (tab !== effectiveTab) onTabChange(effectiveTab);
  }, [options.length, tab, effectiveTab, onTabChange]);

  if (!options.length) {
    return (
      <div className="h-full flex items-center justify-center p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
        Нет доступа к бизнес-процессам и складу.
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 flex flex-col bg-white dark:bg-[#191919]">
      {options.length > 1 && (
        <div className="shrink-0 border-b border-gray-200 dark:border-[#333] px-4 py-3 md:px-6">
          <ModuleSegmentedControl
            variant="neutral"
            value={effectiveTab}
            onChange={(v) => onTabChange(v as BpmHubTab)}
            options={options}
          />
        </div>
      )}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {effectiveTab === 'processes' && canBpm && (
          <HRModule
            view="business-processes"
            employees={employees}
            users={users}
            departments={departments}
            orgPositions={orgPositions}
            processes={processes}
            tasks={tasks}
            tables={tables}
            currentUser={currentUser}
            actions={actions}
          />
        )}
        {effectiveTab === 'inventory' && canInventory && (
          <InventoryView
            departments={departments}
            warehouses={warehouses}
            items={items}
            balances={balances}
            movements={movements}
            revisions={revisions}
            currentUserId={currentUser.id}
            onSaveWarehouse={actions.saveWarehouse}
            onDeleteWarehouse={actions.deleteWarehouse}
            onSaveItem={actions.saveInventoryItem}
            onDeleteItem={actions.deleteInventoryItem}
            onCreateMovement={actions.createInventoryMovement}
            onCreateRevision={actions.createInventoryRevision}
            onUpdateRevision={actions.updateInventoryRevision}
            onPostRevision={actions.postInventoryRevision}
          />
        )}
      </div>
    </div>
  );
};
