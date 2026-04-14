import React, { useLayoutEffect, useMemo, useState } from 'react';
import { BarChart3, ClipboardList, Factory, LayoutDashboard } from 'lucide-react';
import type { Department, User } from '../types';
import { ModuleCreateDropdown, ModuleFilterIconButton, ModulePageShell } from './ui';
import {
  MODULE_PAGE_GUTTER,
  MODULE_PAGE_TOP_PAD,
  APP_TOOLBAR_MODULE_CLUSTER,
  MODULE_ACCENTS,
  MODULE_TOOLBAR_TAB_IDLE,
} from './ui/moduleAccent';
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
  const [prodFiltersOpen, setProdFiltersOpen] = useState(false);
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
    const tabActive = MODULE_ACCENTS.amber.navIconActive;
    const idle = MODULE_TOOLBAR_TAB_IDLE;

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
                active ? tabActive : idle
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    );

    setModule(
      <div className={APP_TOOLBAR_MODULE_CLUSTER}>
        <ModuleFilterIconButton
          accent="amber"
          size="sm"
          active={prodFiltersOpen}
          label="Фильтры производства"
          onClick={() => setProdFiltersOpen((o) => !o)}
        />
        <ModuleCreateDropdown
          accent="amber"
          buttonSize="sm"
          label="Создать"
          items={[
            {
              id: 'order',
              label: 'Производственный заказ',
              icon: ClipboardList,
              onClick: () => setTab('orders'),
              iconClassName: 'text-emerald-600 dark:text-emerald-400',
            },
            {
              id: 'planning',
              label: 'Планирование и смены',
              icon: Factory,
              onClick: () => setTab('planning'),
              iconClassName: 'text-emerald-600 dark:text-emerald-400',
            },
            {
              id: 'monitor',
              label: 'Монитор производства',
              icon: LayoutDashboard,
              onClick: () => setTab('monitor'),
              iconClassName: 'text-emerald-600 dark:text-emerald-400',
            },
            {
              id: 'reports',
              label: 'Отчёты',
              icon: BarChart3,
              onClick: () => setTab('reports'),
              iconClassName: 'text-emerald-600 dark:text-emerald-400',
            },
          ]}
        />
      </div>
    );

    return () => {
      setLeading(null);
      setModule(null);
    };
  }, [setLeading, setModule, tab, tabs, prodFiltersOpen]);

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
              filterRowHighlight={prodFiltersOpen && tab === 'orders'}
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
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Ответственный: {currentUser.name} · Активных заказов: {stats.total}
          </div>
        </div>
      </div>
    </ModulePageShell>
  );
}

