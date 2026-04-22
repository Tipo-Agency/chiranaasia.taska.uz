import React, { useMemo } from 'react';
import type { Department, FinanceCategory, PurchaseRequest, User } from '../../types';
import { Button, ModulePageShell, MODULE_PAGE_GUTTER, MODULE_PAGE_TOP_PAD } from '../ui';
import { formatDate } from '../../utils/dateUtils';

function requestStatusLabel(req: PurchaseRequest): { text: string; className: string } {
  if (req.status === 'paid') {
    return {
      text: 'Оплачено',
      className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    };
  }
  if (req.status === 'approved') {
    return {
      text: 'Одобрено',
      className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    };
  }
  if (req.status === 'rejected') {
    return { text: 'Отклонено', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' };
  }
  if (req.status === 'draft' || req.status === 'deferred') {
    return {
      text: 'Черновик',
      className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    };
  }
  return { text: 'Ожидание', className: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' };
}

interface CrmHubRequestsPanelProps {
  purchaseRequests: PurchaseRequest[];
  users: User[];
  financeCategories: FinanceCategory[];
  departments: Department[];
  onOpenFinance: () => void;
}

export const CrmHubRequestsPanel: React.FC<CrmHubRequestsPanelProps> = ({
  purchaseRequests,
  users,
  financeCategories,
  departments,
  onOpenFinance,
}) => {
  const rows = useMemo(() => {
    const list = purchaseRequests.filter((r) => !r.isArchived);
    return [...list].sort((a, b) => {
      const da = a.date || '';
      const db = b.date || '';
      return db.localeCompare(da);
    });
  }, [purchaseRequests]);

  const catName = (r: PurchaseRequest) => {
    if (r.categoryId) {
      const c = financeCategories.find((x) => x.id === r.categoryId);
      if (c?.name) return c.name;
    }
    if (r.category) return r.category;
    return '—';
  };

  const deptName = (r: PurchaseRequest) => {
    if (!r.departmentId) return '—';
    return departments.find((d) => d.id === r.departmentId)?.name || '—';
  };

  return (
    <ModulePageShell className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <div
        className={`${MODULE_PAGE_GUTTER} ${MODULE_PAGE_TOP_PAD} flex-1 min-h-0 flex flex-col overflow-y-auto custom-scrollbar pb-6`}
      >
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 max-w-2xl">
          Заявки на приобретение. Согласование, оплата и архив — в разделе «Финансы».
        </p>
        <div className="mb-4">
          <Button type="button" variant="secondary" onClick={onOpenFinance} className="text-sm">
            Открыть раздел «Финансы»
          </Button>
        </div>
        {rows.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Нет заявок.</p>
        ) : (
          <div className="bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-[#333] rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm min-w-[640px]">
                <thead className="bg-gray-50 dark:bg-[#252525] border-b border-gray-200 dark:border-[#333]">
                  <tr>
                    <th className="px-3 py-2.5 font-semibold text-gray-600 dark:text-gray-400">Название</th>
                    <th className="px-3 py-2.5 font-semibold text-gray-600 dark:text-gray-400">Сумма</th>
                    <th className="px-3 py-2.5 font-semibold text-gray-600 dark:text-gray-400">Статус</th>
                    <th className="px-3 py-2.5 font-semibold text-gray-600 dark:text-gray-400">Дата</th>
                    <th className="px-3 py-2.5 font-semibold text-gray-600 dark:text-gray-400">Категория</th>
                    <th className="px-3 py-2.5 font-semibold text-gray-600 dark:text-gray-400">Подразделение</th>
                    <th className="px-3 py-2.5 font-semibold text-gray-600 dark:text-gray-400">Заявитель</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#333]">
                  {rows.map((r) => {
                    const u = users.find((x) => x.id === r.requesterId);
                    const label = r.requestedBy || u?.name || '—';
                    const st = requestStatusLabel(r);
                    return (
                      <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-[#2a2a2a]">
                        <td className="px-3 py-2.5 font-medium text-gray-800 dark:text-gray-200 max-w-[220px]">
                          <span className="line-clamp-2">{(r.title || '').trim() || '—'}</span>
                        </td>
                        <td className="px-3 py-2.5 text-gray-900 dark:text-white whitespace-nowrap">
                          {r.amount} {r.currency || 'UZS'}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${st.className}`}>
                            {st.text}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                          {r.date ? formatDate(r.date) : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-600 dark:text-gray-400 max-w-[140px]">
                          <span className="line-clamp-2">{catName(r)}</span>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-600 dark:text-gray-400 max-w-[160px]">
                          <span className="line-clamp-2">{deptName(r)}</span>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-600 dark:text-gray-400">{label}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </ModulePageShell>
  );
};
