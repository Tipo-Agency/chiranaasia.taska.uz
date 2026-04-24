import React from 'react';
import { TableCollection, User } from '../types';
import { hasPermission } from '../utils/permissions';
import { DynamicIcon } from './AppIcons';
import { ModulePageShell, ModulePageHeader, MODULE_PAGE_GUTTER } from './ui';
import { Edit2, Trash2, Plus, ArrowLeft } from 'lucide-react';

interface SpacesListViewProps {
  type: 'content-plan' | 'meetings' | 'docs';
  tables: TableCollection[];
  currentUser: User;
  onSelectTable: (id: string) => void;
  onEditTable: (table: TableCollection) => void;
  onDeleteTable: (id: string) => void;
  onCreateTable: () => void;
  onBack: () => void;
}

const getTypeLabel = (type: string): string => {
  switch(type) {
    case 'content-plan': return 'Контент планы';
    case 'meetings': return 'Календарь';
    case 'docs': return 'Документы';
    default: return '';
  }
};

const getTypeIcon = (type: string) => {
  switch(type) {
    case 'content-plan': return 'Instagram';
    case 'meetings': return 'Users';
    case 'docs': return 'FileText';
    default: return 'CheckSquare';
  }
};

const getTypeColor = (type: string) => {
  switch(type) {
    case 'content-plan': return 'text-pink-500';
    case 'meetings': return 'text-purple-500';
    case 'docs': return 'text-yellow-500';
    default: return 'text-gray-500';
  }
};

export const SpacesListView: React.FC<SpacesListViewProps> = ({
  type,
  tables,
  currentUser,
  onSelectTable,
  onEditTable,
  onDeleteTable,
  onCreateTable,
  onBack,
}) => {
  const spacesOfType = tables.filter(t => t.type === type);

  const headerAccent =
    type === 'content-plan' ? 'rose' : type === 'meetings' ? 'violet' : 'amber';

  return (
    <ModulePageShell>
      <div className={`${MODULE_PAGE_GUTTER} pt-8 flex-shrink-0`}>
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 mb-4 transition-colors"
        >
          <ArrowLeft size={18} />
          <span className="text-sm">Назад</span>
        </button>
        <ModulePageHeader
          icon={<DynamicIcon name={getTypeIcon(type)} className="text-white" size={24} />}
          title={getTypeLabel(type)}
          description={`Все пространства типа «${getTypeLabel(type)}»`}
          accent={headerAccent}
        />
      </div>
      
      <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
        <div className={`${MODULE_PAGE_GUTTER} pb-20`}>
          {spacesOfType.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-gray-400 dark:text-gray-500 mb-4">
                <DynamicIcon name={getTypeIcon(type)} className={getTypeColor(type)} size={48} />
              </div>
              <p className="text-gray-500 dark:text-gray-400 mb-2">Нет пространств этого типа</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {spacesOfType.map(table => (
                <button
                  key={table.id}
                  type="button"
                  onClick={() => onSelectTable(table.id)}
                  className="w-full text-left bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-lg p-4 hover:shadow-lg transition-all cursor-pointer group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <DynamicIcon
                        name={table.icon || getTypeIcon(type)}
                        className={table.color || getTypeColor(type)}
                        size={24}
                      />
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">{table.name}</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {getTypeLabel(type)}
                        </p>
                      </div>
                    </div>
                    {hasPermission(currentUser, 'settings.general') && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onEditTable(table); }}
                          className="text-gray-400 hover:text-blue-500 p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/30"
                        >
                          <Edit2 size={14} />
                        </button>
                        {!table.isSystem && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onDeleteTable(table.id); }}
                            className="text-gray-400 hover:text-red-500 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/30"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </ModulePageShell>
  );
};

