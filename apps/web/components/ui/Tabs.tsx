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

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onChange,
  className = ''
}) => {
  return (
    <div className={`flex items-center gap-2 bg-gray-100 dark:bg-[#252525] rounded-full p-1 text-xs ${className}`}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`
            px-3 py-1.5 rounded-full flex items-center gap-1 whitespace-nowrap transition-all
            ${activeTab === tab.id
              ? 'bg-white dark:bg-[#191919] text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-300'
            }
          `}
        >
          {tab.icon && <span className="shrink-0">{tab.icon}</span>}
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
};

