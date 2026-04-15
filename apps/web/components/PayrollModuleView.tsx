import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { Department, User } from '../types';
import {
  APP_TOOLBAR_MODULE_CLUSTER,
  MODULE_PAGE_GUTTER,
  MODULE_PAGE_TOP_PAD,
  ModuleFilterIconButton,
  ModulePageShell,
} from './ui';
import { useAppToolbar } from '../contexts/AppToolbarContext';
import { PayrollView, type PayrollViewHandle } from './finance/PayrollView';

export interface PayrollModuleViewProps {
  users: User[];
  departments: Department[];
  /** Внутри «Сотрудники» — не трогаем общий тулбар, блок месяца всегда над таблицей */
  embedded?: boolean;
}

function PeriodStrip({
  payrollPeriod,
  setPayrollPeriod,
  onCopyPrev,
}: {
  payrollPeriod: string;
  setPayrollPeriod: (v: string) => void;
  onCopyPrev: () => void;
}) {
  return (
    <div
      className={`${MODULE_PAGE_GUTTER} ${MODULE_PAGE_TOP_PAD} pb-2 flex-shrink-0 border-b border-gray-200 dark:border-[#333]`}
    >
      <div className="p-4 bg-gray-50 dark:bg-[#252525] rounded-lg border border-gray-200 dark:border-[#333]">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 shrink-0">Месяц</label>
          <input
            type="month"
            value={payrollPeriod}
            onChange={(e) => setPayrollPeriod(e.target.value)}
            className="h-9 rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1a1a1a] px-3 text-sm text-gray-900 dark:text-gray-100"
          />
          <button
            type="button"
            onClick={onCopyPrev}
            className="h-9 px-3 rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1a1a1a] text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#2a2a2a]"
            title="Скопировать табель и начисления из прошлого месяца"
          >
            Копировать месяц
          </button>
        </div>
      </div>
    </div>
  );
}

/** Зарплата (табель, условия, расчёт) — вкладка в разделе «Сотрудники»; данные в localStorage `payroll:*`. */
export const PayrollModuleView: React.FC<PayrollModuleViewProps> = ({ users, departments, embedded = false }) => {
  const { setLeading, setModule } = useAppToolbar();
  const payrollRef = useRef<PayrollViewHandle>(null);
  const [payrollPeriod, setPayrollPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [payrollFiltersOpen, setPayrollFiltersOpen] = useState(false);

  const toggleFilters = useCallback(() => {
    setPayrollFiltersOpen((o) => !o);
  }, []);

  useLayoutEffect(() => {
    if (embedded) return;
    setLeading(
      <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">Зарплата</div>
    );
    setModule(
      <div className={APP_TOOLBAR_MODULE_CLUSTER}>
        <ModuleFilterIconButton
          accent="orange"
          size="sm"
          active={payrollFiltersOpen}
          label="Период и копирование"
          onClick={toggleFilters}
        />
      </div>
    );
    return () => {
      setLeading(null);
      setModule(null);
    };
  }, [embedded, setLeading, setModule, payrollFiltersOpen, toggleFilters]);

  const hasStrip = embedded || payrollFiltersOpen;

  const payrollScroll = (
    <div
      className={`${MODULE_PAGE_GUTTER} ${
        hasStrip ? 'pt-2 sm:pt-3' : MODULE_PAGE_TOP_PAD
      } pb-20 h-full overflow-y-auto custom-scrollbar flex-1 flex flex-col min-h-0`}
    >
      <PayrollView
        ref={payrollRef}
        users={users}
        departments={departments}
        initialPeriod={payrollPeriod}
        controlledPeriod={{ value: payrollPeriod, onChange: setPayrollPeriod }}
        hideTopChrome
      />
    </div>
  );

  if (embedded) {
    return (
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <PeriodStrip
          payrollPeriod={payrollPeriod}
          setPayrollPeriod={setPayrollPeriod}
          onCopyPrev={() => payrollRef.current?.copyFromPrevMonth()}
        />
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">{payrollScroll}</div>
      </div>
    );
  }

  return (
    <ModulePageShell className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {hasStrip && (
        <PeriodStrip
          payrollPeriod={payrollPeriod}
          setPayrollPeriod={setPayrollPeriod}
          onCopyPrev={() => payrollRef.current?.copyFromPrevMonth()}
        />
      )}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">{payrollScroll}</div>
    </ModulePageShell>
  );
};
