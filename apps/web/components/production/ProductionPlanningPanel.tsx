import React, { useMemo, useState } from 'react';
import type { User } from '../../types';
import type { ProductionOperation, ProductionOperationStatus, ProductionOrder, ProductionShiftLog } from './types';

export function ProductionPlanningPanel({
  orders,
  operations,
  shiftLogs,
  users,
  onCreateOperation,
  onUpdateOperation,
  onLogShift,
}: {
  orders: ProductionOrder[];
  operations: ProductionOperation[];
  shiftLogs: ProductionShiftLog[];
  users: User[];
  onCreateOperation: (payload: Partial<ProductionOperation> & { orderId: string; title: string }) => void;
  onUpdateOperation: (id: string, patch: Partial<ProductionOperation>) => void;
  onLogShift: (payload: Omit<ProductionShiftLog, 'id' | 'createdAt'>) => void;
}) {
  const [orderId, setOrderId] = useState('');
  const [title, setTitle] = useState('');
  const [workcenter, setWorkcenter] = useState('');
  const [plannedMinutes, setPlannedMinutes] = useState(60);

  const [logDate, setLogDate] = useState(new Date().toISOString().slice(0, 10));
  const [logUserId, setLogUserId] = useState('');
  const [logOrderId, setLogOrderId] = useState('');
  const [logOperationId, setLogOperationId] = useState('');
  const [logMinutes, setLogMinutes] = useState(60);
  const [logComment, setLogComment] = useState('');

  const activeOrders = useMemo(() => orders.filter((o) => !o.isArchived), [orders]);
  const activeOperations = useMemo(() => operations.filter((o) => !o.isArchived), [operations]);
  const operationsByOrderId = useMemo(() => {
    const map = new Map<string, ProductionOperation[]>();
    for (const op of activeOperations) {
      const list = map.get(op.orderId) || [];
      list.push(op);
      map.set(op.orderId, list);
    }
    return map;
  }, [activeOperations]);

  const todayMinutes = useMemo(
    () => shiftLogs.filter((x) => x.date === logDate).reduce((s, x) => s + (x.minutes || 0), 0),
    [shiftLogs, logDate]
  );

  return (
    <div className="space-y-3">
      <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-2xl p-4">
        <div className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Планирование операций</div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
          <select
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            className="h-10 rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1a1a1a] px-3 text-sm"
          >
            <option value="">Выберите заказ</option>
            {activeOrders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title}
              </option>
            ))}
          </select>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Операция"
            className="h-10 rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1a1a1a] px-3 text-sm"
          />
          <input
            value={workcenter}
            onChange={(e) => setWorkcenter(e.target.value)}
            placeholder="Рабочий центр/цех"
            className="h-10 rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1a1a1a] px-3 text-sm"
          />
          <input
            type="text"
            inputMode="numeric"
            value={String(plannedMinutes)}
            onChange={(e) => setPlannedMinutes(Number(e.target.value.replace(/\D/g, '') || 0))}
            placeholder="План, мин"
            className="h-10 rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1a1a1a] px-3 text-sm"
          />
          <button
            type="button"
            onClick={() => {
              if (!orderId || !title.trim()) return;
              onCreateOperation({ orderId, title: title.trim(), workcenter, plannedMinutes });
              setTitle('');
              setWorkcenter('');
              setPlannedMinutes(60);
            }}
            className="h-10 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-semibold"
          >
            Добавить операцию
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-[#202020] text-xs text-gray-600 dark:text-gray-400">
              <tr>
                <th className="text-left px-4 py-3">Заказ</th>
                <th className="text-left px-4 py-3">Операция</th>
                <th className="text-left px-4 py-3">Статус</th>
                <th className="text-left px-4 py-3">Цех</th>
                <th className="text-right px-4 py-3">План, мин</th>
                <th className="text-right px-4 py-3">Факт, мин</th>
              </tr>
            </thead>
            <tbody>
              {activeOrders.map((order) =>
                (operationsByOrderId.get(order.id) || []).map((op) => (
                  <tr key={op.id} className="border-t border-gray-100 dark:border-[#333]">
                    <td className="px-4 py-3 text-gray-900 dark:text-white">{order.title}</td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{op.title}</td>
                    <td className="px-4 py-3">
                      <select
                        value={op.status}
                        onChange={(e) => onUpdateOperation(op.id, { status: e.target.value as ProductionOperationStatus })}
                        className="h-8 rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1a1a1a] px-2 text-xs"
                      >
                        <option value="queued">В очереди</option>
                        <option value="in_progress">В работе</option>
                        <option value="blocked">Блок</option>
                        <option value="done">Готово</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        value={op.workcenter || ''}
                        onChange={(e) => onUpdateOperation(op.id, { workcenter: e.target.value })}
                        className="h-8 rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1a1a1a] px-2 text-xs"
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={String(op.plannedMinutes)}
                        onChange={(e) => onUpdateOperation(op.id, { plannedMinutes: Number(e.target.value.replace(/\D/g, '') || 0) })}
                        className="w-24 ml-auto block h-8 text-right rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1a1a1a] px-2 text-xs"
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={String(op.spentMinutes)}
                        onChange={(e) => onUpdateOperation(op.id, { spentMinutes: Number(e.target.value.replace(/\D/g, '') || 0) })}
                        className="w-24 ml-auto block h-8 text-right rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1a1a1a] px-2 text-xs"
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-2xl p-4">
        <div className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Сменные логи</div>
        <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
          <input
            type="date"
            value={logDate}
            onChange={(e) => setLogDate(e.target.value)}
            className="h-10 rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1a1a1a] px-3 text-sm"
          />
          <select
            value={logUserId}
            onChange={(e) => setLogUserId(e.target.value)}
            className="h-10 rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1a1a1a] px-3 text-sm"
          >
            <option value="">Сотрудник</option>
            {users
              .filter((u) => !u.isArchived)
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
          </select>
          <select
            value={logOrderId}
            onChange={(e) => {
              setLogOrderId(e.target.value);
              setLogOperationId('');
            }}
            className="h-10 rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1a1a1a] px-3 text-sm"
          >
            <option value="">Заказ</option>
            {activeOrders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title}
              </option>
            ))}
          </select>
          <select
            value={logOperationId}
            onChange={(e) => setLogOperationId(e.target.value)}
            className="h-10 rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1a1a1a] px-3 text-sm"
          >
            <option value="">Операция</option>
            {(operationsByOrderId.get(logOrderId) || []).map((op) => (
              <option key={op.id} value={op.id}>
                {op.title}
              </option>
            ))}
          </select>
          <input
            type="text"
            inputMode="numeric"
            value={String(logMinutes)}
            onChange={(e) => setLogMinutes(Number(e.target.value.replace(/\D/g, '') || 0))}
            placeholder="Минуты"
            className="h-10 rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1a1a1a] px-3 text-sm"
          />
          <input
            value={logComment}
            onChange={(e) => setLogComment(e.target.value)}
            placeholder="Комментарий"
            className="h-10 rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1a1a1a] px-3 text-sm"
          />
          <button
            type="button"
            onClick={() => {
              if (!logDate || !logUserId || !logMinutes) return;
              onLogShift({
                date: logDate,
                userId: logUserId,
                orderId: logOrderId || undefined,
                operationId: logOperationId || undefined,
                minutes: logMinutes,
                comment: logComment || undefined,
              });
              setLogComment('');
            }}
            className="h-10 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-semibold"
          >
            Записать смену
          </button>
        </div>
        <div className="mt-3 text-xs text-gray-600 dark:text-gray-300">Итого по дню: {todayMinutes} мин</div>
      </div>
    </div>
  );
}

