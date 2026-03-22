import React from 'react';
import { Search, Filter } from 'lucide-react';
import { DynamicIcon } from '../AppIcons';
import { ModuleCreateIconButton } from './ModuleCreateIconButton';
import type { ModuleAccentKey } from './moduleAccent';

interface ModuleHeaderProps {
  title: string;
  icon?: string;
  iconColor?: string;
  onCreate?: () => void;
  createLabel?: string;
  createAccent?: ModuleAccentKey;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
  showTitleOnMobile?: boolean;
}

export const ModuleHeader: React.FC<ModuleHeaderProps> = ({
  title,
  icon,
  iconColor,
  onCreate,
  createLabel = 'Создать',
  createAccent = 'indigo',
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Поиск...',
  filters,
  actions,
  showTitleOnMobile = false
}) => {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4 p-4 md:p-6 border-b border-gray-200 dark:border-[#333] bg-white dark:bg-[#191919]">
      {/* Title and Icon - меньший размер на мобильной версии */}
      <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
        {icon && (
          <DynamicIcon 
            name={icon} 
            className={`${iconColor || 'text-gray-600 dark:text-gray-400'} shrink-0`} 
          />
        )}
        <h1 className="font-bold text-gray-900 dark:text-white text-lg md:text-2xl truncate">
          {title}
        </h1>
      </div>

      {/* Search and Actions Row */}
      <div className="flex items-center gap-2 md:gap-3 flex-1 md:flex-initial">
        {/* Search */}
        {onSearchChange && (
          <div className="relative flex-1 md:flex-initial md:min-w-[200px]">
            <Search 
              size={16} 
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" 
            />
            <input
              type="text"
              value={searchValue || ''}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-[#333] rounded-lg text-sm bg-white dark:bg-[#252525] text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
        )}

        {/* Filters */}
        {filters && (
          <div className="flex items-center gap-2">
            {filters}
          </div>
        )}

        {/* Actions */}
        {actions && (
          <div className="flex items-center gap-2">
            {actions}
          </div>
        )}

        {onCreate && (
          <ModuleCreateIconButton accent={createAccent} label={createLabel} onClick={onCreate} />
        )}
      </div>
    </div>
  );
};

