import React from 'react';

interface ClientsTabsProps {
  activeTab: 'clients' | 'contracts' | 'finance' | 'receivables';
  onTabChange: (tab: 'clients' | 'contracts' | 'finance' | 'receivables') => void;
}

export const ClientsTabs: React.FC<ClientsTabsProps> = ({ activeTab, onTabChange }) => {
  return (
    <div className="mb-6">
      <div className="inline-flex items-center gap-2 bg-gray-100 dark:bg-[#252525] rounded-full p-1 text-xs">
        <button
          onClick={() => onTabChange('clients')}
          className={`px-3 py-1.5 rounded-full flex items-center gap-1 ${
            activeTab === 'clients'
              ? 'bg-white dark:bg-[#191919] text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-300'
          }`}
        >
          База клиентов
        </button>
        <button
          onClick={() => onTabChange('contracts')}
          className={`px-3 py-1.5 rounded-full flex items-center gap-1 ${
            activeTab === 'contracts'
              ? 'bg-white dark:bg-[#191919] text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-300'
          }`}
        >
          Реестр договоров и продаж
        </button>
        <button
          onClick={() => onTabChange('finance')}
          className={`px-3 py-1.5 rounded-full flex items-center gap-1 ${
            activeTab === 'finance'
              ? 'bg-white dark:bg-[#191919] text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-300'
          }`}
        >
          Финансы / Оплаты
        </button>
        <button
          onClick={() => onTabChange('receivables')}
          className={`px-3 py-1.5 rounded-full flex items-center gap-1 ${
            activeTab === 'receivables'
              ? 'bg-white dark:bg-[#191919] text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-300'
          }`}
        >
          Задолженности
        </button>
      </div>
    </div>
  );
};

