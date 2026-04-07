import React, { useLayoutEffect, useMemo, useState } from 'react';
import type { Department, User } from '../types';
import { ModulePageShell, ModuleSegmentedControl } from './ui';
import { MODULE_PAGE_GUTTER, MODULE_PAGE_TOP_PAD } from './ui/moduleAccent';
import { useAppToolbar } from '../contexts/AppToolbarContext';
import { useProductionStore } from './production/useProductionStore';
import { ProductionMonitorPanel } from './production/ProductionMonitorPanel';
import { ProductionOrdersPanel } from './production/ProductionOrdersPanel';
import { ProductionPlanningPanel } from './production/ProductionPlanningPanel';
import { ProductionReportsPanel } from './production/ProductionReportsPanel';

type ProductionTab = 'monitor' | 'orders' | 'planning' | 'reports';

interface ProductionViewProps {
  users: User[];
  departments: Department[];
  currentUser: User;
}

export default function ProductionView({ users, departments, currentUser }: ProductionViewProps) {
  const { setLeading, setModule } = useAppToolbar();
  const [tab, setTab] = useState<ProductionTab>('monitor');
  const { orders, operations, shiftLogs, stats, setStatus, createOrder, updateOrder, createOperation, updateOperation, logShift } =
    useProductionStore();

  const tabs = useMemo(
    () => [
      { id: 'monitor' as const, label: 'Монитор производства' },
      { id: 'orders' as const, label: 'Заказы' },
      { id: 'planning' as const, label: 'Планирование' },
      { id: 'reports' as const, label: 'Отчёты' },
    ],
    []
  );

  useLayoutEffect(() => {
    const emerald = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
    const idle = 'text-gray-600 dark:text-gray-400';

    setLeading(
      <div className="flex items-center gap-0.5 shrink-0 flex-wrap sm:flex-nowrap" role="tablist" aria-label="Производство">
        {tabs.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={`px-2 sm:px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-medium whitespace-nowrap transition-colors ${
                active ? emerald : `${idle} hover:bg-gray-100 dark:hover:bg-[#252525]`
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    );

    setModule(null);

    return () => {
      setLeading(null);
      setModule(null);
    };
  }, [setLeading, setModule, tab, tabs]);

  return (
    <ModulePageShell>
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className={`${MODULE_PAGE_GUTTER} ${MODULE_PAGE_TOP_PAD} pb-24 md:pb-32 h-full overflow-y-auto overflow-x-hidden custom-scrollbar`}>
          {tab === 'monitor' && <ProductionMonitorPanel orders={orders} operations={operations} users={users} onSetStatus={setStatus} />}
          {tab === 'orders' && (
            <ProductionOrdersPanel
              orders={orders}
              users={users}
              departments={departments}
              onCreateOrder={createOrder}
              onUpdateOrder={updateOrder}
            />
          )}
          {tab === 'planning' && (
            <ProductionPlanningPanel
              orders={orders}
              operations={operations}
              shiftLogs={shiftLogs}
              users={users}
              onCreateOperation={createOperation}
              onUpdateOperation={updateOperation}
              onLogShift={logShift}
            />
          )}
          {tab === 'reports' && (
            <ProductionReportsPanel orders={orders} operations={operations} shiftLogs={shiftLogs} departments={departments} />
          )}
          <div className="mt-3 rounded-xl border border-gray-200 dark:border-[#333] bg-gray-50 dark:bg-[#1a1a1a] p-3">
            <ModuleSegmentedControl
              variant="neutral"
              value={tab}
              onChange={(v) => setTab(v as ProductionTab)}
              options={tabs.map((t) => ({ value: t.id, label: t.label }))}
            />
          </div>
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Ответственный: {currentUser.name} · Активных заказов: {stats.total}
          </div>
        </div>
      </div>
    </ModulePageShell>
  );
}

