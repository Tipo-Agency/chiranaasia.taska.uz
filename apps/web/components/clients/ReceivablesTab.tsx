import React from 'react';
import { AccountsReceivable, Client } from '../../types';
import { Trash2, X } from 'lucide-react';
import { FilterConfig } from '../FiltersPanel';
import { EntitySearchSelect } from '../ui/EntitySearchSelect';

interface ReceivablesTabProps {
  receivables: AccountsReceivable[];
  clients: Client[];
  onOpenReceivable?: (receivable: AccountsReceivable) => void;
  onDeleteReceivable?: (id: string) => void;
  filters?: FilterConfig[];
  showFilters?: boolean;
  onClearFilters?: () => void;
}

export const ReceivablesTab: React.FC<ReceivablesTabProps> = ({
  receivables,
  clients,
  onOpenReceivable,
  onDeleteReceivable,
  filters = [],
  showFilters = false,
  onClearFilters,
}) => {
  return (
    <>
      {showFilters && filters.length > 0 && (
        <div className="mb-4 p-4 bg-gray-50 dark:bg-[#252525] rounded-lg border border-gray-200 dark:border-[#333]">
          <div
            className="grid gap-3"
            style={{
              gridTemplateColumns: `repeat(auto-fit, minmax(150px, 1fr))`,
              maxWidth: '100%',
            }}
          >
            {filters.map((filter, index) => (
              <div key={index}>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                  {filter.label}
                </label>
                <EntitySearchSelect
                  value={filter.value}
                  onChange={filter.onChange}
                  options={filter.options.map((o) => ({ ...o, searchText: o.label }))}
                />
              </div>
            ))}
          </div>
          {onClearFilters && (
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={onClearFilters}
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 flex items-center gap-1"
              >
                <X size={14} />
                Очистить фильтры
              </button>
            </div>
          )}
        </div>
      )}
    <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl shadow-sm overflow-hidden">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 dark:bg-[#202020] border-b border-gray-200 dark:border-[#333]">
          <tr>
            <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Клиент</th>
            <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Сумма</th>
            <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Срок</th>
            <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Статус</th>
            <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Описание</th>
            <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase text-right">Действия</th>
          </tr>
        </thead>
        <tbody>
          {receivables.map(receivable => {
            const client = clients.find(c => c.id === receivable.clientId);
            const statusColors: Record<string, string> = {
              pending: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
              partial: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
              overdue: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
              paid: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
            };
            const statusLabels: Record<string, string> = {
              pending: 'Ожидание',
              partial: 'Частично',
              overdue: 'Просрочено',
              paid: 'Оплачено',
            };
            return (
              <tr
                key={receivable.id}
                className={`border-b border-gray-100 dark:border-[#333] hover:bg-gray-50 dark:hover:bg-[#2a2a2a] group ${onOpenReceivable ? 'cursor-pointer' : ''}`}
                onClick={() => onOpenReceivable?.(receivable)}
                title={onOpenReceivable ? 'Открыть задолженность' : undefined}
              >
                <td className="px-4 py-3 text-gray-800 dark:text-gray-200 font-medium">
                  {client?.name || '—'}
                </td>
                <td className="px-4 py-3 text-gray-800 dark:text-gray-200 font-medium">
                  {receivable.amount.toLocaleString()} {receivable.currency || 'UZS'}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                  {receivable.dueDate ? new Date(receivable.dueDate).toLocaleDateString() : '—'}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${statusColors[receivable.status] || statusColors.pending}`}>
                    {statusLabels[receivable.status] || receivable.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-sm">
                  {receivable.description || '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  {onDeleteReceivable && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); onDeleteReceivable(receivable.id); }}
                      className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                    >
                      <Trash2 size={14}/>
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
          {receivables.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">
                Задолженностей нет
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
    </>
  );
};

