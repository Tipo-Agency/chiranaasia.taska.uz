import React from 'react';
import type { User } from '../../types';
import type { ProductionOperation, ProductionOrder, ProductionOrderStatus } from './types';

export function ProductionMonitorPanel({
  orders,
  operations,
  users,
  onSetStatus,
}: {
  orders: ProductionOrder[];
  operations: ProductionOperation[];
  users: User[];
  onSetStatus: (id: string, status: ProductionOrderStatus) => void;
}) {
  const active = orders.filter((o) => !o.isArchived);
  const activeOps = operations.filter((o) => !o.isArchived);
  const totalPlanned = active.reduce((s, o) => s + (o.plannedQty || 0), 0);
  const totalProduced = active.reduce((s, o) => s + (o.producedQty || 0), 0);
  const completion = totalPlanned > 0 ? Math.round((totalProduced / totalPlanned) * 100) : 0;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
        {[
          ['Всего', active.length],
          ['В очереди', active.filter((o) => o.status === 'queued').length],
          ['В работе', active.filter((o) => o.status === 'in_progress').length],
          ['Пауза', active.filter((o) => o.status === 'paused').length],
          ['Готово', active.filter((o) => o.status === 'done').length],
          ['Операций', activeOps.length],
          ['Выполнение', `${completion}%`],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border border-gray-200 dark:border-[#333] bg-white dark:bg-[#252525] p-3">
            <div className="text-[11px] text-gray-500 dark:text-gray-400">{label}</div>
            <div className="text-xl font-semibold text-gray-900 dark:text-white">{value}</div>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-[#202020] text-xs text-gray-600 dark:text-gray-400">
              <tr>
                <th className="text-left px-4 py-3">Заказ</th>
                <th className="text-left px-4 py-3">Статус</th>
                <th className="text-right px-4 py-3">План</th>
                <th className="text-right px-4 py-3">Выпуск</th>
                <th className="text-right px-4 py-3">Брак</th>
                <th className="text-left px-4 py-3">Исполнители</th>
              </tr>
            </thead>
            <tbody>
              {active.map((o) => (
                <tr key={o.id} className="border-t border-gray-100 dark:border-[#333]">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{o.title}</td>
                  <td className="px-4 py-3">
                    <select
                      value={o.status}
                      onChange={(e) => onSetStatus(o.id, e.target.value as ProductionOrderStatus)}
                      className="h-8 rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1a1a1a] px-2 text-xs"
                    >
                      <option value="queued">В очереди</option>
                      <option value="in_progress">В работе</option>
                      <option value="paused">Пауза</option>
                      <option value="done">Готово</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right">{o.plannedQty.toLocaleString('ru-RU')}</td>
                  <td className="px-4 py-3 text-right">{o.producedQty.toLocaleString('ru-RU')}</td>
                  <td className="px-4 py-3 text-right">{o.defectQty.toLocaleString('ru-RU')}</td>
                  <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300">
                    {o.assigneeUserIds.length
                      ? o.assigneeUserIds
                          .map((id) => users.find((u) => u.id === id)?.name || '—')
                          .filter(Boolean)
                          .join(', ')
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

