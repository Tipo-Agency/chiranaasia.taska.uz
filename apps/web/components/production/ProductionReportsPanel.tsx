import React, { useMemo } from 'react';
import type { Department } from '../../types';
import type { ProductionOperation, ProductionOrder, ProductionShiftLog } from './types';

export function ProductionReportsPanel({
  orders,
  operations,
  shiftLogs,
  departments,
}: {
  orders: ProductionOrder[];
  operations: ProductionOperation[];
  shiftLogs: ProductionShiftLog[];
  departments: Department[];
}) {
  const active = useMemo(() => orders.filter((o) => !o.isArchived), [orders]);
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);

  const deptRows = useMemo(() => {
    const map = new Map<string, { planned: number; produced: number; defect: number }>();
    for (const order of active) {
      const key = order.departmentId || 'none';
      const cur = map.get(key) || { planned: 0, produced: 0, defect: 0 };
      cur.planned += order.plannedQty || 0;
      cur.produced += order.producedQty || 0;
      cur.defect += order.defectQty || 0;
      map.set(key, cur);
    }
    return Array.from(map.entries()).map(([id, row]) => {
      const dept = departments.find((d) => d.id === id);
      const completion = row.planned > 0 ? Math.round((row.produced / row.planned) * 100) : 0;
      const defectRate = row.produced > 0 ? Math.round((row.defect / row.produced) * 1000) / 10 : 0;
      return {
        id,
        name: dept?.name || 'Без подразделения',
        ...row,
        completion,
        defectRate,
      };
    });
  }, [active, departments]);

  const shiftMonthMinutes = useMemo(
    () => shiftLogs.filter((x) => x.date.startsWith(month)).reduce((s, x) => s + (x.minutes || 0), 0),
    [shiftLogs, month]
  );

  const operationPerf = useMemo(() => {
    const rows = operations.filter((o) => !o.isArchived);
    const planned = rows.reduce((s, r) => s + (r.plannedMinutes || 0), 0);
    const spent = rows.reduce((s, r) => s + (r.spentMinutes || 0), 0);
    const efficiency = spent > 0 ? Math.round((planned / spent) * 100) : 0;
    return { planned, spent, efficiency };
  }, [operations]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <KpiCard title="Заказы (активные)" value={String(active.length)} />
        <KpiCard title="Часы смен за месяц" value={String(Math.round((shiftMonthMinutes / 60) * 10) / 10)} />
        <KpiCard title="План операций, ч" value={String(Math.round((operationPerf.planned / 60) * 10) / 10)} />
        <KpiCard title="Эффективность, %" value={String(operationPerf.efficiency)} />
      </div>

      <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-[#333] text-sm font-semibold text-gray-900 dark:text-white">
          Выпуск по подразделениям
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-[#202020] text-xs text-gray-600 dark:text-gray-400">
              <tr>
                <th className="text-left px-4 py-3">Подразделение</th>
                <th className="text-right px-4 py-3">План</th>
                <th className="text-right px-4 py-3">Факт</th>
                <th className="text-right px-4 py-3">Выполнение</th>
                <th className="text-right px-4 py-3">Брак, %</th>
              </tr>
            </thead>
            <tbody>
              {deptRows.map((row) => (
                <tr key={row.id} className="border-t border-gray-100 dark:border-[#333]">
                  <td className="px-4 py-3 text-gray-900 dark:text-white">{row.name}</td>
                  <td className="px-4 py-3 text-right">{row.planned.toLocaleString('ru-RU')}</td>
                  <td className="px-4 py-3 text-right">{row.produced.toLocaleString('ru-RU')}</td>
                  <td className="px-4 py-3 text-right">{row.completion}%</td>
                  <td className="px-4 py-3 text-right">{row.defectRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-[#333] bg-white dark:bg-[#252525] p-3">
      <div className="text-[11px] text-gray-500 dark:text-gray-400">{title}</div>
      <div className="text-xl font-semibold text-gray-900 dark:text-white">{value}</div>
    </div>
  );
}

