import React from 'react';
import { Contract, Client } from '../../types';
import { Calendar, TrendingUp, FileCheck } from 'lucide-react';

interface FinanceTabProps {
  contracts: Contract[];
  clients: Client[];
  onOpenContractEdit: (contract: Contract) => void;
}

export const FinanceTab: React.FC<FinanceTabProps> = ({
  contracts,
  clients,
  onOpenContractEdit,
}) => {
  // Проверяем, что contracts и clients являются массивами
  const safeContracts = Array.isArray(contracts) ? contracts : [];
  const safeClients = Array.isArray(clients) ? clients : [];
  
  const activeContracts = safeContracts.filter(c => c && !c.isArchived && c.status === 'active');
  const totalMRR_UZS = activeContracts.reduce((sum, c) => sum + (c.amount || 0), 0);
  const sortedByDate = [...activeContracts].sort((a, b) => (a.paymentDay || 0) - (b.paymentDay || 0));

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-[#252525] p-5 rounded-xl border border-gray-200 dark:border-[#333] shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">
            <TrendingUp size={24}/>
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold">Ожидаемая выручка (UZS)</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{totalMRR_UZS.toLocaleString()}</div>
          </div>
        </div>
        <div className="bg-white dark:bg-[#252525] p-5 rounded-xl border border-gray-200 dark:border-[#333] shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
            <FileCheck size={24}/>
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold">Активные договоры</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{activeContracts.length}</div>
          </div>
        </div>
      </div>

      {/* Payment Calendar List */}
      <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl shadow-sm p-6">
        <h3 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
          <Calendar size={18}/> График оплат (по дням месяца)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedByDate.map(c => {
            const client = safeClients.find(cl => cl && cl.id === c.clientId);
            return (
              <div 
                key={c.id} 
                className="border border-gray-100 dark:border-[#333] rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-[#303030] flex items-center justify-between cursor-pointer"
                onClick={() => onOpenContractEdit(c)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex flex-col items-center justify-center border border-blue-100 dark:border-blue-900/30">
                    <span className="text-sm font-bold">{c.paymentDay}</span>
                    <span className="text-[8px] uppercase">Число</span>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-800 dark:text-gray-200 truncate max-w-[120px]">
                      {client?.name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[120px]">
                      {c.services}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-gray-900 dark:text-gray-100 text-sm">
                    {c.amount.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-gray-400">UZS</div>
                </div>
              </div>
            );
          })}
        </div>
        {sortedByDate.length === 0 && (
          <div className="text-center py-12 text-gray-400 dark:text-gray-500 text-sm">
            Нет активных договоров
          </div>
        )}
      </div>
    </div>
  );
};

