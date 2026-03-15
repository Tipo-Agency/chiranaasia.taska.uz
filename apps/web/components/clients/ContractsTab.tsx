import React from 'react';
import { Contract, Client } from '../../types';
import { Edit2, X } from 'lucide-react';
import { FilterConfig } from '../FiltersPanel';
import { TaskSelect } from '../TaskSelect';

interface ContractsTabProps {
  contracts: Contract[];
  clients: Client[];
  filters: FilterConfig[];
  showFilters: boolean;
  onClearFilters: () => void;
  onEditContract: (contract: Contract) => void;
}

export const ContractsTab: React.FC<ContractsTabProps> = ({
  contracts,
  clients,
  filters,
  showFilters,
  onClearFilters,
  onEditContract,
}) => {
  return (
    <>
      {showFilters && (
        <div className="mb-4 p-4 bg-gray-50 dark:bg-[#252525] rounded-lg border border-gray-200 dark:border-[#333]">
          <div 
            className="grid gap-3"
            style={{
              gridTemplateColumns: `repeat(auto-fit, minmax(150px, 1fr))`,
              maxWidth: '100%'
            }}
          >
            {filters.map((filter, index) => (
              <div key={index}>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                  {filter.label}
                </label>
                <TaskSelect
                  value={filter.value}
                  onChange={filter.onChange}
                  options={filter.options}
                />
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-end">
            <button
              onClick={onClearFilters}
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 flex items-center gap-1"
            >
              <X size={14} />
              Очистить фильтры
            </button>
          </div>
        </div>
      )}
      <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 dark:bg-[#202020] border-b border-gray-200 dark:border-[#333]">
            <tr>
              <th className="px-4 py-3 text-gray-600 dark:text-gray-400">№</th>
              <th className="px-4 py-3 text-gray-600 dark:text-gray-400">Клиент</th>
              <th className="px-4 py-3 text-gray-600 dark:text-gray-400">Услуги</th>
              <th className="px-4 py-3 text-gray-600 dark:text-gray-400">Сумма (UZS)</th>
              <th className="px-4 py-3 text-gray-600 dark:text-gray-400">Оплата</th>
              <th className="px-4 py-3 text-gray-600 dark:text-gray-400">Статус</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-[#333]">
            {contracts.map(c => {
              const client = clients.find(cl => cl.id === c.clientId);
              return (
                <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-[#303030]">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-200">{c.number}</td>
                  <td className="px-4 py-3 text-gray-800 dark:text-gray-300">{client?.name || '—'}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 max-w-xs truncate">{c.services}</td>
                  <td className="px-4 py-3 font-bold text-gray-800 dark:text-gray-200">{c.amount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">до {c.paymentDay}-го числа</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-[10px] uppercase font-bold ${
                      c.status === 'active' 
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
                        : c.status === 'pending' 
                        ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' 
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                    }`}>
                      {c.status === 'active' ? 'Активен' : c.status === 'pending' ? 'Ожидание' : 'Закрыт'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => onEditContract(c)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-500">
                      <Edit2 size={14}/>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
};

