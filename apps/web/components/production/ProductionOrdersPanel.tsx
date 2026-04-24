import React, { useMemo, useState } from 'react';
import type { Department, User } from '../../types';
import type { ProductionOrder, ProductionOrderPriority, ProductionOrderStatus } from './types';

export function ProductionOrdersPanel({
  orders,
  users,
  departments,
  onCreateOrder,
  onUpdateOrder,
  filterRowHighlight,
}: {
  orders: ProductionOrder[];
  users: User[];
  departments: Department[];
  onCreateOrder: (payload: Partial<ProductionOrder> & { title: string }) => void;
  onUpdateOrder: (id: string, patch: Partial<ProductionOrder>) => void;
  /** Подсветка блока поиска/статуса при открытом фильтре в шапке модуля */
  filterRowHighlight?: boolean;
}) {
  const [title, setTitle] = useState('');
  const [plannedQty, setPlannedQty] = useState(0);
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<ProductionOrderPriority>('normal');
  const [statusFilter, setStatusFilter] = useState<'all' | ProductionOrderStatus>('all');
  const [q, setQ] = useState('');

  const active = useMemo(() => orders.filter((o) => !o.isArchived), [orders]);
  const filtered = useMemo(
    () =>
      active.filter((o) => {
        if (statusFilter !== 'all' && o.status !== statusFilter) return false;
        const hay = `${o.title} ${o.clientName || ''}`.toLowerCase();
        return !q.trim() || hay.includes(q.trim().toLowerCase());
      }),
    [active, statusFilter, q]
  );

  return (
    <div className="space-y-3">
      <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-2xl p-4">
        <div className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Новый производственный заказ</div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Название заказа"
            className="h-10 rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1a1a1a] px-3 text-sm md:col-span-2"
          />
          <input
            type="text"
            inputMode="numeric"
            value={String(plannedQty)}
            onChange={(e) => setPlannedQty(Number(e.target.value.replace(/\D/g, '') || 0))}
            placeholder="План. количество"
            className="h-10 rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1a1a1a] px-3 text-sm"
          />
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="h-10 rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1a1a1a] px-3 text-sm"
          />
          <button
            type="button"
            onClick={() => {
              const t = title.trim();
              if (!t) return;
              onCreateOrder({ title: t, plannedQty, dueDate: dueDate || undefined, priority });
              setTitle('');
              setPlannedQty(0);
              setDueDate('');
            }}
            className="h-10 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-semibold"
          >
            Создать
          </button>
        </div>
        <div className="mt-2">
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as ProductionOrderPriority)}
            className="h-9 rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1a1a1a] px-2 text-xs"
          >
            <option value="low">Приоритет: Низкий</option>
            <option value="normal">Приоритет: Нормальный</option>
            <option value="high">Приоритет: Высокий</option>
            <option value="urgent">Приоритет: Срочный</option>
          </select>
        </div>
      </div>

      <div
        className={`bg-white dark:bg-[#252525] border rounded-2xl p-3 flex flex-wrap gap-2 items-center transition-shadow ${
          filterRowHighlight
            ? 'border-emerald-400 dark:border-emerald-600 ring-2 ring-emerald-500/35'
            : 'border-gray-200 dark:border-[#333]'
        }`}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск заказа..."
          className="h-9 rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1a1a1a] px-3 text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | ProductionOrderStatus)}
          className="h-9 rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1a1a1a] px-3 text-sm"
        >
          <option value="all">Все статусы</option>
          <option value="queued">В очереди</option>
          <option value="in_progress">В работе</option>
          <option value="paused">Пауза</option>
          <option value="done">Готово</option>
        </select>
      </div>

      <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-[#202020] text-xs text-gray-600 dark:text-gray-400">
              <tr>
                <th className="text-left px-4 py-3">Заказ</th>
                <th className="text-left px-4 py-3">Статус</th>
                <th className="text-left px-4 py-3">Приоритет</th>
                <th className="text-right px-4 py-3">План</th>
                <th className="text-right px-4 py-3">Факт</th>
                <th className="text-right px-4 py-3">Брак</th>
                <th className="text-left px-4 py-3">Дедлайн</th>
                <th className="text-left px-4 py-3">Подразделение</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id} className="border-t border-gray-100 dark:border-[#333]">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{o.title}</td>
                  <td className="px-4 py-3">
                    <select
                      value={o.status}
                      onChange={(e) => onUpdateOrder(o.id, { status: e.target.value as ProductionOrderStatus })}
                      className="h-8 rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1a1a1a] px-2 text-xs"
                    >
                      <option value="queued">В очереди</option>
                      <option value="in_progress">В работе</option>
                      <option value="paused">Пауза</option>
                      <option value="done">Готово</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={o.priority}
                      onChange={(e) => onUpdateOrder(o.id, { priority: e.target.value as ProductionOrderPriority })}
                      className="h-8 rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1a1a1a] px-2 text-xs"
                    >
                      <option value="low">Низкий</option>
                      <option value="normal">Нормальный</option>
                      <option value="high">Высокий</option>
                      <option value="urgent">Срочный</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right">{o.plannedQty.toLocaleString('ru-RU')}</td>
                  <td className="px-4 py-3 text-right">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={String(o.producedQty)}
                      onChange={(e) => onUpdateOrder(o.id, { producedQty: Number(e.target.value.replace(/\D/g, '') || 0) })}
                      className="w-24 ml-auto block h-8 text-right rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1a1a1a] px-2 text-xs"
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={String(o.defectQty)}
                      onChange={(e) => onUpdateOrder(o.id, { defectQty: Number(e.target.value.replace(/\D/g, '') || 0) })}
                      className="w-20 ml-auto block h-8 text-right rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1a1a1a] px-2 text-xs"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="date"
                      value={o.dueDate || ''}
                      onChange={(e) => onUpdateOrder(o.id, { dueDate: e.target.value || undefined })}
                      className="h-8 rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1a1a1a] px-2 text-xs"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={o.departmentId || ''}
                      onChange={(e) => onUpdateOrder(o.id, { departmentId: e.target.value || undefined })}
                      className="h-8 rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1a1a1a] px-2 text-xs"
                    >
                      <option value="">Без подразделения</option>
                      {departments
                        .filter((d) => !d.isArchived)
                        .map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-400">
        Пользователей в системе: {users.filter((u) => !u.isArchived).length}
      </div>
    </div>
  );
}

