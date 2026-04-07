import React, { useLayoutEffect, useMemo, useState } from 'react';
import type { User } from '../types';
import { ModulePageShell } from './ui';
import { MODULE_PAGE_GUTTER, MODULE_PAGE_TOP_PAD } from './ui/moduleAccent';
import { useAppToolbar } from '../contexts/AppToolbarContext';

type ProductionTab = 'orders' | 'work' | 'reports';

interface ProductionViewProps {
  users: User[];
  currentUser: User;
}

export default function ProductionView({ users, currentUser }: ProductionViewProps) {
  const { setLeading, setModule } = useAppToolbar();
  const [tab, setTab] = useState<ProductionTab>('orders');

  const tabs = useMemo(
    () => [
      { id: 'orders' as const, label: 'Заказы' },
      { id: 'work' as const, label: 'Смена / работы' },
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
          <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-2xl p-4 md:p-6">
            <div className="text-sm font-semibold text-gray-900 dark:text-white">Производство</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Вкладка: <span className="font-medium">{tabs.find((x) => x.id === tab)?.label}</span>
            </div>
            <div className="mt-4 text-sm text-gray-700 dark:text-gray-200">
              Здесь будет полноценный модуль: заказы, загрузка, смены, материалы, себестоимость и отчёты.
            </div>
            <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
              Пользователь: {currentUser.name} · Пользователей в системе: {users.length}
            </div>
          </div>
        </div>
      </div>
    </ModulePageShell>
  );
}

