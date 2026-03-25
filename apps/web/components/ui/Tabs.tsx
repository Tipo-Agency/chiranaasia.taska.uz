import React from 'react';

interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
}

/**
 * Вкладки в едином стиле с модулями (скруглённая панель, активный сегмент).
 */
export const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onChange, className = '' }) => {
  return (
    <div
      className={`inline-flex flex-wrap items-center gap-1.5 rounded-2xl bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#333] p-1 shadow-sm text-sm ${className}`}
      role="tablist"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          onClick={() => onChange(tab.id)}
          className={`
            px-3 py-2 rounded-xl flex items-center gap-1.5 whitespace-nowrap font-medium transition-colors
            ${
              activeTab === tab.id
                ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#252525]'
            }
          `}
        >
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
};

